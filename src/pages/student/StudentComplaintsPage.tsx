import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, PlusCircle, Filter } from 'lucide-react';
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
} from '@/components/common';
import { useComplaints } from '@/hooks/useComplaints';
import type { ComplaintStatus, Priority } from '@/types';

export const StudentComplaintsPage: React.FC = () => {
  const { complaints, loading } = useComplaints();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const filtered = complaints.filter((c) => {
    const matchesSearch =
      search === '' ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      (c.location && c.location.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || c.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedItems = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            My Complaints
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track and view status updates for your submitted maintenance requests.
          </p>
        </div>
        <Link to="/student/complaints/new">
          <Button size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
            New Complaint
          </Button>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Search by ticket or title..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />

            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ComplaintStatus | 'all');
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Statuses' },
                { value: 'pending', label: 'Pending (Amber)' },
                { value: 'assigned', label: 'Assigned (Violet)' },
                { value: 'in_progress', label: 'In Progress (Blue)' },
                { value: 'resolved', label: 'Resolved (Emerald)' },
                { value: 'rejected', label: 'Rejected (Rose)' },
              ]}
            />

            <Select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as Priority | 'all');
                setCurrentPage(1);
              }}
              options={[
                { value: 'all', label: 'All Priorities' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {/* Complaints List / Table */}
      <Card>
        <CardContent className="p-0">
          {paginatedItems.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Filter className="w-6 h-6" />}
                title="No complaints found"
                description="No maintenance requests matched your search criteria. Try resetting filters."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                      setPriorityFilter('all');
                    }}
                  >
                    Clear Filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Ticket</th>
                    <th className="px-5 py-3 font-semibold">Title & Category</th>
                    <th className="px-5 py-3 font-semibold">Priority</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Submitted</th>
                    <th className="px-5 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedItems.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-medium text-slate-700 dark:text-slate-300">
                        {c.ticketNumber}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {c.title}
                        </p>
                        <p className="text-[11px] text-slate-400 capitalize">
                          {c.category} • {c.location || 'Campus'}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={c.priority} size="sm">
                          {c.priority}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={c.status} size="sm" dot>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link to={`/student/complaints/${c.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs">
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={(page) => setCurrentPage(page)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
