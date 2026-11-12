import { useCallback, useSyncExternalStore } from 'react';

import { MOCK_NOTIFICATIONS, type AppNotification } from '../mocks/notifications.mock';

/**
 * In-memory notifications store shared across screens (mock until a backend exists).
 */
let notifications: AppNotification[] = MOCK_NOTIFICATIONS;
const listeners = new Set<() => void>();

function setNotifications(next: AppNotification[]) {
  notifications = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => notifications;

export function useNotifications() {
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const markAsRead = useCallback((id: string) => {
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  }, []);

  return {
    notifications: items,
    unreadCount: items.filter((n) => !n.read).length,
    markAsRead,
    markAllAsRead,
  };
}
