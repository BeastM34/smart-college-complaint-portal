param(
    [string]$SourceDir = "C:\Users\ACER\.gemini\antigravity\scratch\smart-college-complaint-portal",
    [string]$ZipFile = "C:\Users\ACER\.gemini\antigravity\scratch\smart-college-complaint-portal.zip"
)

if (Test-Path $ZipFile) {
    Remove-Item $ZipFile -Force
}

$items = Get-ChildItem -Path $SourceDir | Where-Object { $_.Name -notin @('node_modules', 'dist', '.git') }
Compress-Archive -Path $items.FullName -DestinationPath $ZipFile -CompressionLevel Optimal

Write-Host "Archive created successfully:"
Get-Item $ZipFile | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize
