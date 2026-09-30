import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, UserCheck, ShieldCheck, MapPin, Calendar, Clock, AlertCircle } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Select,
  Input,
  Textarea,
  SkeletonLoader,
  EmptyState,
} from '@/components/common';
import { complaintService } from '@/services/complaintService';
import { useToast } from '@/hooks/useToast';
import type { Complaint, ComplaintStatus } from '@/types';

export const AdminComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success } = useToast();

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus>('in_progress');
  const [statusNote, setStatusNote] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('Robert Vance');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    complaintService
      .getComplaintById(id)
      .then((data) => {
        setComplaint(data);
        if (data) {
          setSelectedStatus(data.status);
          if (data.assignedStaffName) {
            setAssignedStaff(data.assignedStaffName);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    setUpdating(true);
    try {
      const updated = await complaintService.updateComplaintStatus(
        complaint.id,
        selectedStatus,
        statusNote.trim() || `Status updated to ${selectedStatus.replace('_', ' ')} by Admin.`
      );
      setComplaint(updated);
      setStatusNote('');
      success(`Ticket status updated to ${selectedStatus.toUpperCase()}`, 'Status Changed');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignStaff = async () => {
    if (!complaint) return;
    setUpdating(true);
    try {
      const updated = await complaintService.assignComplaint(
        complaint.id,
        'user-staff-1',
        assignedStaff
      );
      setComplaint(updated);
      success(`Ticket assigned to ${assignedStaff}`, 'Staff Assigned');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <SkeletonLoader variant="text" width={220} height={28} />
        <SkeletonLoader variant="card" />
        <SkeletonLoader variant="card" />
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Ticket Not Found"
          description={`Complaint with ID "${id}" could not be located.`}
          action={
            <Button size="sm" onClick={() => navigate('/admin/complaints')}>
              Return to Complaints
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/admin/complaints')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Complaint Roster</span>
        </button>

        <div className="flex items-center gap-2">
          <Badge variant={complaint.priority} size="sm">
            {complaint.priority} Priority
          </Badge>
          <Badge variant={complaint.status} size="sm" dot>
            {complaint.status.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Ticket Details */}
      <Card>
        <CardHeader className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Ticket: {complaint.ticketNumber}</span>
            <span>•</span>
            <span className="capitalize">{complaint.category}</span>
          </div>
          <CardTitle className="text-xl font-bold">
            {complaint.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400">Student</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.studentName}
              </p>
              <p className="text-[10px] text-slate-400">{complaint.studentEmail}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400">Location</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.location || 'Campus'}
              </p>
              <p className="text-[10px] text-slate-400">{complaint.roomNumber || 'Common Area'}</p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400">Assigned Technician</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.assignedStaffName || 'Unassigned'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400">Logged On</span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {new Date(complaint.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Student Description
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {complaint.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Admin Action Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assign Staff Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <CardTitle>Assign Maintenance Staff</CardTitle>
            </div>
            <CardDescription>
              Dispatch designated technician or maintenance contractor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Select Technician"
              value={assignedStaff}
              onChange={(e) => setAssignedStaff(e.target.value)}
              options={[
                { value: 'Robert Vance', label: 'Robert Vance (Electrical / HVAC)' },
                { value: 'Marcus Brody', label: 'Marcus Brody (Plumbing / Sanitation)' },
                { value: 'Elena Rostova', label: 'Elena Rostova (Civil / Carpentry)' },
                { value: 'Devon Miles', label: 'Devon Miles (Audio/Visual & IT)' },
              ]}
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              isLoading={updating}
              onClick={handleAssignStaff}
            >
              Update Assignment
            </Button>
          </CardContent>
        </Card>

        {/* Update Status Panel */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <CardTitle>Update Status & Resolution</CardTitle>
            </div>
            <CardDescription>
              Transition status and append an audit message to the timeline.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdateStatus}>
            <CardContent className="space-y-3">
              <Select
                label="New Status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ComplaintStatus)}
                options={[
                  { value: 'pending', label: 'Pending (Amber)' },
                  { value: 'assigned', label: 'Assigned (Violet)' },
                  { value: 'in_progress', label: 'In Progress (Blue)' },
                  { value: 'resolved', label: 'Resolved (Emerald)' },
                  { value: 'rejected', label: 'Rejected (Rose)' },
                ]}
              />

              <Input
                label="Resolution / Audit Note"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g. Technician replaced split AC capacitor."
              />

              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="w-full"
                isLoading={updating}
              >
                Apply Status Change
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>

      {/* Timeline audit trail */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {complaint.timeline.map((event) => (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-purple-600 dark:bg-purple-400 shadow-xs" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={event.status} size="sm">
                    {event.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {event.updatedBy}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({event.role}) • {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 pl-0.5">
                  {event.message}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
