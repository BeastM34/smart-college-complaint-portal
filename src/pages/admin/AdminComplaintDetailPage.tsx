import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  UserCheck,
  ShieldCheck,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  Lock,
  Globe,
  Send,
  User,
  Building,
  CheckCircle2,
  Tag,
  AlertTriangle,
  FileText,
  Maximize2,
  X,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Select,
  Input,
  Textarea,
  Modal,
  SkeletonLoader,
  EmptyState,
} from '@/components/common';
import { complaintService } from '@/services/complaintService';
import { userService } from '@/services/userService';
import { useToast } from '@/hooks/useToast';
import { MOCK_STAFF, MOCK_DEPARTMENTS } from '@/data/mockData';
import type { Complaint, ComplaintStatus, Priority, StaffMember } from '@/types';

export const AdminComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>('in_progress');
  const [statusComment, setStatusComment] = useState('');
  const [statusIsInternal, setStatusIsInternal] = useState(false);
  const [statusNotifyStudent, setStatusNotifyStudent] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [staffMembers, setStaffMembers] = useState<any[]>(MOCK_STAFF);
  const [selectedStaffId, setSelectedStaffId] = useState(MOCK_STAFF[0].id);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(MOCK_DEPARTMENTS[0]);
  const [assignNotifyStudent, setAssignNotifyStudent] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  // Priority Modal State
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [selectedPriority, setSelectedPriority] = useState<Priority>('medium');
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false);

  // New Note / Comment State
  const [newCommentText, setNewCommentText] = useState('');
  const [commentIsInternal, setCommentIsInternal] = useState(true); // default internal note for admin
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadStaff = async () => {
    try {
      const realStaff = await userService.getStaff(true);
      if (realStaff && realStaff.length > 0) {
        setStaffMembers(realStaff);
        setSelectedStaffId((prev) => {
          if (!prev || prev === MOCK_STAFF[0].id) {
            return realStaff[0].id;
          }
          return prev;
        });
      }
    } catch (err) {
      // Fall back to MOCK_STAFF
    }
  };

  const loadComplaint = async () => {
    if (!id) return;
    setLoading(true);
    try {
      // Pass filterInternal: false because Admin is authorized to view all internal notes
      const data = await complaintService.getComplaintById(id, false);
      setComplaint(data);
      if (data) {
        setSelectedStatus(data.status);
        setSelectedPriority(data.priority);
        if (data.assignedDepartment) {
          setSelectedDepartment(data.assignedDepartment);
        }
        if (data.assignedTo) {
          setSelectedStaffId(data.assignedTo);
        }
      }
    } catch (err) {
      console.error('Failed to load complaint details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaint();
    loadStaff();
  }, [id]);

  // Handler: Status Update Modal Submit
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setIsUpdatingStatus(true);
    try {
      const updated = await complaintService.updateComplaintStatus(
        complaint.id,
        selectedStatus,
        statusComment.trim() || `Status changed to ${selectedStatus.replace('_', ' ').toUpperCase()}`,
        statusIsInternal,
        statusNotifyStudent
      );
      setComplaint(updated);
      setStatusModalOpen(false);
      setStatusComment('');
      success(`Status transitioned to ${selectedStatus.toUpperCase()}`, 'Status Updated');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toastError(msg, 'Error');
      console.error(err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handler: Assign Staff & Department Modal Submit
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    const staffMember = staffMembers.find((s) => s.id === selectedStaffId) || staffMembers[0];
    setIsAssigning(true);
    try {
      const updated = await complaintService.assignComplaint(
        complaint.id,
        staffMember.id,
        staffMember.name,
        selectedDepartment,
        assignNotifyStudent
      );
      setComplaint(updated);
      setAssignModalOpen(false);
      success(
        `Assigned to ${staffMember.name} (${selectedDepartment})`,
        'Staff Assigned'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to assign staff';
      toastError(msg, 'Error');
      console.error(err);
    } finally {
      setIsAssigning(false);
    }
  };

  // Handler: Priority Update Submit
  const handlePrioritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;

    setIsUpdatingPriority(true);
    try {
      const updated = await complaintService.updatePriority(
        complaint.id,
        selectedPriority,
        true // notify student
      );
      setComplaint(updated);
      setPriorityModalOpen(false);
      success(`Priority adjusted to ${selectedPriority.toUpperCase()}`, 'Priority Updated');
    } catch (err) {
      toastError('Failed to update priority', 'Error');
      console.error(err);
    } finally {
      setIsUpdatingPriority(false);
    }
  };

  // Handler: Post Note or Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !newCommentText.trim()) return;

    setIsAddingComment(true);
    try {
      const updated = await complaintService.addComment(
        complaint.id,
        newCommentText.trim(),
        commentIsInternal
      );
      setComplaint(updated);
      setNewCommentText('');
      success(
        commentIsInternal
          ? 'Internal staff note recorded (hidden from student)'
          : 'Public update sent to student',
        'Note Appended'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add note';
      toastError(msg, 'Error');
      console.error(err);
    } finally {
      setIsAddingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <SkeletonLoader variant="text" width={200} height={24} />
        <SkeletonLoader variant="card" height={160} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <SkeletonLoader variant="card" height={220} />
            <SkeletonLoader variant="card" height={300} />
          </div>
          <div>
            <SkeletonLoader variant="card" height={350} />
          </div>
        </div>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={<AlertCircle className="w-10 h-10 text-rose-500" />}
          title="Complaint Record Not Found"
          description={`Complaint identifier "${id}" could not be located in the database.`}
          action={
            <Button size="sm" onClick={() => navigate('/admin/complaints')}>
              Return to Complaint Management
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => navigate('/admin/complaints')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Complaint Management</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPriorityModalOpen(true)}
            className="h-8 text-xs"
          >
            Change Priority
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignModalOpen(true)}
            className="h-8 text-xs"
            leftIcon={<UserCheck className="w-3.5 h-3.5" />}
          >
            Assign Staff
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setStatusModalOpen(true)}
            className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
            leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
          >
            Update Status
          </Button>
        </div>
      </div>

      {/* Hero Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md">
                  {complaint.ticketNumber}
                </span>
                <Badge variant={complaint.priority} size="md">
                  {complaint.priority.toUpperCase()} PRIORITY
                </Badge>
                <Badge variant={complaint.status} size="md" dot>
                  {complaint.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium capitalize text-xs">
                  {complaint.category}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                {complaint.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Reported by {complaint.studentName}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {complaint.location || `${complaint.building || 'Campus'} ${complaint.roomNumber || ''}`.trim()}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(complaint.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="shrink-0 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1 min-w-[200px]">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Assigned Technician
              </span>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {complaint.assignedStaffName || 'Unassigned'}
              </p>
              {complaint.assignedDepartment && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {complaint.assignedDepartment} Department
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Left Details & Audit Trail / Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Detailed Description & Location Metadata */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold">Complaint Information</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Student Description
                </h4>
                <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap bg-slate-50/50 dark:bg-slate-800/30 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  {complaint.description}
                </p>
              </div>

              {/* Location Specification Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Building</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {complaint.building || 'Campus'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Floor</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {complaint.floor || 'Ground'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Room / Space</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {complaint.roomNumber || 'General'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Additional Notes</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {complaint.additionalDetails || 'None'}
                  </p>
                </div>
              </div>

              {/* Attached Images */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Uploaded Photo Evidence
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    {complaint.attachments && complaint.attachments.length > 0
                      ? `${complaint.attachments.length} attachment(s)`
                      : 'No attachments'}
                  </span>
                </div>

                {complaint.attachments && complaint.attachments.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                    {complaint.attachments.map((img, idx) => (
                      <div
                        key={idx}
                        onClick={() => setPreviewImage(img)}
                        className="group relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 cursor-pointer shadow-xs hover:shadow-md transition-shadow"
                      >
                        <img
                          src={img}
                          alt={`Attachment ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Maximize2 className="w-5 h-5" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    Student did not attach photo evidence for this request.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Add Public Update or Internal Note Panel */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold">Post Update or Internal Note</CardTitle>
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setCommentIsInternal(true)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      commentIsInternal
                        ? 'bg-amber-500 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Internal Note (Private)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommentIsInternal(false)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                      !commentIsInternal
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    <span>Public Update (Student)</span>
                  </button>
                </div>
              </div>
              <CardDescription className="text-xs">
                {commentIsInternal
                  ? '🔒 Internal notes are strictly visible to admins and facility staff only. Students will NEVER see this note.'
                  : '🌐 Public updates will be visible to the student on their portal timeline, and they will receive a notification.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleAddComment} className="space-y-3">
                <Textarea
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder={
                    commentIsInternal
                      ? 'Add confidential note for facility staff (e.g. ordered replacement fuse, waiting on vendor)...'
                      : 'Send a visible update to the student (e.g. technician is on the way)...'
                  }
                  rows={3}
                  required
                />
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    Posting as Administrator
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    variant="primary"
                    isLoading={isAddingComment}
                    className={
                      commentIsInternal
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }
                    rightIcon={<Send className="w-3.5 h-3.5" />}
                  >
                    {commentIsInternal ? 'Post Internal Staff Note' : 'Send Public Update'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Timeline & Audit Trail */}
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Lifecycle Audit Trail & Notes</CardTitle>
                  <CardDescription className="text-xs">
                    Complete chronological history of events, status transitions, and administrative notes
                  </CardDescription>
                </div>
                <Badge variant="outline" size="sm" className="font-mono text-xs">
                  {complaint.timeline.length} Events
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {complaint.timeline.map((event) => (
                  <div key={event.id} className="relative space-y-1">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                        event.isInternal
                          ? 'bg-amber-500'
                          : event.status === 'resolved'
                          ? 'bg-emerald-500'
                          : 'bg-indigo-600'
                      }`}
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      {event.isInternal ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-semibold text-[11px] border border-amber-200 dark:border-amber-900/40">
                          <Lock className="w-3 h-3" />
                          <span>Internal Staff Note</span>
                        </span>
                      ) : (
                        <Badge variant={event.status} size="sm">
                          {event.status.replace('_', ' ')}
                        </Badge>
                      )}

                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {event.updatedBy}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({event.role}) • {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p
                      className={`text-xs p-2.5 rounded-lg mt-1 ${
                        event.isInternal
                          ? 'bg-amber-50/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 border border-amber-200/60 dark:border-amber-900/30 font-medium'
                          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-800/60'
                      }`}
                    >
                      {event.message}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Student Info & Operational Actions */}
        <div className="space-y-6">
          {/* Student Profile Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold">Student Information</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-sm">
                  {(complaint.studentName || 'S').charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {complaint.studentName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    ID: {complaint.studentCollegeId || complaint.studentId}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {complaint.studentEmail || 'Email unavailable'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Department</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    {complaint.department || 'Computer Science & Engineering'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Contact Preference</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200">
                    Portal Alerts & College Email
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Operations Action Card */}
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-base font-bold">Administrative Actions</CardTitle>
              <CardDescription className="text-xs">
                Direct incident triage and work delegation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start h-9 text-xs"
                leftIcon={<ShieldCheck className="w-4 h-4 text-indigo-600" />}
                onClick={() => setStatusModalOpen(true)}
              >
                Change Operational Status
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-9 text-xs"
                leftIcon={<UserCheck className="w-4 h-4 text-purple-600" />}
                onClick={() => setAssignModalOpen(true)}
              >
                Assign Staff & Department
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start h-9 text-xs"
                leftIcon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                onClick={() => setPriorityModalOpen(true)}
              >
                Adjust Urgency / Priority
              </Button>
            </CardContent>
          </Card>

          {/* Resolution / Satisfaction Summary */}
          {complaint.satisfaction && (
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-base font-bold">Student Feedback</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Rating:</span>
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full font-bold text-xs ${
                      complaint.satisfaction.rating === 'satisfied'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {complaint.satisfaction.rating === 'satisfied' ? 'Satisfied 😊' : 'Not Satisfied 🙁'}
                  </span>
                </div>
                {complaint.satisfaction.feedback && (
                  <p className="text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                    "{complaint.satisfaction.feedback}"
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Recorded on {new Date(complaint.satisfaction.submittedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* MODAL 1: STATUS UPDATE MODAL */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Update Complaint Status</span>
          </div>
        }
        description={`Transition status and append an audit event to ticket ${complaint.ticketNumber}.`}
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              New Status
            </label>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as ComplaintStatus)}
              options={[
                { value: 'pending', label: 'Pending (Triage)' },
                { value: 'assigned', label: 'Assigned (Staff Allocated)' },
                { value: 'in_progress', label: 'In Progress (Active Service)' },
                { value: 'resolved', label: 'Resolved (Issue Solved)' },
                { value: 'rejected', label: 'Rejected (Denied / Invalid)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Status Change Comment
            </label>
            <Textarea
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="e.g. Technician arrived on site; verified circuit breaker trip."
              rows={3}
              required
            />
          </div>

          {/* Visibility Option: Public vs Internal */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
            <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Note Visibility & Privacy
            </span>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={!statusIsInternal}
                  onChange={() => setStatusIsInternal(false)}
                  className="text-indigo-600"
                />
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Public (Visible to Student)
                </span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={statusIsInternal}
                  onChange={() => {
                    setStatusIsInternal(true);
                    setStatusNotifyStudent(false); // disable notify if internal
                  }}
                  className="text-amber-600"
                />
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  Internal Note (Staff Only 🔒)
                </span>
              </label>
            </div>
          </div>

          {/* Student Notification Checkbox */}
          {!statusIsInternal && (
            <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={statusNotifyStudent}
                  onChange={(e) => setStatusNotifyStudent(e.target.checked)}
                  className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                    Notify student immediately
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Dispatches an in-portal notification to {complaint.studentName}.
                  </span>
                </div>
              </label>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdatingStatus}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Save Status Transition
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ASSIGN STAFF & DEPARTMENT MODAL */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-purple-600" />
            <span>Assign Maintenance Staff & Department</span>
          </div>
        }
        description={`Allocate a designated campus technician and service department to ticket ${complaint.ticketNumber}.`}
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Service Department
            </label>
            <Select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              options={MOCK_DEPARTMENTS.map((dept) => ({
                value: dept,
                label: `${dept} Department`,
              }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Assign Staff Member
            </label>
            <Select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              options={staffMembers.map((staff) => ({
                value: staff.id,
                label: `${staff.name} — ${staff.designation || 'Staff'} (${staff.department || 'General'})`,
              }))}
            />
          </div>

          {complaint.status === 'pending' && (
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200">
              <p className="font-semibold">Note on Workflow Transition:</p>
              <p className="mt-0.5 text-[11px]">
                This ticket is currently <strong>Pending</strong>. Assigning staff will automatically transition its status to <strong>Assigned</strong>.
              </p>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={assignNotifyStudent}
                onChange={(e) => setAssignNotifyStudent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Notify student of assignment
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Sends an automated notification with the technician's details to the student.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAssignModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isAssigning}
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              Confirm Assignment
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: PRIORITY CHANGE MODAL */}
      <Modal
        isOpen={priorityModalOpen}
        onClose={() => setPriorityModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Change Ticket Priority</span>
          </div>
        }
        description={`Adjust the urgency classification for ticket ${complaint.ticketNumber}.`}
      >
        <form onSubmit={handlePrioritySubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Priority Level
            </label>
            <Select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as Priority)}
              options={[
                { value: 'low', label: 'Low — Non-urgent standard maintenance' },
                { value: 'medium', label: 'Medium — Normal campus operations' },
                { value: 'high', label: 'High — Significant inconvenience or partial outage' },
                { value: 'critical', label: 'Critical — Emergency hazard or complete utility failure' },
              ]}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPriorityModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdatingPriority}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Update Priority
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: IMAGE LIGHTBOX / PREVIEW */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-transparent rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-900/80 text-white hover:bg-slate-900 transition-colors shadow-lg z-10"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Evidence Full Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
