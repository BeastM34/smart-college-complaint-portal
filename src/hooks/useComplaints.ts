import { useState, useEffect, useCallback } from 'react';
import type { Complaint, FilterOptions, ComplaintStatus } from '@/types';
import { complaintService } from '@/services/complaintService';

export function useComplaints(initialFilter?: FilterOptions) {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterOptions | undefined>(initialFilter);

  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await complaintService.getComplaints(filter);
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
