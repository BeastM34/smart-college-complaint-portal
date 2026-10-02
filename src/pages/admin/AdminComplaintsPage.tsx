import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  CheckSquare,
  Square,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldCheck,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  Select,
  Badge,
  EmptyState,
  Pagination,
  Modal,
  SkeletonLoader,
} from '@/components/common';
import { complaintService } from '@/services/complaintService';
import { useToast } from '@/hooks/useToast';
import type { Complaint, ComplaintStatus, Priority } from '@/types';

type SortOption = 'newest' | 'oldest' | 'priority_desc' | 'priority_asc' | 'ticket_asc';
type DateFilter = 'all' | 'today' | 'week' | 'month';

export const AdminComplaintsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters initialized from URL or defaults
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>(
    (searchParams.get('status') as ComplaintStatus | 'all') || 'all'
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>(
    (searchParams.get('priority') as Priority | 'all') || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>(
    searchParams.get('category') || 'all'
  );
  const [dateFilter, setDateFilter] = useState<DateFilter>(
    (searchParams.get('date') as DateFilter) || 'all'
  );
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<ComplaintStatus>('in_progress');
  const [bulkComment, setBulkComment] = useState('');
  const [bulkNotifyStudent, setBulkNotifyStudent] = useState(true);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Load complaints
  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await complaintService.getComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  // Update query params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (priorityFilter !== 'all') params.set('priority', priorityFilter);
    if (categoryFilter !== 'all') params.set('category', categoryFilter);
    if (dateFilter !== 'all') params.set('date', dateFilter);
    setSearchParams(params, { replace: true });
  }, [search, statusFilter, priorityFilter, categoryFilter, dateFilter, setSearchParams]);

  // Unique categories in dataset
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    complaints.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [complaints]);

  // Filtering & Sorting
  const filteredAndSortedComplaints = useMemo(() => {
    let result = [...complaints];

    // Search query
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.ticketNumber.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.studentName.toLowerCase().includes(q) ||
          (c.studentEmail && c.studentEmail.toLowerCase().includes(q)) ||
          (c.location && c.location.toLowerCase().includes(q)) ||
          (c.assignedStaffName && c.assignedStaffName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((c) => c.priority === priorityFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((c) => c.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = Date.now();
      result = result.filter((c) => {
        const created = new Date(c.createdAt).getTime();
        const diff = now - created;
        if (dateFilter === 'today') return diff <= 24 * 60 * 60 * 1000;
        if (dateFilter === 'week') return diff <= 7 * 24 * 60 * 60 * 1000;
        if (dateFilter === 'month') return diff <= 30 * 24 * 60 * 60 * 1000;
        return true;
      });
    }

    // Sorting
    const priorityWeights: Record<Priority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'priority_desc') {
        return priorityWeights[b.priority] - priorityWeights[a.priority];
      }
      if (sortBy === 'priority_asc') {
        return priorityWeights[a.priority] - priorityWeights[b.priority];
      }
      if (sortBy === 'ticket_asc') {
        return a.ticketNumber.localeCompare(b.ticketNumber);
      }
      return 0;
    });

    return result;
  }, [complaints, search, statusFilter, priorityFilter, categoryFilter, dateFilter, sortBy]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredAndSortedComplaints.length / pageSize) || 1;
  const paginatedComplaints = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedComplaints.slice(start, start + pageSize);
  }, [filteredAndSortedComplaints, currentPage, pageSize]);

  // Bulk selection helpers
  const allCurrentPageSelected =
    paginatedComplaints.length > 0 &&
    paginatedComplaints.every((c) => selectedIds.includes(c.id));

  const toggleSelectAllCurrentPage = () => {
    if (allCurrentPageSelected) {
      const pageIds = new Set(paginatedComplaints.map((c) => c.id));
      setSelectedIds(selectedIds.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = paginatedComplaints.map((c) => c.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...pageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setCategoryFilter('all');
    setDateFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
    setSelectedIds([]);
  };

  // Bulk update handler
  const handleBulkStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;

    setIsSubmittingBulk(true);
    try {
      await complaintService.bulkUpdateStatus(
        selectedIds,
        bulkStatus,
        bulkComment.trim() || `Bulk updated to ${bulkStatus.replace('_', ' ').toUpperCase()} by administrator.`,
        bulkNotifyStudent
      );
      success(
        `Successfully updated ${selectedIds.length} complaint(s) to ${bulkStatus.toUpperCase()}`,
        'Bulk Update Complete'
      );
      setBulkModalOpen(false);
      setSelectedIds([]);
      setBulkComment('');
      await loadComplaints();
    } catch (err) {
      toastError('Failed to execute bulk update', 'Error');
      console.error(err);
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Complaint Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Search, triage, assign technicians, and execute bulk operations across all student complaints.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {filteredAndSortedComplaints.length} of {complaints.length} Complaints
          </Badge>
        </div>
      </div>

      {/* Filter and Control Card */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Search Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by ticket #, student name, location, keyword..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            <div>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                options={[
                  { value: 'newest', label: 'Sort: Newest First' },
                  { value: 'oldest', label: 'Sort: Oldest First' },
                  { value: 'priority_desc', label: 'Sort: Priority (High to Low)' },
                  { value: 'priority_asc', label: 'Sort: Priority (Low to High)' },
                  { value: 'ticket_asc', label: 'Sort: Ticket Number (A-Z)' },
                ]}
              />
            </div>
          </div>

          {/* Secondary Filters Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as ComplaintStatus | 'all');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Statuses' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'assigned', label: 'Assigned' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
              />
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Priority</label>
              <Select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as Priority | 'all');
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
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Category</label>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...availableCategories.map((cat) => ({
                    value: cat,
                    label: cat.charAt(0).toUpperCase() + cat.slice(1),
                  })),
                ]}
              />
            </div>

            {/* Date Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Date Range</label>
              <Select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as DateFilter);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Time' },
                  { value: 'today', label: 'Today (Past 24h)' },
                  { value: 'week', label: 'Past 7 Days' },
                  { value: 'month', label: 'Past 30 Days' },
                ]}
              />
            </div>
          </div>

          {/* Active Filter Indicators & Reset Button */}
          {(search ||
            statusFilter !== 'all' ||
            priorityFilter !== 'all' ||
            categoryFilter !== 'all' ||
            dateFilter !== 'all') && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Filtered view active • {filteredAndSortedComplaints.length} results found
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-7 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Reset All Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Action Sticky Bar (Visible when 1+ selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-purple-900 text-white shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold text-sm">
              {selectedIds.length}
            </div>
            <div>
              <p className="text-xs font-semibold">
                {selectedIds.length} complaint{selectedIds.length > 1 ? 's' : ''} selected
              </p>
              <p className="text-[11px] text-purple-200">
                Execute batch operational status update across selected tickets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="border-white/30 text-white hover:bg-white/10 h-8 text-xs"
            >
              Deselect All
            </Button>
            <Button
              size="sm"
              onClick={() => setBulkModalOpen(true)}
              className="bg-white text-purple-950 hover:bg-purple-100 font-bold shadow-xs h-8 text-xs"
              leftIcon={<Layers className="w-3.5 h-3.5" />}
            >
              Bulk Update Status
            </Button>
          </div>
        </div>
      )}

      {/* Main Complaints Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <SkeletonLoader key={i} variant="card" height={48} />
              ))}
            </div>
          ) : filteredAndSortedComplaints.length === 0 ? (
            <div className="p-12">
              <EmptyState
                icon={<Filter className="w-8 h-8 text-slate-400" />}
                title="No complaints match criteria"
                description="We couldn't find any complaints matching your search parameters. Try clearing filters or altering search terms."
                action={
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800 select-none">
                  <tr>
                    {/* Bulk Selection Checkbox */}
                    <th className="w-10 px-4 py-3.5">
                      <button
                        type="button"
                        onClick={toggleSelectAllCurrentPage}
                        className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                        title={allCurrentPageSelected ? 'Deselect page' : 'Select entire page'}
                      >
                        {allCurrentPageSelected ? (
                          <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="px-3 py-3.5 font-semibold">ID</th>
                    <th className="px-4 py-3.5 font-semibold">Student</th>
                    <th className="px-4 py-3.5 font-semibold">Title</th>
                    <th className="px-3 py-3.5 font-semibold">Category</th>
                    <th className="px-3 py-3.5 font-semibold">Location</th>
                    <th className="px-3 py-3.5 font-semibold">Priority</th>
                    <th className="px-3 py-3.5 font-semibold">Status</th>
                    <th className="px-4 py-3.5 font-semibold">Assigned To</th>
                    <th className="px-3 py-3.5 font-semibold">Date</th>
                    <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedComplaints.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors ${
                          isSelected
                            ? 'bg-purple-50/50 dark:bg-purple-950/20'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Row Checkbox */}
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(c.id)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* ID */}
                        <td className="px-3 py-3.5 font-mono font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {c.ticketNumber}
                        </td>

                        {/* Student */}
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {c.studentName}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]">
                            {c.studentEmail || c.department || 'Student'}
                          </p>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {c.title}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-xs">
                            {c.description}
                          </p>
                        </td>

                        {/* Category */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium capitalize text-[11px]">
                            {c.category}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-3 py-3.5 text-slate-600 dark:text-slate-300 max-w-[120px] truncate">
                          {c.location || `${c.building || 'Campus'} ${c.roomNumber || ''}`.trim()}
                        </td>

                        {/* Priority */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <Badge variant={c.priority} size="sm">
                            {c.priority}
                          </Badge>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <Badge variant={c.status} size="sm" dot>
                            {c.status.replace('_', ' ')}
                          </Badge>
                        </td>

                        {/* Assigned To */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {c.assignedStaffName ? (
                            <div>
                              <p className="font-medium text-slate-800 dark:text-slate-200">
                                {c.assignedStaffName}
                              </p>
                              {c.assignedDepartment && (
                                <p className="text-[10px] text-slate-400">
                                  {c.assignedDepartment}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Date */}
                        <td className="px-3 py-3.5 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                          {new Date(c.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <Link to={`/admin/complaints/${c.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-medium"
                              rightIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              Review
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredAndSortedComplaints.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                Showing{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {(currentPage - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {Math.min(currentPage * pageSize, filteredAndSortedComplaints.length)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {filteredAndSortedComplaints.length}
                </span>{' '}
                complaints
              </span>

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredAndSortedComplaints.length}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Status Update Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-600" />
            <span>Bulk Status Update</span>
          </div>
        }
        description={`Apply operational status transition simultaneously across ${selectedIds.length} selected complaints.`}
      >
        <form onSubmit={handleBulkStatusSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              New Status
            </label>
            <Select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as ComplaintStatus)}
              options={[
                { value: 'pending', label: 'Pending (Triage)' },
                { value: 'assigned', label: 'Assigned' },
                { value: 'in_progress', label: 'In Progress (Active Work)' },
                { value: 'resolved', label: 'Resolved (Issue Rectified)' },
                { value: 'rejected', label: 'Rejected (Invalid / Duplicate)' },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Audit Note / Resolution Comment
            </label>
            <Input
              value={bulkComment}
              onChange={(e) => setBulkComment(e.target.value)}
              placeholder="e.g. Batch inspected by facility maintenance team."
              required
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={bulkNotifyStudent}
                onChange={(e) => setBulkNotifyStudent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Notify affected students
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  Sends an in-portal notification to each student informing them of the status change.
                </span>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmittingBulk}
              className="bg-purple-700 hover:bg-purple-800 text-white"
            >
              Confirm Bulk Update ({selectedIds.length})
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
