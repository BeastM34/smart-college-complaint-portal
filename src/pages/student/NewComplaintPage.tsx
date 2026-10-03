import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Image as ImageIcon,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  UploadCloud,
  X,
  AlertTriangle,
  Building2,
  Clock,
  Send,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  Edit3,
  Layers,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
  Badge,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { complaintService } from '@/services/complaintService';
import { categoryService } from '@/services/categoryService';
import { settingsService } from '@/services/settingsService';
import type { Priority, ComplaintCategory, Complaint, CategoryItem } from '@/types';

// Step definitions
const STEPS = [
  { id: 1, name: 'Basic Info', icon: FileText, desc: 'Title, category & priority' },
  { id: 2, name: 'Location & Details', icon: MapPin, desc: 'Building, room & description' },
  { id: 3, name: 'Image Attachment', icon: ImageIcon, desc: 'Optional photo proof' },
  { id: 4, name: 'Review & Submit', icon: CheckCircle2, desc: 'Verify before logging' },
];

/**
 * Returns a category icon based on name, icon field, or slug
 */
const getCategoryIcon = (cat: CategoryItem): string => {
  const slug = (cat.slug || '').toLowerCase();
  const name = (cat.name || '').toLowerCase();
  if (slug.includes('electric') || name.includes('electric') || name.includes('power')) return '⚡';
  if (slug.includes('plumb') || name.includes('plumb')) return '🔧';
  if (slug.includes('wifi') || slug.includes('internet') || name.includes('wifi') || name.includes('internet')) return '📶';
  if (slug.includes('class') || name.includes('class')) return '🎓';
  if (slug.includes('furn') || name.includes('furn')) return '🪑';
  if (slug.includes('clean') || slug.includes('sanitat') || name.includes('clean') || name.includes('hygiene') || name.includes('sanitation')) return '🧹';
  if (slug.includes('wash') || slug.includes('restroom') || name.includes('washroom') || name.includes('toilet')) return '🚿';
  if (slug.includes('water') || name.includes('water')) return '💧';
  if (slug.includes('sec') || name.includes('security')) return '🛡️';
  if (slug.includes('hostel') || name.includes('hostel') || name.includes('dorm')) return '🏢';
  if (slug.includes('acad') || name.includes('academic') || name.includes('lab')) return '🔬';
  if (slug.includes('lib') || name.includes('library')) return '📚';
  if (slug.includes('cant') || name.includes('canteen') || name.includes('food') || name.includes('mess')) return '🍽️';
  if (slug.includes('trans') || name.includes('transport') || name.includes('bus')) return '🚌';
  if (slug.includes('infra') || name.includes('infrastructure')) return '🏗️';
  return '📦';
};

const PRIORITIES: { value: Priority; label: string; desc: string; badge: Priority }[] = [
  { value: 'low', label: 'Low', desc: 'Minor inconvenience; no operational halt', badge: 'low' },
  { value: 'medium', label: 'Medium', desc: 'Routine maintenance or minor disruption', badge: 'medium' },
  { value: 'high', label: 'High', desc: 'Affects classes, labs, or multiple students', badge: 'high' },
  { value: 'critical', label: 'Critical', desc: 'Immediate safety, electrical, or flooding hazard', badge: 'critical' },
];

const BUILDINGS = [
  'Main Building',
  'Computer Science Block',
  'Library',
  'Mechanical Block',
  'Administrative Block',
  'Hostel',
  'Canteen',
  'Laboratory',
  'Auditorium',
];

const FLOORS = [
  'Ground Floor',
  '1st Floor',
  '2nd Floor',
  '3rd Floor',
  '4th Floor',
  '5th Floor',
  'Basement / Outside',
];

