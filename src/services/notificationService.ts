import type { Notification } from '@/types';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '@/utils/storage';
import { MOCK_NOTIFICATIONS } from '@/data/mockData';

/**
 * Notification Service
 * Manages fetching, marking as read, and unread counts for in-app notifications.
 */
class NotificationService {
  private ensureInitialized(): void {
    const existing = getStorageItem<Notification[] | null>(STORAGE_KEYS.NOTIFICATIONS, null);
    if (!existing || existing.length === 0) {
      setStorageItem(STORAGE_KEYS.NOTIFICATIONS, MOCK_NOTIFICATIONS);
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

  public async broadcastNotification(
    data: Omit<Notification, 'id' | 'createdAt' | 'read' | 'userId'>,
    target: 'all' | 'all_students' = 'all_students'
  ): Promise<Notification> {
    return this.createNotification({
      ...data,
      userId: target,
    });
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
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setStorageItem(STORAGE_KEYS.NOTIFICATIONS, [newNotif, ...notifications]);
    return newNotif;
  }
}

export const notificationService = new NotificationService();
