import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Clock,
  User,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Building,
  Layers,
  Send,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
  X,
  Maximize2,
  HelpCircle,
  Activity,
  UserCheck,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Input,
  Textarea,
  SkeletonLoader,
  EmptyState,
  Modal,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { complaintService } from '@/services/complaintService';
import { settingsService } from '@/services/settingsService';
import type { Complaint, ComplaintStatus, Priority } from '@/types';

// Visual Stage Pipeline steps
const STAGES: { key: string; label: string; desc: string }[] = [
  { key: 'submitted', label: 'Submitted', desc: 'Ticket registered by student' },
  { key: 'reviewed', label: 'Reviewed', desc: 'Triage & priority validation' },
  { key: 'assigned', label: 'Assigned', desc: 'Dispatched to department technician' },
  { key: 'in_progress', label: 'In Progress', desc: 'Work underway on site' },
  { key: 'resolved', label: 'Resolved', desc: 'Issue resolved & verified' },
];

export const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { success, error: toastError, info } = useToast();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Reopen modal state
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [allowReopening, setAllowReopening] = useState(true);

  // Satisfaction state
  const [satisfactionRating, setSatisfactionRating] = useState<'satisfied' | 'not_satisfied'>('satisfied');
  const [satisfactionFeedback, setSatisfactionFeedback] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchComplaint = async () => {
    if (!id) return;
    try {
      // getComplaintById filters internal admin notes when student views
      const data = await complaintService.getComplaintById(id, true);
      setComplaint(data);
    } catch (err) {
      console.error('Failed to load complaint details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComplaint();
    settingsService.getSettings().then((s) => {
      setAllowReopening(s.allowReopening);
    }).catch((err) => {
      console.warn('Failed to load settings in complaint details:', err);
    });
  }, [id]);

  // Compute current stage index for progress tracker
  const getStageIndex = (status: ComplaintStatus): number => {
    switch (status) {
      case 'pending':
        return 0; // Submitted/Reviewed
      case 'assigned':
        return 2;
      case 'in_progress':
        return 3;
      case 'resolved':
        return 4;
      case 'rejected':
        return 0;
      default:
        return 0;
    }
  };

  // Add Comment Handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !newComment.trim()) return;

    setPostingComment(true);
    try {
      const updated = await complaintService.addComment(complaint.id, newComment.trim(), false);
      setComplaint(updated);
      setNewComment('');
      success('Your comment has been added to the ticket history.', 'Comment Posted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post comment';
      toastError(msg, 'Error');
    } finally {
      setPostingComment(false);
    }
  };

  // Reopen Complaint Handler
  const handleReopen = async () => {
    if (!allowReopening) {
      toastError('Complaint reopening is currently disabled by institutional policy.', 'Reopen Disabled');
      return;
    }

    if (!complaint || !reopenReason.trim()) {
      toastError('Please provide a reason for reopening this complaint', 'Reason Required');
      return;
    }

    if (reopenReason.trim().length < 5) {
      toastError('Reopen reason must be at least 5 characters long.', 'Reason Required');
      return;
    }

    setReopening(true);
    try {
      const updated = await complaintService.reopenComplaint(complaint.id, reopenReason.trim());
      setComplaint(updated);
      setReopenModalOpen(false);
      setReopenReason('');
      success(`Ticket ${updated.ticketNumber} has been reopened for further action.`, 'Ticket Reopened');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reopen complaint';
      toastError(msg, 'Error');
    } finally {
      setReopening(false);
    }
  };

  // Rate Satisfaction Handler
  const handleRateSatisfaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setSubmittingRating(true);
    try {
      const updated = await complaintService.rateSatisfaction(
        complaint.id,
        satisfactionRating,
        satisfactionFeedback.trim()
      );
      setComplaint(updated);
      success('Thank you! Your feedback helps improve campus services.', 'Rating Recorded');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record rating';
      toastError(msg, 'Error');
    } finally {
      setSubmittingRating(false);
    }
  };

  const formatStatus = (status: ComplaintStatus) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatDateTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return {
        date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      };
    } catch {
      return { date: isoString, time: '' };
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <SkeletonLoader height="2rem" width="200px" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <SkeletonLoader count={2} height="12rem" />
          </div>
          <div>
            <SkeletonLoader count={2} height="16rem" />
          </div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Complaint not found"
          description={`Unable to locate complaint with ID "${id}". It may have been archived or removed.`}
          action={
            <Link to="/student/complaints">
              <Button size="sm">Back to My Complaints</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const currentStageIdx = getStageIndex(complaint.status);
  const isResolvedOrRejected = complaint.status === 'resolved' || complaint.status === 'rejected';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/student/complaints')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to My Complaints</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Status:</span>
          <Badge variant={complaint.status} size="md" dot>
            {formatStatus(complaint.status)}
          </Badge>
          <Badge variant={complaint.priority} size="md">
            {complaint.priority.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                {complaint.ticketNumber}
              </span>
              <Badge variant="default" size="sm">
                Category: {complaint.category.replace('_', ' ')}
              </Badge>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {complaint.title}
            </h1>
          </div>

          {/* Action button if eligible for reopen */}
          {isResolvedOrRejected && (
            allowReopening ? (
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
                onClick={() => setReopenModalOpen(true)}
                className="shrink-0 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                Reopen Complaint
              </Button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Ticket reopening disabled by college policy</span>
              </div>
            )
          )}
        </div>

        {/* Timestamps */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            Submitted: {formatDateTime(complaint.createdAt).date} at {formatDateTime(complaint.createdAt).time}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Last Updated: {formatDateTime(complaint.updatedAt).date} at {formatDateTime(complaint.updatedAt).time}
          </span>
        </div>
      </div>

      {/* Visual Stage Progress Tracker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <span>Resolution Stage Tracker</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            {STAGES.map((stage, idx) => {
              const isPassed = currentStageIdx >= idx;
              const isCurrent = currentStageIdx === idx;

              return (
                <div
                  key={stage.key}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                    isCurrent
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/50 shadow-xs'
                      : isPassed
                      ? 'border-emerald-200/80 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-900/40'
                      : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase text-slate-400">
                      Stage {idx + 1}
                    </span>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                      }`}
                    >
                      {isPassed && !isCurrent ? <Check className="w-3 h-3" /> : idx + 1}
                    </div>
                  </div>

                  <div>
                    <h4
                      className={`text-xs font-bold ${
                        isCurrent
                          ? 'text-indigo-900 dark:text-indigo-200'
                          : isPassed
                          ? 'text-emerald-900 dark:text-emerald-300'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {stage.label}
                    </h4>
                    <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{stage.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details, Attachments, Comments, Satisfaction */}
        <div className="lg:col-span-2 space-y-6">
          {/* Complaint Description & Location Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Location & Issue Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Location Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-medium">Building</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {complaint.building || 'Campus Facility'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-medium">Floor</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {complaint.floor || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-medium">Room / Area</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {complaint.roomNumber || 'Common Area'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-medium">Full Location</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {complaint.location || 'On Campus'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <span className="text-slate-400 block text-[11px] font-medium">Description</span>
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  {complaint.description}
                </p>
              </div>

              {/* Additional Details */}
              {complaint.additionalDetails && (
                <div className="space-y-1.5">
                  <span className="text-slate-400 block text-[11px] font-medium">Additional Context</span>
                  <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    {complaint.additionalDetails}
                  </p>
                </div>
              )}

              {/* Attached Images */}
              {complaint.attachments && complaint.attachments.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-slate-400 block text-[11px] font-medium">Attached Photos</span>
                  <div className="flex flex-wrap gap-3">
                    {complaint.attachments.map((imgSrc, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedImage(imgSrc)}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 w-28 h-28 bg-slate-100 dark:bg-slate-800 shadow-2xs"
                      >
                        <img
                          src={imgSrc}
                          alt={`Attachment ${i + 1}`}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Satisfaction Rating Widget (for resolved tickets) */}
          {complaint.status === 'resolved' && (
            <Card className="border-emerald-200/80 dark:border-emerald-900/60 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Resolution Satisfaction Feedback</span>
                </CardTitle>
                <CardDescription>
                  Help the college measure maintenance quality and technician service delivery.
                </CardDescription>
              </CardHeader>

              <CardContent>
                {complaint.satisfaction ? (
                  <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">
                          {complaint.satisfaction.rating === 'satisfied' ? '😊' : '🙁'}
                        </span>
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          {complaint.satisfaction.rating === 'satisfied'
                            ? 'Satisfied with resolution'
                            : 'Not satisfied with resolution'}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                        Submitted {formatDateTime(complaint.satisfaction.submittedAt).date}
                      </span>
                    </div>

                    {complaint.satisfaction.feedback && (
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 italic pt-1 border-t border-emerald-200/60 dark:border-emerald-900/60">
                        "{complaint.satisfaction.feedback}"
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRateSatisfaction} className="space-y-4">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Was this issue resolved satisfactorily?
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setSatisfactionRating('satisfied')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                          satisfactionRating === 'satisfied'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-800 shadow-xs dark:bg-emerald-950/60 dark:border-emerald-500 dark:text-emerald-200'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <ThumbsUp className="w-4 h-4 text-emerald-600" />
                        <span>Satisfied</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSatisfactionRating('not_satisfied')}
                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
                          satisfactionRating === 'not_satisfied'
                            ? 'border-rose-600 bg-rose-50 text-rose-800 shadow-xs dark:bg-rose-950/60 dark:border-rose-500 dark:text-rose-200'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                        }`}
                      >
                        <ThumbsDown className="w-4 h-4 text-rose-600" />
                        <span>Not Satisfied</span>
                      </button>
                    </div>

                    <Textarea
                      label="Feedback / Comments (Optional)"
                      rows={2}
                      value={satisfactionFeedback}
                      onChange={(e) => setSatisfactionFeedback(e.target.value)}
                      placeholder="Share details regarding technician conduct, speed of repair, or quality of work..."
                    />

                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      isLoading={submittingRating}
                    >
                      Submit Satisfaction Feedback
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}

          {/* Student Comments Section */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Student Comments</span>
                </CardTitle>
                <Badge variant="default" size="sm">
                  {complaint.comments?.length || 0}
                </Badge>
              </div>
              <CardDescription>
                Ask questions, report additional observations, or correspond with campus staff.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Existing Comments List */}
              {complaint.comments && complaint.comments.length > 0 ? (
                <div className="space-y-3">
                  {complaint.comments.map((cm) => (
                    <div
                      key={cm.id}
                      className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {cm.authorName}
                          </span>
                          <Badge variant={cm.authorRole === 'admin' ? 'default' : 'neutral' as any} size="sm">
                            {cm.authorRole}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(cm.timestamp).date} {formatDateTime(cm.timestamp).time}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {cm.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic py-2">
                  No comments posted yet. Use the field below to leave a note.
                </p>
              )}

              {/* Add Comment Input */}
              <form onSubmit={handleAddComment} className="pt-2 space-y-3">
                <Textarea
                  placeholder="Type a comment or question for facility management..."
                  rows={3}
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={postingComment}
                    disabled={!newComment.trim()}
                    leftIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Post Comment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Visual Timeline & Staff Assignment */}
        <div className="space-y-6">
          {/* Assignment / Staff Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-600" />
                <span>Assignment Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-medium">Assigned Technician</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                  {complaint.assignedStaffName || 'Pending Assignment'}
                </span>
              </div>

              {complaint.assignedStaffName && (
                <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-[11px] text-indigo-900 dark:text-indigo-300">
                  Technician assigned to inspect and address this maintenance ticket.
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-medium">Submitting Student</span>
                <p className="font-medium text-slate-800 dark:text-slate-200">
                  {complaint.studentName}
                </p>
                <p className="text-slate-400 text-[11px]">{complaint.department || 'Student'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Visual Chronological Timeline Activity */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span>Activity Timeline</span>
                </CardTitle>
                <Badge variant="default" size="sm">
                  {complaint.timeline.length} Events
                </Badge>
              </div>
              <CardDescription>
                Chronological audit trail of ticket submissions and stage updates.
              </CardDescription>
            </CardHeader>

            <CardContent className="max-h-[500px] overflow-y-auto pr-1">
              <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {complaint.timeline.map((evt) => {
                  const { date, time } = formatDateTime(evt.timestamp);
                  return (
                    <div key={evt.id} className="relative group text-xs">
                      {/* Timeline dot */}
                      <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-2xs">
                        <div className="w-2 h-2 rounded-full bg-indigo-600" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={evt.status} size="sm">
                            {formatStatus(evt.status)}
                          </Badge>
                          <span className="text-[10px] text-slate-400">
                            {date} {time}
                          </span>
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 leading-snug">
                          {evt.message}
                        </p>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            {evt.updatedBy}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{evt.role}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* REOPEN COMPLAINT MODAL */}
      <Modal
        isOpen={reopenModalOpen}
        onClose={() => setReopenModalOpen(false)}
        title="Reopen Complaint"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Reopening Ticket #{complaint.ticketNumber}</p>
              <p className="text-amber-800/90 dark:text-amber-300/80 mt-0.5">
                This will move the complaint back to pending review and notify campus facilities that the issue requires further work.
              </p>
            </div>
          </div>

          <Textarea
            label="Reason for Reopening *"
            required
            rows={4}
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="Please specify why this complaint is not resolved (e.g. leaking resumed, repair was partial, etc.)..."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReopenModalOpen(false)}
              disabled={reopening}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReopen}
              isLoading={reopening}
              disabled={!reopenReason.trim() || reopenReason.trim().length < 5 || reopening}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Confirm Reopen
            </Button>
          </div>
        </div>
      </Modal>

      {/* FULL IMAGE PREVIEW MODAL */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 p-2 text-white hover:text-slate-300"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage}
              alt="Full preview"
              className="max-h-[85vh] w-auto rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};