const DEMO_CAMPUS_LOCATIONS = [
  {
    building: 'Computer Science Block',
    floor: '2nd Floor',
    roomNumber: 'Lab 204 (Turing Hall)',
    location: 'Computer Science Block, 2nd Floor, Lab 204 (Turing Hall)',
  },
  {
    building: 'Library',
    floor: '1st Floor',
    roomNumber: 'Reading Lounge East',
    location: 'APJ Abdul Kalam Library, 1st Floor, Reading Lounge East',
  },
  {
    building: 'Hostel',
    floor: '3rd Floor',
    roomNumber: 'Room 314 (Block 4)',
    location: 'Ramanujan Boys Hostel Block 4, 3rd Floor, Room 314',
  },
  {
    building: 'Main Building',
    floor: 'Ground Floor',
    roomNumber: 'Seminar Hall A',
    location: 'Main Administrative & Academic Building, Ground Floor, Seminar Hall A',
  },
  {
    building: 'Canteen',
    floor: 'Ground Floor',
    roomNumber: 'West Dining Wing',
    location: 'Campus Central Canteen, Ground Floor, West Dining Wing',
  },
];

export const NewComplaintPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);

  // Step 1: Basic Info
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('electrical');
  const [priority, setPriority] = useState<Priority>('medium');

  // Dynamic Settings Limits
  const [settingsLimitMB, setSettingsLimitMB] = useState(5);
  const [maxAttachments, setMaxAttachments] = useState(3);

  // Dynamic Categories from CategoryService
  const [availableCategories, setAvailableCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoryLoadError, setCategoryLoadError] = useState<string | null>(null);

  const loadActiveCategories = async () => {
    setCategoriesLoading(true);
    setCategoryLoadError(null);
    try {
      const activeCats = await categoryService.getCategories(true);
      setAvailableCategories(activeCats);
      if (activeCats.length > 0) {
        setCategory((prev) => {
          const exists = activeCats.some(
            (c) => c.slug === prev || c.name === prev || c.id === prev
          );
          return exists ? prev : (activeCats[0].slug || activeCats[0].name);
        });
      } else {
        setCategory('');
      }
    } catch (err) {
      console.error('Failed to load categories', err);
      setCategoryLoadError('Failed to load complaint categories. Please try refreshing.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  React.useEffect(() => {
    loadActiveCategories();
    settingsService.getSettings().then((s) => {
      if (s.defaultPriority) {
        setPriority(s.defaultPriority);
      }
      if (s.maxAttachmentSizeMB) {
        setSettingsLimitMB(s.maxAttachmentSizeMB);
      }
      if (s.maxAttachmentsPerComplaint) {
        setMaxAttachments(s.maxAttachmentsPerComplaint);
      }
    }).catch((err) => {
      console.warn('Failed to load settings in NewComplaintPage:', err);
    });
  }, []);

  // Step 2: Location & Description
  const [building, setBuilding] = useState('Computer Science Block');
  const [floor, setFloor] = useState('2nd Floor');
  const [roomNumber, setRoomNumber] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');

  // Step 3: Image Attachment
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-compose location string when building/floor/room changes if user hasn't overridden
  const handleAutoLocation = (newBld: string, newFl: string, newRm: string) => {
    const parts = [newBld, newFl, newRm].filter(Boolean);
    setLocation(parts.join(', '));
  };

  // Demo Location Fill
  const handleUseDemoLocation = () => {
    const randomSpot =
      DEMO_CAMPUS_LOCATIONS[Math.floor(Math.random() * DEMO_CAMPUS_LOCATIONS.length)];
    setBuilding(randomSpot.building);
    setFloor(randomSpot.floor);
    setRoomNumber(randomSpot.roomNumber);
    setLocation(randomSpot.location);
    if (errors.building || errors.roomNumber || errors.location) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.building;
        delete copy.roomNumber;
        delete copy.location;
        return copy;
      });
    }
    info('Sample college location applied for testing.', 'Demo Location Applied');
  };

  // Image validation & processing
  const processImageFile = (file: File) => {
    setImageError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      const msg = 'Invalid file format. Please upload JPG, PNG, or WebP only.';
      setImageError(msg);
      toastError(msg, 'Upload Failed');
      return;
    }

    const maxSize = settingsLimitMB * 1024 * 1024;
    if (file.size > maxSize) {
      const msg = `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum allowed size is ${settingsLimitMB}MB.`;
      setImageError(msg);
      toastError(msg, 'File Too Large');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImageFile(e.target.files[0]);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Step Validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!title.trim()) {
        newErrors.title = 'Complaint title is required';
      } else if (title.trim().length < 5) {
        newErrors.title = 'Title must be at least 5 characters';
      } else if (title.trim().length > 100) {
        newErrors.title = 'Title cannot exceed 100 characters';
      }

      if (!category) {
        newErrors.category = 'Please select a complaint category';
      } else if (
        availableCategories.length > 0 &&
        !availableCategories.some(
          (c) => c.slug === category || c.name === category || c.id === category
        )
      ) {
        newErrors.category = 'The selected category is no longer active. Please choose an active category.';
      } else if (!categoriesLoading && availableCategories.length === 0) {
        newErrors.category = 'No active categories are currently available for complaint submission.';
      }

      if (!priority) {
        newErrors.priority = 'Please choose a priority level';
      }
    }

    if (step === 2) {
      if (!building.trim()) {
        newErrors.building = 'Please select or enter the building';
      }
      if (!floor.trim()) {
        newErrors.floor = 'Please select the floor level';
      }
      if (!roomNumber.trim()) {
        newErrors.roomNumber = 'Room, lab, or specific area number is required';
      }
      if (!location.trim()) {
        newErrors.location = 'Specific location summary is required';
      }
      if (!description.trim()) {
        newErrors.description = 'Please provide a clear description of the issue';
      } else if (description.trim().length < 15) {
        newErrors.description = 'Description must be at least 15 characters to provide context';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation between steps
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToStep = (stepNumber: number) => {
    setCurrentStep(stepNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submission
  const handleSubmit = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      toastError('Please check all required fields before submitting', 'Validation Error');
      return;
    }

    setIsSubmitting(true);
    try {
      const attachmentsList = imagePreview ? [imagePreview] : [];

      const newComplaint = await complaintService.createComplaint({
        title: title.trim(),
        category,
        priority,
        building,
        floor,
        roomNumber: roomNumber.trim(),
        location: location.trim(),
        description: description.trim(),
        additionalDetails: additionalDetails.trim() || undefined,
        attachments: attachmentsList,
        status: 'pending',
        studentId: user?.id || 'user-student-1',
        studentName: user?.name || 'Alex Johnson',
        studentEmail: user?.email || 'student@college.edu',
        department: user?.department || 'Computer Science & Engineering',
      });

      setSubmittedComplaint(newComplaint);
      success(
        `Ticket ${newComplaint.ticketNumber} logged and queued for administrative review.`,
        'Complaint Submitted'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit complaint';
      toastError(msg, 'Submission Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setTitle('');
    setCategory(availableCategories[0]?.slug || availableCategories[0]?.name || '');
    setPriority('medium');
    setBuilding('Computer Science Block');
    setFloor('2nd Floor');
    setRoomNumber('');
    setLocation('');
    setDescription('');
    setAdditionalDetails('');
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    setErrors({});
    setSubmittedComplaint(null);
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // SUCCESS SCREEN
  if (submittedComplaint) {
    return (
      <div className="max-w-2xl mx-auto py-6 sm:py-10 space-y-6">
        <Card className="border-emerald-200/80 dark:border-emerald-900/60 shadow-lg overflow-hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center space-y-2">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-2 shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Complaint submitted successfully
            </h2>
            <p className="text-xs text-emerald-100 max-w-md mx-auto">
              Your maintenance ticket has been registered in the campus infrastructure management portal.
            </p>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Ticket Info Card */}
            <div className="bg-slate-50 dark:bg-slate-900/80 rounded-xl p-5 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Complaint ID
                  </span>
                  <p className="text-xl font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                    {submittedComplaint.ticketNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="pending" size="md" dot>
                    Pending
                  </Badge>
                  <Badge variant={submittedComplaint.priority} size="md">
                    {submittedComplaint.priority.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Summary
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {submittedComplaint.title}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>{submittedComplaint.location || `${submittedComplaint.building}, ${submittedComplaint.roomNumber}`}</span>
                </p>
              </div>

              {/* SLA Maintenance Note */}
              <div className="rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-900/50 p-3.5 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
                <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Expected response:</p>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                    Based on the college maintenance workflow.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                className="w-full sm:w-auto flex-1 font-semibold"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                onClick={() => navigate(`/student/complaints/${submittedComplaint.id}`)}
              >
                Track Complaint
              </Button>

              <Button
                variant="outline"
                size="md"
                className="w-full sm:w-auto font-medium"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={handleResetForm}
              >
                Submit Another Complaint
              </Button>

              <Button
                variant="ghost"
                size="md"
                className="w-full sm:w-auto font-medium"
                onClick={() => navigate('/student/dashboard')}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4-STEP FORM VIEW
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header / Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </button>

        <Badge variant="default" size="sm">
          Phase 4 • Workflow
        </Badge>
      </div>

      {/* Title & Introduction */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Submit Maintenance Complaint
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Complete the 4-step wizard to report an infrastructure or facility issue to college staff.
        </p>
      </div>

      {/* Progress Stepper Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-4 gap-2">
          {STEPS.map((step) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const StepIcon = step.icon;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) handleJumpToStep(step.id);
                }}
                disabled={step.id > currentStep}
                className={`flex flex-col items-center sm:items-start text-left p-2 rounded-xl transition-all ${
                  isCurrent
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60'
                    : isCompleted
                    ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    : 'opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.id}
                  </div>
                  <span className="hidden sm:inline text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {step.name}
                  </span>
                </div>
                <p className="hidden md:block text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                  {step.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Linear progress bar */}
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
          />
        </div>
      </div>

      {/* Main Multi-Step Form Card */}
      <Card className="shadow-sm">
        {/* STEP 1: Basic Information */}
        {currentStep === 1 && (
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <span>Step 1 — Basic Information</span>
                  </CardTitle>
                  <CardDescription>
                    Provide a concise summary and categorize the infrastructure breakdown.
                  </CardDescription>
                </div>
                <Badge variant="default" size="sm">
                  1 of 4
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Complaint Title */}
              <div>
                <Input
                  label="Complaint Title"
                  required
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
                  }}
                  placeholder="e.g. Overhead projector lamp failed in CS Lab 304"
                  error={errors.title}
                  helperText="Provide a clear, brief headline of the issue (5–100 characters)."
                />
              </div>

              {/* Category Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  {!categoriesLoading && availableCategories.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      {availableCategories.length} active categories
                    </span>
                  )}
                </div>

                {categoriesLoading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse border border-slate-200/60 dark:border-slate-800"
                      />
                    ))}
                  </div>
                ) : categoryLoadError ? (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2 text-xs text-rose-700 dark:text-rose-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{categoryLoadError}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={loadActiveCategories}
                    >
                      Retry
                    </Button>
                  </div>
                ) : availableCategories.length === 0 ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 text-center">
                    <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                    <p className="font-semibold">No active categories available</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      There are currently no active categories configured in the college management portal.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {availableCategories.map((cat) => {
                      const catKey = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                      const isSelected = category === catKey || category === cat.name;
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => {
                            setCategory(catKey);
                            if (errors.category) setErrors((prev) => ({ ...prev, category: '' }));
                          }}
                          title={cat.description}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold shadow-xs dark:bg-indigo-950/60 dark:border-indigo-500 dark:text-indigo-200'
                              : 'border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <span className="text-xl mb-1">{getCategoryIcon(cat)}</span>
                          <span className="text-xs truncate w-full" title={cat.name}>
                            {cat.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {errors.category && (
                  <p className="text-xs text-rose-500 mt-1">{errors.category}</p>
                )}
              </div>

              {/* Priority Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Priority Level <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRIORITIES.map((p) => {
                    const isSelected = priority === p.value;
                    return (
                      <div
                        key={p.value}
                        onClick={() => {
                          setPriority(p.value);
                          if (errors.priority) setErrors((prev) => ({ ...prev, priority: '' }));
                        }}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/50 dark:border-indigo-500 shadow-xs'
                            : 'border-slate-200/80 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {p.label}
                          </span>
                          <Badge variant={p.badge} size="sm">
                            {p.value}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {p.desc}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {errors.priority && (
                  <p className="text-xs text-rose-500 mt-1">{errors.priority}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Location
              </Button>
            </CardFooter>
          </div>
        )}

        {/* STEP 2: Location & Description */}
        {currentStep === 2 && (
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                    <span>Step 2 — Location & Description</span>
                  </CardTitle>
                  <CardDescription>
                    Pinpoint where the problem is located and describe what went wrong.
                  </CardDescription>
                </div>
                <Badge variant="default" size="sm">
                  2 of 4
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Mock Demo Location Button & Notice */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                      Need a quick test location?
                    </p>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                      Mock/demo feature: Autofills campus spots. Does not request or claim real GPS coordinates.
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUseDemoLocation}
                  leftIcon={<MapPin className="w-3.5 h-3.5 text-amber-600" />}
                  className="bg-white hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-800 shrink-0 text-xs font-medium"
                >
                  Use Campus Location (Demo)
                </Button>
              </div>

              {/* Building & Floor Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select
                  label="Campus Building"
                  required
                  value={building}
                  onChange={(e) => {
                    setBuilding(e.target.value);
                    handleAutoLocation(e.target.value, floor, roomNumber);
                    if (errors.building) setErrors((prev) => ({ ...prev, building: '' }));
                  }}
                  options={BUILDINGS.map((b) => ({ value: b, label: b }))}
                  error={errors.building}
                />

                <Select
                  label="Floor Level"
                  required
                  value={floor}
                  onChange={(e) => {
                    setFloor(e.target.value);
                    handleAutoLocation(building, e.target.value, roomNumber);
                    if (errors.floor) setErrors((prev) => ({ ...prev, floor: '' }));
                  }}
                  options={FLOORS.map((f) => ({ value: f, label: f }))}
                  error={errors.floor}
                />
              </div>

              {/* Room Number & Specific Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Room / Lab / Facility Number"
                  required
                  value={roomNumber}
                  onChange={(e) => {
                    setRoomNumber(e.target.value);
                    handleAutoLocation(building, floor, e.target.value);
                    if (errors.roomNumber) setErrors((prev) => ({ ...prev, roomNumber: '' }));
                  }}
                  placeholder="e.g. Lab 304, Room 212, or East Washroom"
                  error={errors.roomNumber}
                />

                <Input
                  label="Complete Location Summary"
                  required
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (errors.location) setErrors((prev) => ({ ...prev, location: '' }));
                  }}
                  placeholder="e.g. Computer Science Block, 3rd Floor, Lab 304"
                  error={errors.location}
                  helperText="Auto-assembled summary for facility dispatch."
                />
              </div>

              {/* Description */}
              <div>
                <Textarea
                  label="Detailed Complaint Description"
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  placeholder="Detail the failure, safety implications, when you first noticed it, and how it impacts work or classes..."
                  error={errors.description}
                  helperText={`${description.length} characters (minimum 15 recommended)`}
                />
              </div>

              {/* Additional Details */}
              <div>
                <Textarea
                  label="Additional Notes / Equipment IDs (Optional)"
                  rows={2}
                  value={additionalDetails}
                  onChange={(e) => setAdditionalDetails(e.target.value)}
                  placeholder="Any machine serial numbers, instructor names present, or temporary precautions taken..."
                />
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Continue to Image Upload
              </Button>
            </CardFooter>
          </div>
        )}

        {/* STEP 3: IMAGE ATTACHMENT */}
        {currentStep === 3 && (
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ImageIcon className="w-5 h-5 text-indigo-600" />
                    <span>Step 3 — Attach Image (Optional)</span>
                  </CardTitle>
                  <CardDescription>
                    Visual evidence helps maintenance technicians arrive with the correct spare parts.
                  </CardDescription>
                </div>
                <Badge variant="default" size="sm">
                  3 of 4
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Drag and Drop Zone or Preview */}
              {!imagePreview ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center transition-all ${
                    isDragging
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileInputChange}
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                  />

                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-2xs">
                    <UploadCloud className="w-7 h-7" />
                  </div>

                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Drag and drop your complaint photo here
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Supported formats: <strong className="font-semibold text-slate-700 dark:text-slate-300">JPG, PNG, or WebP</strong> (Max {settingsLimitMB}MB)
                  </p>

                  <div className="mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse Files
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-slate-950 text-white max-h-80 flex items-center justify-center group">
                    <img
                      src={imagePreview}
                      alt="Complaint attachment preview"
                      className="max-h-80 w-auto object-contain mx-auto"
                    />

                    {/* Overlay controls */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="p-2 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white shadow-md backdrop-blur-xs transition-colors"
                        title="Remove image"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-xs flex items-center justify-between">
                      <span className="truncate max-w-xs">{imageFile?.name || 'Uploaded photo'}</span>
                      <span className="text-[11px] text-slate-300">
                        {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <CheckCircle2 className="w-4 h-4" />
                      Image successfully attached
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs"
                    >
                      Remove & Choose Another
                    </Button>
                  </div>
                </div>
              )}

              {/* Error Alert */}
              {imageError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{imageError}</span>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-500">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p>
                  Images are optional but strongly recommended for damaged furniture, water leaks, and electrical burn marks. You may proceed without an image.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleNext}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Review Complaint
              </Button>
            </CardFooter>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {currentStep === 4 && (
          <div>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    <span>Step 4 — Review Complaint</span>
                  </CardTitle>
                  <CardDescription>
                    Please verify your complaint details before submission.
                  </CardDescription>
                </div>
                <Badge variant="default" size="sm">
                  4 of 4
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Summary Cards */}

              {/* Section 1: Basic Info */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Basic Information
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(1)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="default" size="sm">
                      Category:{' '}
                      {availableCategories.find(
                        (c) => c.slug === category || c.name === category || c.id === category
                      )?.name || category}
                    </Badge>
                    <Badge variant={priority} size="sm">
                      Priority: {priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Section 2: Location & Description */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Location & Description
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(2)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Building & Floor</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {building} ({floor})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Room / Facility</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {roomNumber}
                    </span>
                  </div>
                </div>

                <div className="text-xs pt-1">
                  <span className="text-slate-400 block text-[11px] mb-1">Description</span>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                    {description}
                  </p>
                </div>

                {additionalDetails && (
                  <div className="text-xs pt-1">
                    <span className="text-slate-400 block text-[11px] mb-1">Additional Details</span>
                    <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50/50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                      {additionalDetails}
                    </p>
                  </div>
                )}
              </div>

              {/* Section 3: Image Proof */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5" />
                    Image Proof
                  </span>
                  <button
                    type="button"
                    onClick={() => handleJumpToStep(3)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                </div>

                {imagePreview ? (
                  <div className="flex items-center gap-4">
                    <img
                      src={imagePreview}
                      alt="Thumbnail"
                      className="w-20 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                    />
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
                        {imageFile?.name || 'Uploaded photo'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : ''}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No image attached.</p>
                )}
              </div>

              {/* Student Metadata Card */}
              <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Submitting Student
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {user?.name || 'Alex Johnson'} ({user?.studentId || 'STU2024-8841'})
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {user?.department || 'Computer Science & Engineering'}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleBack}
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSubmit}
                isLoading={isSubmitting}
                leftIcon={<Send className="w-4 h-4" />}
                className="font-semibold px-6 shadow-sm hover:shadow-md"
              >
                Submit Complaint
              </Button>
            </CardFooter>
          </div>
        )}
      </Card>
    </div>
  );
};
