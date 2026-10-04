import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Input,
  Select,
  SkeletonLoader,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
  Modal,
  Textarea,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { complaintService } from '@/services/complaintService';
import { useToast } from '@/hooks/useToast';
import type { Complaint, ComplaintStatus, Priority } from '@/types';

export const StaffComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Status update modal
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [targetStatus, setTargetStatus] = useState<ComplaintStatus>('in_progress');
  const [updateNote, setUpdateNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAssigned = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await complaintService.getStaffComplaints(user.id);
      setComplaints(data);
    } catch (err: unknown) {
      console.error('Error fetching assigned complaints:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAssigned();
  }, [fetchAssigned]);

  // Filtered & sorted
  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesDesc = c.description.toLowerCase().includes(q);
        const matchesTicket = c.ticketNumber.toLowerCase().includes(q);
        const matchesLoc = c.location?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesTicket && !matchesLoc) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      const priorityOrder: Record<Priority, number> = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }, [complaints, statusFilter, priorityFilter, searchQuery, sortBy]);

  const totalPages = Math.ceil(filteredComplaints.length / itemsPerPage) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredComplaints.slice(start, start + itemsPerPage);
  }, [filteredComplaints, currentPage]);

  const handleOpenUpdate = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setTargetStatus(complaint.status === 'resolved' ? 'resolved' : 'in_progress');
    setUpdateNote('');
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedComplaint) return;
    if (!updateNote.trim()) {
      toastError('Please enter an explanatory work note.', 'Note Required');
      return;
    }

    setSubmitting(true);
    try {
      const updated = await complaintService.updateComplaintStatus(
        selectedComplaint.id,
        targetStatus,
        updateNote.trim()
      );
      setComplaints((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      success(`Updated ${updated.ticketNumber} to ${targetStatus}`, 'Status Updated');
      setSelectedComplaint(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update ticket status';
      toastError(msg, 'Update Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Assigned Work Orders
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            View and update the status of maintenance requests assigned to your department.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchAssigned}
        >
          Refresh Queue
        </Button>
      </div>

      {/* Filters Card */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Input
              placeholder="Search ticket, title, room..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />

            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
            />

            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Priorities' },
                { value: 'critical', label: 'Critical' },
                { value: 'high', label: 'High' },
                { value: 'medium', label: 'Medium' },
                { value: 'low', label: 'Low' },
              ]}
            />

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'priority')}
              options={[
                { value: 'newest', label: 'Sort: Newest First' },
                { value: 'oldest', label: 'Sort: Oldest First' },
                { value: 'priority', label: 'Sort: Highest Priority' },
              ]}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
            <span>
              Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{filteredComplaints.length}</span> tickets
            </span>
            {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCurrentPage(1);
                }}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Complaints Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              <SkeletonLoader height="2.5rem" />
              <SkeletonLoader height="2.5rem" />
              <SkeletonLoader height="2.5rem" />
            </div>
          ) : paginatedComplaints.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<SlidersHorizontal className="w-8 h-8 text-slate-400" />}
                title="No tickets found"
                description="No assigned complaints match the selected filter criteria."
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
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedComplaints.map((c) => (
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
                            onClick={() => handleOpenUpdate(c)}
                            className="text-xs"
                          >
                            Update
                          </Button>
                        )}
                        <Link to={`/staff/complaints/${c.id}`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            View
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Modal */}
      <Modal
        isOpen={Boolean(selectedComplaint)}
        onClose={() => setSelectedComplaint(null)}
        title={`Update Ticket ${selectedComplaint?.ticketNumber}`}
        description="Update maintenance ticket progress and log technical findings."
      >
        <form onSubmit={handleStatusSubmit} className="space-y-4">
          <Select
            label="Target Status"
            value={targetStatus}
            onChange={(e) => setTargetStatus(e.target.value as ComplaintStatus)}
            options={[
              { value: 'in_progress', label: 'In Progress (Active repair/inspection)' },
              { value: 'resolved', label: 'Resolved (Work completed and verified)' },
              { value: 'rejected', label: 'Rejected (Invalid ticket / Not feasible)' },
            ]}
            required
          />

          <Textarea
            label="Work Summary / Technician Note"
            placeholder="Describe action taken, replacement parts, or inspection results..."
            value={updateNote}
            onChange={(e) => setUpdateNote(e.target.value)}
            required
            rows={3}
            helperText="Recorded on public timeline visible to the reporting student."
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedComplaint(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
            >
              Save Update
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
