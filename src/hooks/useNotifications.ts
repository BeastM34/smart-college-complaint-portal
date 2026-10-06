import { useState, useEffect, useCallback, useRef } from 'react';
import type { Notification } from '@/types';
import { notificationService } from '@/services/notificationService';
import { useAuth } from '@/hooks/useAuth';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const inFlightMarks = useRef(new Set<string>());
  const isMarkingAll = useRef(false);

  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        notificationService.getNotifications(user.id),
        notificationService.getUnreadCount(user.id),
      ]);
      setNotifications(list);
      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markAsRead = async (id: string) => {
    if (inFlightMarks.current.has(id)) return;
    inFlightMarks.current.add(id);
    try {
      const updated = await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (user) {
        try {
          const freshCount = await notificationService.getUnreadCount(user.id);
          setUnreadCount(freshCount);
        } catch {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
      return updated;
    } finally {
      inFlightMarks.current.delete(id);
    }
  };

  const markAllAsRead = async () => {
    if (!user || isMarkingAll.current) return;
    isMarkingAll.current = true;
    try {
      await notificationService.markAllAsRead(user.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      try {
        const freshCount = await notificationService.getUnreadCount(user.id);
        setUnreadCount(freshCount);
      } catch {
        setUnreadCount(0);
      }
    } finally {
      isMarkingAll.current = false;
    }
  };

  const deleteNotification = async (id: string) => {
    await notificationService.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (user) {
      try {
        const freshCount = await notificationService.getUnreadCount(user.id);
        setUnreadCount(freshCount);
      } catch {
        setUnreadCount((prev) => {
          const removed = notifications.find((n) => n.id === id);
          return removed && !removed.read ? Math.max(0, prev - 1) : prev;
        });
      }
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    reload: loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}
