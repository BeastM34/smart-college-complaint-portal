import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  User,
  Paperclip,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Activity,
  XCircle,
  UserCheck,
  Building,
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
  Textarea,
  Select,
  SkeletonLoader,
  EmptyState,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { complaintService } from '@/services/complaintService';
import type { Complaint, ComplaintStatus, TimelineEvent, ComplaintComment } from '@/types';

export const StaffComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Status update
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>('in_progress');
  const [statusNote, setStatusNote] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // New comment
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  const loadTicketData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const data = await complaintService.getComplaintById(id);
      if (!data) {
        setErrorMessage('Complaint record not found.');
        return;
      }
      setComplaint(data);
      setTargetStatus(data.status === 'resolved' ? 'resolved' : 'in_progress');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'You do not have permission to view this complaint.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadTicketData();
  }, [loadTicketData]);

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    if (!statusNote.trim()) {
      toastError('Please provide a note describing your actions.', 'Work Note Required');
      return;
    }

    setIsUpdatingStatus(true);
    try {
      const updated = await complaintService.updateComplaintStatus(
        complaint.id,
        targetStatus,
        statusNote.trim()
      );
      setComplaint(updated);
      setStatusNote('');
      success(`Updated status to ${targetStatus}`, 'Status Updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toastError(msg, 'Update Failed');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !newComment.trim()) return;

    setIsPostingComment(true);
    try {
      const updated = await complaintService.addComment(complaint.id, newComment.trim(), false);
      setComplaint(updated);
      setNewComment('');
      success('Public update note posted for student tracking.', 'Comment Added');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post update';
      toastError(msg, 'Comment Error');
    } finally {
      setIsPostingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader height="3rem" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SkeletonLoader height="12rem" />
            <SkeletonLoader height="10rem" />
          </div>
          <div>
            <SkeletonLoader height="16rem" />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage || !complaint) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-rose-500" />}
          title="Access Restricted or Not Found"
          description={errorMessage || 'This ticket does not exist or is not assigned to your technician account.'}
          action={
            <Button variant="primary" size="sm" onClick={() => navigate('/staff/complaints')}>
              Return to Work Queue
            </Button>
          }
        />
      </div>
    );
  }

  const timeline = complaint.timeline || [];
  const comments = complaint.comments || [];

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/staff/complaints">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Queue
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {complaint.ticketNumber}
              </span>
              <Badge variant={complaint.status} size="sm" dot>
                {complaint.status.replace('_', ' ')}
              </Badge>
              <Badge variant={complaint.priority} size="sm" dot>
                {complaint.priority}
              </Badge>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
              {complaint.title}
            </h1>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details, Attachments, Comments */}
        <div className="lg:col-span-2 space-y-6">
          {/* Ticket Information Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle>Ticket Information</CardTitle>
                <span className="text-xs text-slate-400">
                  Submitted {new Date(complaint.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {complaint.description}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Category</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 capitalize">
                    {complaint.category}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Location / Room</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {complaint.location || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Reporting Student</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {complaint.studentName || 'Student'}
                  </span>
                </div>
              </div>

              {/* Attachments Section */}
              {complaint.attachments && complaint.attachments.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Evidence Attachments ({complaint.attachments.length})</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {complaint.attachments.map((att, i) => (
                      <div
                        key={i}
                        className="inline-flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-medium truncate max-w-[200px]">
                          {att.startsWith('data:') ? `Attachment ${i + 1}` : att}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Public Updates and Discussion */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Public Ticket Notes & Discussion</span>
              </CardTitle>
              <CardDescription>
                Updates and clarifications visible to the reporting student and campus staff.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No public comments recorded on this ticket yet.</p>
              ) : (
                <div className="space-y-3">
                  {comments.map((cm) => (
                    <div
                      key={cm.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {cm.authorName} ({cm.authorRole})
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(cm.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                          {new Date(cm.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {cm.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Form */}
              <form onSubmit={handlePostComment} className="pt-2 space-y-2.5">
                <Textarea
                  placeholder="Post an update note visible to the student (e.g., replacement parts ordered, inspection scheduled)..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    isLoading={isPostingComment}
                    disabled={!newComment.trim()}
                    rightIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    Post Note
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Status Update Controls & Timeline */}
        <div className="space-y-6">
          {/* Update Status Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Update Work Order</CardTitle>
              <CardDescription>
                Progress ticket status as maintenance tasks are executed.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleStatusUpdate} className="space-y-3.5">
                <Select
                  label="Ticket Status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
                  options={[
                    { value: 'in_progress', label: 'In Progress (Active Work)' },
                    { value: 'resolved', label: 'Resolved (Sign-off complete)' },
                    { value: 'rejected', label: 'Rejected (Invalid / Blocked)' },
                  ]}
                />

                <Textarea
                  label="Work Summary / Reason"
                  placeholder="Summarize actions taken or reasons..."
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  required
                  rows={3}
                  helperText="Required for tracking log."
                />

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="w-full"
                  isLoading={isUpdatingStatus}
                >
                  Confirm Status Change
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Ticket Timeline Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle>Activity Timeline</CardTitle>
              <CardDescription>Chronological milestones on this ticket.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="relative pl-5 border-l-2 border-slate-200 dark:border-slate-800 space-y-5">
                {timeline.map((event) => (
                  <div key={event.id} className="relative group">
                    <div className="absolute -left-[27px] top-0.5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={event.status} size="sm">
                          {event.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {new Date(event.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
                        {event.message}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Updated by: {event.updatedBy} ({event.role})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
