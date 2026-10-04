import type { Notification, BroadcastNotification, User } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_NOTIFICATIONS, MOCK_BROADCASTS, MOCK_USERS } from '@/data/mockData';
import { authService } from './authService';
import { settingsService } from './settingsService';

export interface SendBroadcastPayload {
  title: string;
  message: string;
  audience: 'all_students' | 'department' | 'student';
  targetDepartment?: string;
  targetStudentId?: string;
  targetStudentName?: string;
  priority?: 'info' | 'warning' | 'error';
  broadcastId?: string;
}

/**
 * Normalizes department names for strict, clean comparison (ignoring case, ampersands, punctuation, and excess spacing).
 */
export const normalizeDepartment = (dept?: string): string => {
  if (!dept || typeof dept !== 'string') return '';
  return dept
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Essential security and critical account categories that must always reach students,
 * even when routine student notifications are disabled by administrative policy.
 */
export const ESSENTIAL_STUDENT_CATEGORIES = new Set([
  'security_alert',
  'account_security',
  'account_alert',
  'credential_update',
  'session_security',
]);

/**
 * Notification Service
 * Manages fetching, marking as read, unread counts, and administrative broadcast notifications.
 */
class NotificationService {
  private ensureInitialized(): void {
    const existing = getStorageItem<Notification[] | null>(STORAGE_KEYS.NOTIFICATIONS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFICATIONS);
    }

    const existingBroadcasts = getStorageItem<BroadcastNotification[] | null>(
      STORAGE_KEYS.BROADCASTS,
      null
    );
    if (!existingBroadcasts || existingBroadcasts.length === 0) {
      setStorageItem(STORAGE_KEYS.BROADCASTS, MOCK_BROADCASTS);
    }
  }

  public async getNotifications(userId: string): Promise<Notification[]> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to retrieve notifications.');
    }

    if (currentUser.role !== 'admin') {
      const isSelf =
        userId === currentUser.id ||
        (currentUser.studentId && userId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isSelf) {
        throw new Error('Unauthorized: You can only retrieve notifications for your own account.');
      }
    }

    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );

    // 1. Direct notifications addressed specifically to this user
    const directNotifs: Notification[] = [];
    const directBroadcastIds = new Set<string>();
    const seenDirectIds = new Set<string>();

    for (const notif of notifications) {
      if (notif.userId === userId && !seenDirectIds.has(notif.id)) {
        // Prevent duplicate direct copies for the same recipient and broadcast
        if (notif.broadcastId) {
          if (directBroadcastIds.has(notif.broadcastId)) {
            continue;
          }
          directBroadcastIds.add(notif.broadcastId);
        }
        seenDirectIds.add(notif.id);
        directNotifs.push(notif);
      }
    }

    // 2. Global wildcard broadcast notifications ('all', 'all_students')
    // Identify duplicate copies belonging to the same broadcast using broadcastId relationship.
    // If a broadcastId is present on a global notification and the student already received
    // a direct notification for that exact broadcastId, the global duplicate is skipped.
    // If reliable identification of an old notification is impossible because previous data
    // does not contain a broadcast identifier, preserve it rather than guessing and deleting it.
    const eligibleGlobalNotifs: Notification[] = [];
    const seenGlobalBroadcastIds = new Set<string>();
    const seenGlobalIds = new Set<string>();

    for (const notif of notifications) {
      if ((notif.userId === 'all' || notif.userId === 'all_students') && !seenGlobalIds.has(notif.id)) {
        seenGlobalIds.add(notif.id);

        if (notif.broadcastId) {
          // If the student already received an individual direct copy for this broadcast, skip global copy
          if (directBroadcastIds.has(notif.broadcastId)) {
            continue;
          }
          // Prevent multiple global duplicate entries with the same broadcastId
          if (seenGlobalBroadcastIds.has(notif.broadcastId)) {
            continue;
          }
          seenGlobalBroadcastIds.add(notif.broadcastId);
        }

        // If no broadcastId is present (legacy data) or no direct copy exists, preserve the notification
        eligibleGlobalNotifs.push(notif);
      }
    }

    const allUserNotifs = [...directNotifs, ...eligibleGlobalNotifs];
    allUserNotifs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return allUserNotifs;
  }

  public async getUserNotifications(userId: string): Promise<Notification[]> {
    return this.getNotifications(userId);
  }

  public async getUnreadCount(userId: string): Promise<number> {
    const list = await this.getNotifications(userId);
    return list.filter((n) => !n.read).length;
  }

  public async markAsRead(id: string): Promise<Notification> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to mark notifications as read.');
    }

    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`Notification with ID ${id} not found`);
    }

    const notif = notifications[index];
    if (currentUser.role !== 'admin') {
      const isOwner =
        notif.userId === currentUser.id ||
        notif.userId === 'all' ||
        notif.userId === 'all_students' ||
        (currentUser.studentId && notif.userId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isOwner) {
        throw new Error('Unauthorized: You do not have permission to modify this notification.');
      }
    }

    notifications[index].read = true;
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return notifications[index];
  }

  public async markAllAsRead(userId: string): Promise<void> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to mark notifications as read.');
    }

    if (currentUser.role !== 'admin') {
      const isSelf =
        userId === currentUser.id ||
        (currentUser.studentId && userId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isSelf) {
        throw new Error('Unauthorized: You can only mark notifications for your own account.');
      }
    }

    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
    const updated = notifications.map((n) =>
      n.userId === userId || n.userId === 'all' || n.userId === 'all_students'
        ? { ...n, read: true }
        : n
    );
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, updated);
  }

  public async deleteNotification(id: string): Promise<void> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      throw new Error('Unauthorized: An authenticated session is required to delete notifications.');
    }

    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
    const target = notifications.find((n) => n.id === id);
    if (!target) {
      return;
    }

    if (currentUser.role !== 'admin') {
      const isOwner =
        target.userId === currentUser.id ||
        (currentUser.studentId && target.userId.toLowerCase() === currentUser.studentId.toLowerCase());
      if (!isOwner) {
        throw new Error('Unauthorized: You do not have permission to delete this notification.');
      }
    }

    const filtered = notifications.filter((n) => n.id !== id);
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, filtered);
  }

  public async createNotification(
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    this.ensureInitialized();
    const settings = settingsService.getSettingsSync();

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const recipient = users.find((u) => u.id === data.userId);
    const isStudentRecipient =
      data.userId === 'all_students' ||
      data.userId === 'all' ||
      recipient?.role === 'student' ||
      (!recipient && data.userId !== 'admin' && data.userId !== 'user-admin-1');

    // Security Rule: Internal admin notes must never be dispatched to students
    if (isStudentRecipient && ((data as any).isInternal || data.category === 'internal_note')) {
      return {
        ...data,
        id: `suppressed-${Date.now()}`,
        read: true,
        createdAt: new Date().toISOString(),
      };
    }

    // Policy Rule: When studentNotifications is disabled, suppress all routine student notifications
    // (complaint status, rejections, assignments, and announcements) while strictly preserving
    // essential security/account alerts and all administrative notifications.
    if (!settings.studentNotifications && isStudentRecipient) {
      const isEssential = data.category ? ESSENTIAL_STUDENT_CATEGORIES.has(data.category) : false;
      if (!isEssential) {
        return {
          ...data,
          id: `suppressed-${Date.now()}`,
          read: true,
          createdAt: new Date().toISOString(),
        };
      }
    }

    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );

    // Before creating a notification, check whether the same recipient already has a notification with the same broadcastId
    if (data.broadcastId && data.userId) {
      const existing = notifications.find(
        (n) => n.broadcastId === data.broadcastId && n.userId === data.userId
      );
      if (existing) {
        return existing;
      }
    }

    const newNotif: Notification = {
      ...data,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...notifications]);
    return newNotif;
  }

  public async broadcastNotification(
    data: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'> & { broadcastId?: string },
    target: 'all' | 'all_students' = 'all_students'
  ): Promise<Notification> {
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to dispatch broadcast notifications.');
    }
    return this.createNotification({
      ...data,
      userId: target,
      broadcastId: data.broadcastId || `bc-${Date.now()}`,
    });
  }

  /**
   * Send an administrative broadcast notification with specific audience targeting.
   * Enforces recipient validation, eliminates duplicates, and records delivery status.
   */
  public async sendBroadcastNotification(
    payload: SendBroadcastPayload
  ): Promise<BroadcastNotification> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to dispatch broadcast notifications.');
    }

    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const broadcasts = getStorageItem<BroadcastNotification[]>(
      STORAGE_KEYS.BROADCASTS,
      MOCK_BROADCASTS
    );
    const timestamp = new Date().toISOString();
    const broadcastId = payload.broadcastId || `bc-${Date.now()}`;

    let targetCount = 0;
    const notificationsToCreate: Omit<Notification, 'id' | 'createdAt' | 'read'>[] = [];

    if (payload.audience === 'all_students') {
      const activeStudents = users.filter(
        (u) => u.role === 'student' && (u.status || 'active') === 'active'
      );

      if (activeStudents.length === 0) {
        const failedRecord: BroadcastNotification = {
          id: broadcastId,
          title: payload.title,
          message: payload.message,
          audience: 'all_students',
          priority: payload.priority || 'info',
          sentBy: currentUser?.name || 'Administrator',
          sentAt: timestamp,
          recipientCount: 0,
          status: 'failed',
          failureReason: 'No active student accounts found to receive this broadcast.',
        };
        setStorageItem(STORAGE_KEYS.BROADCASTS, [failedRecord, ...broadcasts]);
        throw new Error('No active student accounts found to receive this broadcast.');
      }

      targetCount = activeStudents.length;
      // Dispatch exactly one individual notification per active student (no separate global copy)
      activeStudents.forEach((student) => {
        notificationsToCreate.push({
          userId: student.id,
          title: payload.title,
          message: payload.message,
          type: payload.priority || 'info',
          category: 'system_notification',
          broadcastId,
        });
      });
    } else if (payload.audience === 'department') {
      const rawDept = payload.targetDepartment;
      if (!rawDept || !rawDept.trim()) {
        throw new Error('Please select or specify a target department.');
      }

      const targetDeptNorm = normalizeDepartment(rawDept);
      if (!targetDeptNorm) {
        throw new Error('Please enter a valid target department name.');
      }

      const deptStudents = users.filter((u) => {
        if (u.role !== 'student' || (u.status || 'active') !== 'active') {
          return false;
        }
        if (!u.department || !u.department.trim()) {
          return false;
        }
        const studentDeptNorm = normalizeDepartment(u.department);
        if (!studentDeptNorm) {
          return false;
        }
        return studentDeptNorm === targetDeptNorm;
      });

      // NEVER silently convert to all_students if no students match
      if (deptStudents.length === 0) {
        const failedRecord: BroadcastNotification = {
          id: broadcastId,
          title: payload.title,
          message: payload.message,
          audience: 'department',
          targetDepartment: rawDept.trim(),
          priority: payload.priority || 'info',
          sentBy: currentUser?.name || 'Administrator',
          sentAt: timestamp,
          recipientCount: 0,
          status: 'failed',
          failureReason: `No active students found in "${rawDept.trim()}" department.`,
        };
        setStorageItem(STORAGE_KEYS.BROADCASTS, [failedRecord, ...broadcasts]);
        throw new Error(`No active students found in "${rawDept.trim()}" department.`);
      }

      targetCount = deptStudents.length;
      deptStudents.forEach((student) => {
        notificationsToCreate.push({
          userId: student.id,
          title: `[${rawDept.trim()}] ${payload.title}`,
          message: payload.message,
          type: payload.priority || 'info',
          category: 'system_notification',
          broadcastId,
        });
      });
    } else if (payload.audience === 'student') {
      if (!payload.targetStudentId) {
        throw new Error('Please select a student recipient.');
      }

      const targetStudent = users.find(
        (u) =>
          (u.id === payload.targetStudentId || u.studentId === payload.targetStudentId) &&
          u.role === 'student'
      );

      if (!targetStudent) {
        const failedRecord: BroadcastNotification = {
          id: broadcastId,
          title: payload.title,
          message: payload.message,
          audience: 'student',
          targetStudentId: payload.targetStudentId,
          targetStudentName: payload.targetStudentName,
          priority: payload.priority || 'info',
          sentBy: currentUser?.name || 'Administrator',
          sentAt: timestamp,
          recipientCount: 0,
          status: 'failed',
          failureReason: 'Recipient student account could not be found.',
        };
        setStorageItem(STORAGE_KEYS.BROADCASTS, [failedRecord, ...broadcasts]);
        throw new Error('Selected student account could not be found.');
      }

      if ((targetStudent.status || 'active') === 'inactive') {
        const failedRecord: BroadcastNotification = {
          id: broadcastId,
          title: payload.title,
          message: payload.message,
          audience: 'student',
          targetStudentId: payload.targetStudentId,
          targetStudentName: targetStudent.name,
          priority: payload.priority || 'info',
          sentBy: currentUser?.name || 'Administrator',
          sentAt: timestamp,
          recipientCount: 0,
          status: 'failed',
          failureReason: `Student account for ${targetStudent.name} is deactivated.`,
        };
        setStorageItem(STORAGE_KEYS.BROADCASTS, [failedRecord, ...broadcasts]);
        throw new Error(`Cannot send notification: ${targetStudent.name}'s account is deactivated.`);
      }

      targetCount = 1;
      notificationsToCreate.push({
        userId: targetStudent.id,
        title: payload.title,
        message: payload.message,
        type: payload.priority || 'info',
        category: 'admin_message',
        broadcastId,
      });
    }

    // Persist all generated notifications
    for (const notif of notificationsToCreate) {
      await this.createNotification(notif);
    }

    // Record in broadcast history
    const broadcastRecord: BroadcastNotification = {
      id: broadcastId,
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      targetDepartment: payload.targetDepartment?.trim(),
      targetStudentId: payload.targetStudentId,
      targetStudentName: payload.targetStudentName,
      priority: payload.priority || 'info',
      sentBy: currentUser?.name || 'Administrator',
      sentAt: timestamp,
      recipientCount: targetCount,
      status: 'delivered',
    };

    setStorageItem(STORAGE_KEYS.BROADCASTS, [broadcastRecord, ...broadcasts]);
    return broadcastRecord;
  }

  public async getBroadcastHistory(): Promise<BroadcastNotification[]> {
    this.ensureInitialized();
    const currentUser = authService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Unauthorized: Only administrators are permitted to view broadcast history.');
    }
    return getStorageItem<BroadcastNotification[]>(
      STORAGE_KEYS.BROADCASTS,
      MOCK_BROADCASTS
    );
  }
}

export const notificationService = new NotificationService();
