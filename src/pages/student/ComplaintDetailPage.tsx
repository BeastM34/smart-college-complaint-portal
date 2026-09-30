import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, User, MapPin, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, SkeletonLoader, EmptyState } from '@/components/common';
import { complaintService } from '@/services/complaintService';
import type { Complaint } from '@/types';

export const ComplaintDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    complaintService
      .getComplaintById(id)
      .then((data) => setComplaint(data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <SkeletonLoader variant="text" width={200} height={24} />
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
          title="Complaint not found"
          description={`Unable to locate ticket with identifier "${id}". It may have been archived or removed.`}
          action={
            <Button size="sm" onClick={() => navigate('/student/complaints')}>
              Back to My Complaints
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button & Ticket Number */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={() => navigate('/student/complaints')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Complaints</span>
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

      {/* Main Ticket Summary Card */}
      <Card>
        <CardHeader className="space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span>Ticket: {complaint.ticketNumber}</span>
            <span>•</span>
            <span className="capitalize">{complaint.category} Category</span>
          </div>
          <CardTitle className="text-xl font-bold">
            {complaint.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Location
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.location || 'Campus'}
                {complaint.roomNumber && ` (${complaint.roomNumber})`}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Submitted
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {new Date(complaint.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Assigned Staff
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {complaint.assignedStaffName || 'Pending Assignment'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Last Updated
              </span>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {new Date(complaint.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description
            </h4>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
              {complaint.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Progress Timeline Stepper */}
      <Card>
        <CardHeader>
          <CardTitle>Resolution Timeline & Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {complaint.timeline.map((event) => (
              <div key={event.id} className="relative space-y-1">
                {/* Dot */}
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 bg-indigo-600 dark:bg-indigo-400 shadow-xs" />

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
