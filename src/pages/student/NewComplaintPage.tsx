import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, ArrowLeft, Info } from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Select,
  Textarea,
} from '@/components/common';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { complaintService } from '@/services/complaintService';
import type { Priority, ComplaintCategory } from '@/types';

export const NewComplaintPage: React.FC = () => {
  const { user } = useAuth();
  const { success } = useToast();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('hostel');
  const [priority, setPriority] = useState<Priority>('medium');
  const [location, setLocation] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await complaintService.createComplaint({
        title,
        category,
        priority,
        location,
        roomNumber,
        description,
        status: 'pending',
        studentId: user?.id || 'user-student-1',
        studentName: user?.name || 'Alex Johnson',
        studentEmail: user?.email || 'alex.johnson@campus.edu',
        department: user?.department || 'Computer Science',
      });
      success(`Ticket ${created.ticketNumber} submitted successfully!`, 'Complaint Logged');
      navigate(`/student/complaints/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back</span>
      </button>

      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 dark:bg-indigo-950/40 dark:border-indigo-900/60 flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
        <div>
          <p className="font-semibold">Submit Maintenance Request</p>
          <p className="text-slate-600 dark:text-slate-400 mt-0.5">
            Phase 1 supports local session persistence. Submissions immediately reflect across student & admin views.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Complaint Details</CardTitle>
          <CardDescription>
            Provide accurate details to help campus facilities triage and assign technicians quickly.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <Input
              label="Complaint Title / Brief Summary"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Washroom tap leaking on 3rd floor"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                options={[
                  { value: 'hostel', label: 'Hostel Maintenance' },
                  { value: 'electrical', label: 'Electrical & Power' },
                  { value: 'infrastructure', label: 'Campus Infrastructure' },
                  { value: 'sanitation', label: 'Sanitation & Hygiene' },
                  { value: 'academic', label: 'Academic & Labs' },
                  { value: 'library', label: 'Library & Reading Rooms' },
                  { value: 'canteen', label: 'Canteen & Food' },
                  { value: 'transport', label: 'Campus Transport' },
                  { value: 'other', label: 'Other' },
                ]}
              />

              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                options={[
                  { value: 'low', label: 'Low (Minor convenience)' },
                  { value: 'medium', label: 'Medium (Routine repair)' },
                  { value: 'high', label: 'High (Classroom / Lab impact)' },
                  { value: 'critical', label: 'Critical (Safety / Hazard / Flood)' },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Location / Building"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Boys Hostel Block 2"
              />
              <Input
                label="Room / Lab / Floor"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Room 314"
              />
            </div>

            <Textarea
              label="Detailed Description"
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue, when it started, and any symptoms or safety hazards..."
            />
          </CardContent>

          <CardFooter className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate('/student/complaints')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={submitting}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Ticket
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
