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
    return notifications.filter(
      (n) =>
        n.userId === userId ||
        n.userId === 'all' ||
        n.userId === 'all_students'
    );
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
   * Send an administrative broadcast notification with specific audience targeting
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
      const students = users.filter((u) => u.role === 'student');
      targetCount = students.length || 1;
      // Global broadcast notification
      notificationsToCreate.push({
        userId: 'all_students',
        title: payload.title,
        message: payload.message,
        type: payload.priority || 'info',
        category: 'system_notification',
      });
      // Also ensure direct individual dispatch for all active students
      students.forEach((s) => {
        notificationsToCreate.push({
          userId: s.id,
          title: payload.title,
          message: payload.message,
          type: payload.priority || 'info',
          category: 'system_notification',
        });
      });
    } else if (payload.audience === 'department' && payload.targetDepartment) {
      const targetDept = payload.targetDepartment.toLowerCase().trim();
      const deptStudents = users.filter(
        (u) =>
          u.role === 'student' &&
          u.department &&
          u.department.toLowerCase().includes(targetDept)
      );
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

      // If no specific users matched, still create a tagged broadcast
      if (targetCount === 0) {
        notificationsToCreate.push({
          userId: 'all_students',
          title: `[${payload.targetDepartment}] ${payload.title}`,
          message: payload.message,
          type: payload.priority || 'info',
          category: 'system_notification',
        });
        targetCount = 1;
      }
    } else if (payload.audience === 'student' && payload.targetStudentId) {
      targetCount = 1;
      notificationsToCreate.push({
        userId: payload.targetStudentId,
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
