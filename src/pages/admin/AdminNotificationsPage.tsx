import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  Send,
  Radio,
  Users,
  Building,
  User,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  CheckCheck,
  Shield,
  Layers,
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
  Textarea,
  Badge,
  EmptyState,
  SkeletonLoader,
} from '@/components/common';
import { notificationService } from '@/services/notificationService';
import { userService } from '@/services/userService';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/useToast';
import type { BroadcastNotification, User as UserType } from '@/types';

type AudienceType = 'all_students' | 'department' | 'student';
type PriorityType = 'info' | 'warning' | 'error';

export const AdminNotificationsPage: React.FC = () => {
  const { success, error: toastError } = useToast();
  const { notifications: adminAlerts, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  // Broadcast Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<AudienceType>('all_students');
  const [targetDepartment, setTargetDepartment] = useState<string>('Computer Science & Engineering');
  const [targetStudentId, setTargetStudentId] = useState<string>('');
  const [priority, setPriority] = useState<PriorityType>('info');
  const [sending, setSending] = useState(false);

  // Broadcast History State
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastNotification[]>([]);
  const [students, setStudents] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Tab: Broadcast Center vs Incoming Admin Alerts
  const [activeTab, setActiveTab] = useState<'broadcast' | 'alerts'>('broadcast');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [history, userList] = await Promise.all([
        notificationService.getBroadcastHistory(),
        userService.getUsers({ role: 'student' }),
      ]);
      setBroadcastHistory(history);
      setStudents(userList);
      if (userList.length > 0 && !targetStudentId) {
        setTargetStudentId(userList[0].id);
      }
    } catch (err) {
      console.error('Failed to load notifications page data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic list of student academic departments
  const academicDepartments = useMemo(() => {
    const studentDepts = students
      .map((s) => s.department?.trim())
      .filter((d): d is string => Boolean(d));

    const standardDepts = [
      'Computer Science & Engineering',
      'Electronics & Communication',
      'Mechanical Engineering',
      'Civil & Environmental Engineering',
      'Electrical & Electronics',
      'Information Technology',
      'Biotechnology',
      'Business Administration',
      'Data Science & AI',
      'Chemical Engineering',
    ];

    return Array.from(new Set([...studentDepts, ...standardDepts])).sort();
  }, [students]);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSending(true);
    try {
      const studentObj = students.find((s) => s.id === targetStudentId);
      const record = await notificationService.sendBroadcastNotification({
        title: title.trim(),
        message: message.trim(),
        audience,
        targetDepartment: audience === 'department' ? targetDepartment : undefined,
        targetStudentId: audience === 'student' ? targetStudentId : undefined,
        targetStudentName: audience === 'student' ? studentObj?.name : undefined,
        priority,
      });

      setBroadcastHistory((prev) => [record, ...prev]);
      setTitle('');
      setMessage('');
      setAudience('all_students');
      setPriority('info');
      success(
        `Broadcast dispatched to ${record.recipientCount} recipient(s).`,
        'Broadcast Sent'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch broadcast';
      toastError(msg, 'Broadcast Failed');
      console.error(err);
      // Reload history to display the logged unsuccessful attempt
      try {
        const history = await notificationService.getBroadcastHistory();
        setBroadcastHistory(history);
      } catch (historyErr) {
        console.error('Failed to reload history:', historyErr);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Administrative Broadcast & Notifications
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Dispatch announcements to targeted student cohorts and monitor operational system alerts.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
              activeTab === 'broadcast'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Broadcast Center</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('alerts')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors relative ${
              activeTab === 'alerts'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Admin Alerts</span>
            {unreadCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
        </div>
      </div>

      {activeTab === 'broadcast' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Compose Broadcast (5 cols) */}
          <div className="lg:col-span-5">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <CardTitle className="text-base font-bold">Compose Broadcast</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  Sends an immediate in-portal notification to students
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <form onSubmit={handleSendBroadcast} className="space-y-4">
                  {/* Notification Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Broadcast Title *
                    </label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Scheduled Water Maintenance in Hostel B"
                      required
                    />
                  </div>

                  {/* Audience Selection */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Target Audience *
                    </label>
                    <Select
                      value={audience}
                      onChange={(e) => setAudience(e.target.value as AudienceType)}
                      options={[
                        { value: 'all_students', label: 'All Students (Campus-wide)' },
                        { value: 'department', label: 'Specific Academic Department' },
                        { value: 'student', label: 'Specific Individual Student' },
                      ]}
                    />
                  </div>

                  {/* Conditional: Department Picker */}
                  {audience === 'department' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Select Target Department
                      </label>
                      <Select
                        value={targetDepartment}
                        onChange={(e) => setTargetDepartment(e.target.value)}
                        options={academicDepartments.map((dept) => ({
                          value: dept,
                          label: `${dept} Department`,
                        }))}
                      />
                    </div>
                  )}

                  {/* Conditional: Student Picker */}
                  {audience === 'student' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 animate-in fade-in duration-200">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Select Student Recipient
                      </label>
                      <Select
                        value={targetStudentId}
                        onChange={(e) => setTargetStudentId(e.target.value)}
                        options={students.map((s) => ({
                          value: s.id,
                          label: `${s.name} (${s.studentId || s.email})${
                            s.status === 'inactive' ? ' — [DEACTIVATED]' : ''
                          }`,
                        }))}
                      />
                    </div>
                  )}

                  {/* Priority Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Notification Priority *
                    </label>
                    <Select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as PriorityType)}
                      options={[
                        { value: 'info', label: 'Standard / Informational (Blue)' },
                        { value: 'warning', label: 'High / Urgency Notice (Amber)' },
                        { value: 'error', label: 'Critical / Emergency Alert (Rose)' },
                      ]}
                    />
                  </div>

                  {/* Message Body */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Message Content *
                    </label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Explain the incident, scheduled work, or instructions for students..."
                      rows={4}
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={sending}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    rightIcon={<Send className="w-4 h-4" />}
                  >
                    Send Broadcast Notification
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Broadcast History (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <Card>
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">Sent Broadcast History</CardTitle>
                    <CardDescription className="text-xs">
                      Past announcements dispatched to students
                    </CardDescription>
                  </div>
                  <Badge variant="outline" size="sm" className="font-mono text-xs">
                    {broadcastHistory.length} Dispatched
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {broadcastHistory.length === 0 ? (
                  <div className="p-8">
                    <EmptyState
                      icon={<Radio className="w-8 h-8 text-slate-400" />}
                      title="No broadcasts dispatched yet"
                      description="Compose a broadcast on the left to send notifications to students."
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[680px] overflow-y-auto">
                    {broadcastHistory.map((bc) => (
                      <div
                        key={bc.id}
                        className="p-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                bc.priority === 'error'
                                  ? 'bg-rose-500'
                                  : bc.priority === 'warning'
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                            />
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {bc.title}
                            </h4>
                          </div>

                          <span className="text-[11px] text-slate-400">
                            {new Date(bc.sentAt).toLocaleString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {bc.message}
                        </p>

                        {bc.status === 'failed' && bc.failureReason && (
                          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <span><strong>Delivery Failed:</strong> {bc.failureReason}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                          {/* Delivery Status Badge */}
                          {bc.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 font-semibold border border-rose-200 dark:border-rose-900/40">
                              <span>Failed (0 Delivered)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-900/40">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Delivered ({bc.recipientCount})</span>
                            </span>
                          )}

                          {/* Audience Badge */}
                          {bc.audience === 'all_students' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold border border-purple-200 dark:border-purple-900/40">
                              <Users className="w-3 h-3" />
                              <span>All Students</span>
                            </span>
                          ) : bc.audience === 'department' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900/40">
                              <Building className="w-3 h-3" />
                              <span>Dept: {bc.targetDepartment}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-900/40">
                              <User className="w-3 h-3" />
                              <span>Student: {bc.targetStudentName || bc.targetStudentId}</span>
                            </span>
                          )}

                          {/* Priority Badge */}
                          <Badge
                            variant={
                              bc.priority === 'error'
                                ? 'critical'
                                : bc.priority === 'warning'
                                ? 'warning'
                                : 'default'
                            }
                            size="sm"
                          >
                            {bc.priority.toUpperCase()}
                          </Badge>

                          <span className="text-slate-400 ml-auto">
                            Dispatched by {bc.sentBy}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* View 2: Direct Admin Operational Alerts */
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <CardTitle className="text-base font-bold">Admin Inbound System Alerts</CardTitle>
              <CardDescription className="text-xs">
                Direct facility warnings, newly submitted critical tickets, and student reopen alerts
              </CardDescription>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                leftIcon={<CheckCheck className="w-4 h-4" />}
              >
                Mark All Read
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {adminAlerts.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Bell className="w-8 h-8 text-slate-400" />}
                  title="No admin alerts pending"
                  description="All operational events and triage alerts have been reviewed."
                />
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {adminAlerts.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.read && markAsRead(n.id)}
                    className={`p-4 flex items-start gap-3.5 transition-colors cursor-pointer ${
                      !n.read
                        ? 'bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-50/80'
                        : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0">
                      {n.type === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      ) : (
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {n.title}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {n.message}
                      </p>
                    </div>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-purple-600 shrink-0 mt-2" />}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
