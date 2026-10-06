import http from 'http';
import app from '../app';
import {
  ensureBucketExists,
  uploadFileBuffer,
  getSignedDownloadUrl,
  deleteStorageObject,
  ATTACHMENTS_BUCKET,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  sanitizeFileName,
  buildStoragePath,
} from '../services/storageService';
import { getSupabaseAdmin, isSupabaseConfigured } from '../config/supabase';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
  error?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, message?: string) {
  if (condition) {
    results.push({ name, passed: true, message });
    console.log(`  [PASS] ${name}`);
  } else {
    results.push({ name, passed: false, error: message || 'Assertion failed' });
    console.error(`  [FAIL] ${name}: ${message || 'Assertion failed'}`);
  }
}

async function runTests(): Promise<void> {
  console.log('================================================================');
  console.log(' BACKEND PHASE 2B: SUPABASE STORAGE & ATTACHMENTS VERIFICATION');
  console.log('================================================================');

  if (!isSupabaseConfigured()) {
    console.error(' Supabase is not configured. Aborting tests.');
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();

  // ----------------------------------------------------------------------------
  // TEST GROUP 1: Unit & Sanitization Tests
  // ----------------------------------------------------------------------------
  console.log('\n--- 1. Filename Sanitization & Path Structure ---');

  const dangerousNames = [
    '../../etc/passwd',
    '..\\..\\windows\\system32\\cmd.exe',
    'my image (1) #@!.png',
    'safe-file.pdf',
  ];

  for (const rawName of dangerousNames) {
    const clean = sanitizeFileName(rawName);
    const hasPathTraversal = clean.includes('/') || clean.includes('\\') || clean.includes('..');
    assert(`Sanitization strips traversal from "${rawName}" -> "${clean}"`, !hasPathTraversal);
  }

  const testComplaintId = 'c0000000-0000-0000-0000-000000000001';
  const { storagePath, sanitizedName } = buildStoragePath(testComplaintId, 'receipt..photo.jpg');
  assert(
    'Storage path matches required complaints/{id}/{unique}-{file} format',
    storagePath.startsWith(`complaints/${testComplaintId}/`) && storagePath.endsWith('.jpg')
  );

  // ----------------------------------------------------------------------------
  // TEST GROUP 2: Bucket Existence & Privacy Configuration
  // ----------------------------------------------------------------------------
  console.log('\n--- 2. Supabase Storage Bucket Configuration ---');

  await ensureBucketExists();
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  assert('Buckets can be listed from Supabase Storage API', !bErr && Array.isArray(buckets));

  const targetBucket = buckets?.find((b) => b.name === ATTACHMENTS_BUCKET);
  assert(`Bucket "${ATTACHMENTS_BUCKET}" exists in Supabase`, Boolean(targetBucket));
  assert(`Bucket "${ATTACHMENTS_BUCKET}" is strictly PRIVATE (public: false)`, targetBucket?.public === false);

  // ----------------------------------------------------------------------------
  // TEST GROUP 3: Validation Logic
  // ----------------------------------------------------------------------------
  console.log('\n--- 3. Validation Rules (Size, MIME, Empty Files) ---');

  // Test empty file rejection
  let emptyRejected = false;
  try {
    await uploadFileBuffer(testComplaintId, Buffer.alloc(0), 'empty.jpg', 'image/jpeg');
  } catch (err: any) {
    emptyRejected = err.message.includes('empty');
  }
  assert('Empty buffer (0 bytes) is rejected', emptyRejected);

  // Test disallowed MIME type rejection
  let mimeRejected = false;
  try {
    await uploadFileBuffer(testComplaintId, Buffer.from('console.log("malicious")'), 'script.js', 'text/javascript');
  } catch (err: any) {
    mimeRejected = err.message.includes('Unsupported file type');
  }
  assert('Unsupported MIME type (text/javascript) is rejected', mimeRejected);

  // Test oversized file rejection (> 5 MB)
  let sizeRejected = false;
  try {
    const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1024);
    await uploadFileBuffer(testComplaintId, oversizedBuffer, 'huge.jpg', 'image/jpeg');
  } catch (err: any) {
    sizeRejected = err.message.includes('exceeds maximum');
  }
  assert('Oversized buffer (> 5 MB) is rejected', sizeRejected);

  // ----------------------------------------------------------------------------
  // TEST GROUP 4: Upload, Signed URL, Retrieval & Deletion Lifecycle
  // ----------------------------------------------------------------------------
  console.log('\n--- 4. Live Storage Lifecycle (Upload -> Signed URL -> Delete) ---');

  const testContent = Buffer.from('Smart College Complaint Portal Attachment Test Buffer ' + Date.now());
  const testFileName = 'test_evidence.png';
  const testMime = 'image/png';

  const uploadResult = await uploadFileBuffer(testComplaintId, testContent, testFileName, testMime);
  assert('File upload to Supabase Storage succeeded', Boolean(uploadResult.storagePath));
  assert('File size matches uploaded buffer size', uploadResult.fileSize === testContent.length);

  // Generate signed URL
  const signedUrl = await getSignedDownloadUrl(uploadResult.storagePath, 120);
  assert('Generated short-lived signed URL', Boolean(signedUrl && signedUrl.startsWith('http')));

  // Verify signed URL allows reading file content
  const fetchRes = await fetch(signedUrl);
  assert('Signed URL fetch returns HTTP 200 OK', fetchRes.status === 200);
  const downloadedArrayBuffer = await fetchRes.arrayBuffer();
  const downloadedBuffer = Buffer.from(downloadedArrayBuffer);
  assert(
    'Downloaded binary content matches uploaded binary buffer',
    downloadedBuffer.equals(testContent)
  );

  // Cleanup uploaded test object
  const deleteResult = await deleteStorageObject(uploadResult.storagePath);
  assert('Deletion of test storage object succeeded', deleteResult);

  // ----------------------------------------------------------------------------
  // TEST GROUP 5: Rollback Guarantee on DB Failure
  // ----------------------------------------------------------------------------
  console.log('\n--- 5. Storage Rollback Verification ---');

  const rollbackContent = Buffer.from('Rollback Test Content');
  const rollbackUpload = await uploadFileBuffer(testComplaintId, rollbackContent, 'rollback_test.pdf', 'application/pdf');
  assert('Pre-rollback file upload succeeded', Boolean(rollbackUpload.storagePath));

  // Simulate transactional failure -> call deleteStorageObject
  const rollbackDeleted = await deleteStorageObject(rollbackUpload.storagePath);
  assert('Rollback purge deletes uploaded object from storage', rollbackDeleted);

  // Verify object is gone (attempting download with signed URL should fail with 400/404 or NoSuchKey)
  try {
    const expiredUrl = await getSignedDownloadUrl(rollbackUpload.storagePath, 30);
    const verifyFetch = await fetch(expiredUrl);
    assert('Deleted storage object cannot be retrieved (returns HTTP error)', verifyFetch.status >= 400);
  } catch (err: any) {
    assert('Deleted storage object cannot generate signed URL or download', true);
  }

  // ----------------------------------------------------------------------------
  // TEST GROUP 6: HTTP REST Endpoints (Express App Network Tests)
  // ----------------------------------------------------------------------------
  console.log('\n--- 6. Express HTTP API Endpoints ---');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 6a. Upload endpoint without file -> 400 Bad Request
    const noFileRes = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/attachments`, {
      method: 'POST',
    });
    const noFileJson: any = await noFileRes.json();
    assert('POST /api/complaints/:id/attachments without file returns 400', noFileRes.status === 400);
    assert('Error message mentions missing file', noFileJson.message?.toLowerCase().includes('file'));

    // 6b. Upload endpoint with invalid MIME type (.exe) -> 400 Bad Request
    const badFormData = new FormData();
    badFormData.append('file', new Blob(['binary data'], { type: 'application/x-msdownload' }), 'virus.exe');
    const badMimeRes = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/attachments`, {
      method: 'POST',
      body: badFormData,
    });
    const badMimeJson: any = await badMimeRes.json();
    assert('POST /api/complaints/:id/attachments with disallowed MIME returns 400', badMimeRes.status === 400);
    assert('Error response identifies invalid file type', badMimeJson.error === 'INVALID_FILE_TYPE' || badMimeJson.message?.includes('Invalid file type'));

    // 6c. Valid file upload via HTTP multipart
    const validFormData = new FormData();
    validFormData.append('file', new Blob([testContent], { type: 'image/png' }), 'http_test.png');
    const validUploadRes = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/attachments`, {
      method: 'POST',
      body: validFormData,
    });
    const validUploadJson: any = await validUploadRes.json();
    assert(
      'POST /api/complaints/:id/attachments with valid file returns 201 Created',
      validUploadRes.status === 201
    );
    assert(
      'Response contains signed URL and storage path',
      Boolean(validUploadJson.data?.storage_path && validUploadJson.data?.signed_url)
    );

    // Clean up the HTTP uploaded file from storage
    if (validUploadJson.data?.storage_path) {
      await deleteStorageObject(validUploadJson.data.storage_path);
    }

    // 6d. GET /api/complaints/:id/attachments/:attachmentId with unknown UUID -> strictly 404 Not Found
    const notFoundRes = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/attachments/a0000000-0000-0000-0000-000000000000`);
    const notFoundJson: any = await notFoundRes.json();
    assert(
      'GET /api/complaints/:id/attachments/:attachmentId with unknown UUID explicitly returns 404',
      notFoundRes.status === 404
    );
    assert(
      '404 response does not expose internal Supabase or database error messages',
      !JSON.stringify(notFoundJson).includes('supabase') && !JSON.stringify(notFoundJson).includes('PostgREST')
    );

    // 6e. GET /api/complaints/:id/attachments/:attachmentId with invalid non-UUID string -> strictly 404 Not Found
    const nonUuidRes = await fetch(`${baseUrl}/api/complaints/${testComplaintId}/attachments/non-existent-attachment-id`);
    assert(
      'GET /api/complaints/:id/attachments/:attachmentId with non-UUID string explicitly returns 404',
      nonUuidRes.status === 404
    );
  } finally {
    server.close();
  }

  // ----------------------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(' TEST SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(` Total Checks : ${total}`);
  console.log(` Passed       : ${passed}`);
  console.log(` Failed       : ${failed}`);

  if (failed > 0) {
    console.error('\n Some attachment tests failed!');
    process.exit(1);
  } else {
    console.log('\n All Phase 2B Attachment and Storage tests passed successfully!');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
