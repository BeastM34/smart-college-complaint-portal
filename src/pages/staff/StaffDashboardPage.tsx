import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
  Sparkles,
  MapPin,
  Calendar,
  Building,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  SkeletonLoader,
  EmptyState,
  StatCard,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  Select,
  Textarea,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { complaintService } from '@/services/complaintService';
import { useToast } from '@/hooks/useToast';
import type { Complaint, ComplaintStatus } from '@/types';

export const StaffDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Quick status update modal state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [newStatus, setNewStatus] = useState<ComplaintStatus>('in_progress');
  const [statusMessage, setStatusMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const loadStaffData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await complaintService.getStaffComplaints(user.id);
      setComplaints(data);
    } catch (err: unknown) {
      console.error('Failed to load staff complaints:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  // Derive stats
  const totalAssigned = complaints.length;
  const pendingCount = complaints.filter((c) => c.status === 'assigned' || c.status === 'pending').length;
  const inProgressCount = complaints.filter((c) => c.status === 'in_progress').length;
  const resolvedCount = complaints.filter((c) => c.status === 'resolved').length;

  const filteredComplaints = complaints.filter((c) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return c.status === 'assigned' || c.status === 'pending';
    return c.status === statusFilter;
  });

  const handleOpenStatusModal = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(complaint.status === 'resolved' ? 'resolved' : 'in_progress');
    setStatusMessage('');
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!statusMessage.trim()) {
      toastError('Please provide an update note explaining the status change.', 'Note Required');
      return;
    }

    setIsUpdating(true);
    try {
      const updated = await complaintService.updateComplaintStatus(
        selectedComplaint.id,
        newStatus,
        statusMessage.trim()
      );
      setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      success(`Updated ticket ${updated.ticketNumber} to ${newStatus}`, 'Status Updated');
      setSelectedComplaint(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update status';
      toastError(msg, 'Update Failed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-teal-700 via-indigo-700 to-indigo-800 text-white shadow-md p-6 sm:p-7">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/95 text-xs font-medium backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Campus Facility & Maintenance Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome, {user?.name || 'Technician'}!
            </h1>
            <p className="text-sm text-indigo-100 max-w-2xl leading-relaxed">
              Department:{' '}
              <span className="font-semibold text-white">
                {user?.department || 'General Maintenance'}
              </span>{' '}
              • You currently have{' '}
              <span className="font-semibold text-amber-300">{pendingCount + inProgressCount}</span> active
              work orders requiring attention.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="md"
              leftIcon={<RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />}
              onClick={loadStaffData}
              className="bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-xs font-medium"
            >
              Refresh Queue
            </Button>
            <Link to="/staff/complaints">
              <Button
                variant="outline"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4 text-white" />}
                className="bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-xs font-medium"
              >
                Full Queue
              </Button>
            </Link>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Assigned Work Orders"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : totalAssigned}
          subtitle="Total assigned to your account"
          icon={<FileText className="w-5 h-5" />}
          variant="indigo"
          onClick={() => setStatusFilter('all')}
        />
        <StatCard
          title="Pending / Queued"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : pendingCount}
          subtitle="Waiting for service start"
          icon={<Clock className="w-5 h-5" />}
          variant="amber"
          onClick={() => setStatusFilter('pending')}
        />
        <StatCard
          title="In Progress"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : inProgressCount}
          subtitle="Active on-site repairs"
          icon={<Activity className="w-5 h-5" />}
          variant="blue"
          onClick={() => setStatusFilter('in_progress')}
        />
        <StatCard
          title="Resolved"
          value={loading ? <SkeletonLoader height="1.75rem" width="3rem" /> : resolvedCount}
          subtitle="Successfully signed off"
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="emerald"
          onClick={() => setStatusFilter('resolved')}
        />
      </div>

      {/* Assigned Complaints Table Section */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <div>
            <CardTitle>Assigned Work Orders</CardTitle>
            <CardDescription>
              Tickets directly assigned to your technician account. Update status as work progresses.
            </CardDescription>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 text-xs">
            {[
              { id: 'all', label: 'All' },
              { id: 'pending', label: 'Pending' },
              { id: 'in_progress', label: 'In Progress' },
              { id: 'resolved', label: 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <SkeletonLoader height="2.5rem" />
              <SkeletonLoader height="2.5rem" />
              <SkeletonLoader height="2.5rem" />
            </div>
          ) : filteredComplaints.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                title="No assigned tickets in this filter"
                description={
                  statusFilter === 'all'
                    ? 'You currently have no complaints assigned to your account.'
                    : `No work orders currently match the "${statusFilter}" status filter.`
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket</TableHead>
                  <TableHead>Title & Location</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComplaints.slice(0, 10).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      {c.ticketNumber}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <Link
                          to={`/staff/complaints/${c.id}`}
                          className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-1"
                        >
                          {c.title}
                        </Link>
                        {c.location && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{c.location}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-xs text-slate-600 dark:text-slate-300">
                        {c.category}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.priority} size="sm" dot>
                        {c.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.status} size="sm" dot>
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {c.status !== 'resolved' && c.status !== 'rejected' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenStatusModal(c)}
                            className="text-xs"
                          >
                            Update Status
                          </Button>
                        )}
                        <Link to={`/staff/complaints/${c.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            Details
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Status Update Modal */}
      <Modal
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        title={`Update Ticket ${selectedComplaint?.ticketNumber}`}
        description="Change workflow status and provide resolution documentation."
      >
        <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
          <Select
            label="Target Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ComplaintStatus)}
            options={[
              { value: 'in_progress', label: 'In Progress (Work started)' },
              { value: 'resolved', label: 'Resolved (Work completed)' },
              { value: 'rejected', label: 'Rejected (Cannot complete / Invalid)' },
            ]}
            required
          />

          <Textarea
            label="Work Note / Resolution Summary"
            placeholder="Explain what repair or inspection was conducted..."
            value={statusMessage}
            onChange={(e) => setStatusMessage(e.target.value)}
            required
            rows={3}
            helperText="This note will be recorded in the ticket timeline for student and administrator tracking."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedComplaint(null)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isUpdating}
            >
              Save Status Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
