import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  PlusCircle,
  Filter,
  Calendar,
  MapPin,
  Clock,
  ArrowRight,
  ExternalLink,
  Layers,
  LayoutGrid,
  List,
  RotateCcw,
  Sparkles,
  Building,
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
  SkeletonLoader,
} from '@/components/common';
import { useComplaints } from '@/hooks/useComplaints';
import { useAuth } from '@/hooks/useAuth';
import type { ComplaintStatus, Priority, ComplaintCategory } from '@/types';

type SortOption = 'newest' | 'oldest' | 'updated' | 'priority';
type ViewMode = 'table' | 'cards';

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'wifi_internet', label: 'Wi-Fi / Internet' },
  { value: 'classroom', label: 'Classroom' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'cleanliness', label: 'Cleanliness' },
  { value: 'washroom', label: 'Washroom' },
  { value: 'water_supply', label: 'Water Supply' },
  { value: 'security', label: 'Security' },
  { value: 'hostel', label: 'Hostel Maintenance' },
  { value: 'academic', label: 'Academic & Labs' },
  { value: 'library', label: 'Library' },
  { value: 'canteen', label: 'Canteen' },
  { value: 'transport', label: 'Campus Transport' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_ORDER: Record<Priority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const StudentComplaintsPage: React.FC = () => {
  const { user } = useAuth();
  const { complaints, loading } = useComplaints();

  // Filters & State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Filter complaints strictly belonging to the logged-in student
  const studentComplaints = useMemo(() => {
    return complaints.filter(
      (c) =>
        !user ||
        c.studentId === user.id ||
        (user.studentId && c.studentId === user.studentId) ||
        (c.studentEmail && user.email && c.studentEmail.toLowerCase() === user.email.toLowerCase())
    );
  }, [complaints, user]);

  // Apply Search, Filters, and Sorting
  const filteredAndSorted = useMemo(() => {
    let result = studentComplaints.filter((c) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        q === '' ||
        c.title.toLowerCase().includes(q) ||
        c.ticketNumber.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (c.location && c.location.toLowerCase().includes(q)) ||
        (c.building && c.building.toLowerCase().includes(q)) ||
        (c.roomNumber && c.roomNumber.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesCategory =
        categoryFilter === 'all' ||
        c.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'updated') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      }
      return 0;
    });

    return result;
  }, [studentComplaints, search, statusFilter, categoryFilter, priorityFilter, sortBy]);

  // Pagination slicing
  const totalPages = Math.ceil(filteredAndSorted.length / pageSize) || 1;
  const paginatedItems = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const isFiltering =
    search.trim() !== '' ||
    statusFilter !== 'all' ||
    categoryFilter !== 'all' ||
    priorityFilter !== 'all';

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setPriorityFilter('all');
    setSortBy('newest');
    setCurrentPage(1);
  };

  const formatStatus = (status: ComplaintStatus) => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const formatCategory = (cat: ComplaintCategory) => {
    return cat.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              My Complaints
            </h1>
            <Badge variant="default" size="sm">
              {studentComplaints.length} Total
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Track and monitor resolution progress across all maintenance tickets submitted under your student account.
          </p>
        </div>

        <Link to="/student/complaints/new" className="shrink-0">
          <Button size="md" variant="primary" leftIcon={<PlusCircle className="w-4 h-4" />}>
            Submit Complaint
          </Button>
        </Link>
      </div>

      {/* Filter, Search & View Toolbar Card */}
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Search and Main Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <Input
                placeholder="Search ticket, title, location..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                leftIcon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {/* Status Filter */}
            <div>
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

            {/* Category Filter */}
            <div>
              <Select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={CATEGORY_OPTIONS}
              />
            </div>

            {/* Priority Filter */}
            <div>
              <Select
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value as Priority | 'all');
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'all', label: 'All Priorities' },
                  { value: 'low', label: 'Low Priority' },
                  { value: 'medium', label: 'Medium Priority' },
                  { value: 'high', label: 'High Priority' },
                  { value: 'critical', label: 'Critical Priority' },
                ]}
              />
            </div>
          </div>

          {/* Secondary Controls: Sorting, View Toggle, Clear Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 font-medium">Sort by:</span>
              <div className="w-44">
                <Select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  options={[
                    { value: 'newest', label: 'Newest First' },
                    { value: 'oldest', label: 'Oldest First' },
                    { value: 'updated', label: 'Recently Updated' },
                    { value: 'priority', label: 'Priority (High to Low)' },
                  ]}
                />
              </div>

              {isFiltering && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors font-medium ml-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset filters</span>
                </button>
              )}
            </div>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md text-xs flex items-center gap-1.5 font-medium transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="Table View"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md text-xs flex items-center gap-1.5 font-medium transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
                title="Card View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Complaints Display Area */}
      {loading ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <SkeletonLoader count={6} height="3rem" />
          </CardContent>
        </Card>
      ) : studentComplaints.length === 0 ? (
        <EmptyState
          title="No complaints submitted yet"
          description="You have not logged any infrastructure or maintenance complaints under your student account."
          action={
            <Link to="/student/complaints/new">
              <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                Submit Your First Complaint
              </Button>
            </Link>
          }
        />
      ) : filteredAndSorted.length === 0 ? (
        <EmptyState
          title="No matching complaints found"
          description="None of your submitted tickets match the search query and selected filter options."
          action={
            <Button size="sm" variant="outline" onClick={handleResetFilters}>
              Reset Filters
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* TABLE VIEW */}
          {viewMode === 'table' ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold bg-slate-50/50 dark:bg-slate-900/50">
                      <th className="py-3 px-4">ID</th>
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Location</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4">Last Updated</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedItems.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {c.ticketNumber}
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          <Link
                            to={`/student/complaints/${c.id}`}
                            className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 block truncate transition-colors"
                          >
                            {c.title}
                          </Link>
                          <p className="text-[11px] text-slate-400 truncate max-w-sm">
                            {c.description}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="capitalize text-slate-700 dark:text-slate-300">
                            {formatCategory(c.category)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[130px]">{c.location || 'Campus'}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant={c.priority} size="sm">
                            {c.priority}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge variant={c.status} size="sm" dot>
                            {formatStatus(c.status)}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-[11px]">
                          {formatDate(c.createdAt)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {formatDate(c.updatedAt)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <Link to={`/student/complaints/${c.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5 font-medium"
                              rightIcon={<ExternalLink className="w-3 h-3" />}
                            >
                              View
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* CARD VIEW */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedItems.map((c) => (
                <Card key={c.id} hoverEffect className="flex flex-col justify-between">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {c.ticketNumber}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={c.priority} size="sm">
                          {c.priority}
                        </Badge>
                        <Badge variant={c.status} size="sm" dot>
                          {formatStatus(c.status)}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Link
                        to={`/student/complaints/${c.id}`}
                        className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1"
                      >
                        {c.title}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">
                        {c.description}
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.location || 'Campus'}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-400 pt-1">
                        <span>Submitted: {formatDate(c.createdAt)}</span>
                        <span>Updated: {formatDate(c.updatedAt)}</span>
                      </div>
                    </div>
                  </CardContent>

                  <div className="px-5 pb-5 pt-0">
                    <Link to={`/student/complaints/${c.id}`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs font-medium"
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        View Full Details
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => {
                  setCurrentPage(page);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
