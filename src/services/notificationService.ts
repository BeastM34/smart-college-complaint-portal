import type { Notification, BroadcastNotification, User } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_NOTIFICATIONS, MOCK_BROADCASTS, MOCK_USERS } from '@/data/mockData';
import { authService } from './authService';

export interface SendBroadcastPayload {
  title: string;
  message: string;
  audience: 'all_students' | 'department' | 'student';
  targetDepartment?: string;
  targetStudentId?: string;
  targetStudentName?: string;
  priority?: 'info' | 'warning' | 'error';
}

/**
 * Normalizes department names for strict, clean comparison (ignoring case, ampersands, punctuation, and excess spacing).
 */
export const normalizeDepartment = (dept?: string): string => {
  if (!dept) return '';
  return dept
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

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
    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );

    // 1. Direct notifications addressed to this user
    const directNotifs: Notification[] = [];
    const seenDirectIds = new Set<string>();

    for (const notif of notifications) {
      if (notif.userId === userId && !seenDirectIds.has(notif.id)) {
        seenDirectIds.add(notif.id);
        directNotifs.push(notif);
      }
    }

    // 2. Global broadcast notifications ('all', 'all_students')
    // Legacy implementations generated both a global broadcast ('all_students') AND individual student copies.
    // Prevent old duplicate broadcasts from appearing twice by checking if an individual direct notification
    // already exists for this broadcast, while preserving distinct legitimate notifications and broadcast history.
    const eligibleGlobalNotifs: Notification[] = [];
    const seenGlobalIds = new Set<string>();

    for (const notif of notifications) {
      if ((notif.userId === 'all' || notif.userId === 'all_students') && !seenGlobalIds.has(notif.id)) {
        seenGlobalIds.add(notif.id);

        // Check if an individual notification already represents this broadcast for this user
        const hasIndividualCopy = directNotifs.some((direct) => {
          const sameTitle = direct.title === notif.title;
          const sameMessage = direct.message === notif.message;
          const timeDiffMs = Math.abs(
            new Date(direct.createdAt).getTime() - new Date(notif.createdAt).getTime()
          );
          // Dual-write legacy broadcasts share matching content and timestamps
          return sameTitle && sameMessage && (timeDiffMs < 300000 || isNaN(timeDiffMs));
        });

        if (!hasIndividualCopy) {
          eligibleGlobalNotifs.push(notif);
        }
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
    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
    const index = notifications.findIndex((n) => n.id === id);

    if (index === -1) {
      throw new Error(`Notification with ID ${id} not found`);
    }

    notifications[index].read = true;
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, notifications);
    return notifications[index];
  }

  public async markAllAsRead(userId: string): Promise<void> {
    this.ensureInitialized();
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
    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
    const filtered = notifications.filter((n) => n.id !== id);
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, filtered);
  }

  public async createNotification(
    data: Omit<Notification, 'id' | 'createdAt' | 'read'>
  ): Promise<Notification> {
    this.ensureInitialized();
    const notifications = getStorageItem<Notification[]>(
      STORAGE_KEYS.NOTIFICATIONS,
      MOCK_NOTIFICATIONS
    );
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
    data: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>,
    target: 'all' | 'all_students' = 'all_students'
  ): Promise<Notification> {
    return this.createNotification({
      ...data,
      userId: target,
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
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, MOCK_USERS);
    const broadcasts = getStorageItem<BroadcastNotification[]>(
      STORAGE_KEYS.BROADCASTS,
      MOCK_BROADCASTS
    );
    const currentUser = authService.getCurrentUser();
    const timestamp = new Date().toISOString();

    let targetCount = 0;
    const notificationsToCreate: Omit<Notification, 'id' | 'createdAt' | 'read'>[] = [];

    if (payload.audience === 'all_students') {
      const activeStudents = users.filter(
        (u) => u.role === 'student' && (u.status || 'active') === 'active'
      );

      if (activeStudents.length === 0) {
        const failedRecord: BroadcastNotification = {
          id: `bc-${Date.now()}`,
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
        });
      });
    } else if (payload.audience === 'department') {
      if (!payload.targetDepartment) {
        throw new Error('Please select a target department for this broadcast.');
      }

      const targetDeptNorm = normalizeDepartment(payload.targetDepartment);
      const deptStudents = users.filter(
        (u) =>
          u.role === 'student' &&
          (u.status || 'active') === 'active' &&
          u.department &&
          normalizeDepartment(u.department) === targetDeptNorm
      );

      // NEVER silently convert to all_students if no students match
      if (deptStudents.length === 0) {
        const failedRecord: BroadcastNotification = {
          id: `bc-${Date.now()}`,
          title: payload.title,
          message: payload.message,
          audience: 'department',
          targetDepartment: payload.targetDepartment,
          priority: payload.priority || 'info',
          sentBy: currentUser?.name || 'Administrator',
          sentAt: timestamp,
          recipientCount: 0,
          status: 'failed',
          failureReason: `No active students found in "${payload.targetDepartment}" department.`,
        };
        setStorageItem(STORAGE_KEYS.BROADCASTS, [failedRecord, ...broadcasts]);
        throw new Error(`No active students found in "${payload.targetDepartment}" department.`);
      }

      targetCount = deptStudents.length;
      deptStudents.forEach((student) => {
        notificationsToCreate.push({
          userId: student.id,
          title: `[${payload.targetDepartment}] ${payload.title}`,
          message: payload.message,
          type: payload.priority || 'info',
          category: 'system_notification',
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
          id: `bc-${Date.now()}`,
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
          id: `bc-${Date.now()}`,
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
      });
    }

    // Persist all generated notifications
    for (const notif of notificationsToCreate) {
      await this.createNotification(notif);
    }

    // Record in broadcast history
    const broadcastRecord: BroadcastNotification = {
      id: `bc-${Date.now()}`,
      title: payload.title,
      message: payload.message,
      audience: payload.audience,
      targetDepartment: payload.targetDepartment,
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
    return getStorageItem<BroadcastNotification[]>(
      STORAGE_KEYS.BROADCASTS,
      MOCK_BROADCASTS
    );
  }
}

export const notificationService = new NotificationService();
