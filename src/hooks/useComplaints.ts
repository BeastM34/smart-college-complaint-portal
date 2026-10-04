import { useState, useEffect, useCallback } from 'react';
import type { Complaint, FilterOptions, ComplaintStatus } from '@/types';
import { complaintService } from '@/services/complaintService';
import { authService } from '@/services/authService';

export function useComplaints(initialFilter?: FilterOptions) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOptions | undefined>(initialFilter);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentUser = authService.getCurrentUser();
      let data: Complaint[] = [];

      if (!currentUser) {
        data = [];
      } else if (currentUser.role === 'student') {
        data = await complaintService.getStudentComplaints(currentUser.id);
        if (filter) {
          if (filter.status && filter.status !== 'all') {
            data = data.filter((c) => c.status === filter.status);
          }
          if (filter.priority && filter.priority !== 'all') {
            data = data.filter((c) => c.priority === filter.priority);
          }
          if (filter.category && filter.category !== 'all') {
            data = data.filter((c) => c.category === filter.category);
          }
          if (filter.searchQuery && filter.searchQuery.trim() !== '') {
            const q = filter.searchQuery.toLowerCase();
            data = data.filter(
              (c) =>
                c.title.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q) ||
                c.ticketNumber.toLowerCase().includes(q) ||
                (c.location && c.location.toLowerCase().includes(q))
            );
          }
        }
      } else if (currentUser.role === 'staff') {
        data = await complaintService.getStaffComplaints(currentUser.id);
      } else {
        data = await complaintService.getComplaints(filter);
      }

      setComplaints(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch complaints';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const updateStatus = async (id: string, status: ComplaintStatus, message: string) => {
    const updated = await complaintService.updateComplaintStatus(id, status, message);
    setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  const assign = async (id: string, staffId: string, staffName: string) => {
    const updated = await complaintService.assignComplaint(id, staffId, staffName);
    setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  };

  return {
    complaints,
    loading,
    error,
    reload: fetchComplaints,
    filter,
    setFilter,
    updateStatus,
    assign,
  };
}
