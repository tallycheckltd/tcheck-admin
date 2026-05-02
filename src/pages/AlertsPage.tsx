import { useState, useEffect } from 'react';
import { createSocket } from '../lib/socket';
import { useApi } from '../hooks/useApi';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import {
  Bell, MessageSquare, Flag, CheckCircle, Clock, Filter, Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Notification } from '../types';

type FilterType = 'all' | 'MESSAGE' | 'FLAG' | 'ATTENDANCE' | 'SYSTEM';

export function AlertsPage() {
  const { data: notifications, refetch, setData: setNotifications } = useApi<Notification[]>('/notifications');
  const { data: unreadData, refetch: refetchCount } = useApi<{ count: number }>('/notifications/unread-count');
  const [filter, setFilter] = useState<FilterType>('all');

  // Socket for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = createSocket(token);

    // Listen for any new notification-bearing events
    const handler = () => {
      refetch({ silent: true });
      refetchCount({ silent: true });
    };
    s.on('message:new', handler);
    s.on('flag:new', handler);
    s.on('flag:resolved', handler);
    s.on('attendance:update', handler);

    return () => { s.disconnect(); };
  }, [refetch, refetchCount]);

  const markAsRead = async (id: string) => {
    await api.patch(`/notifications/${id}/read`);
    setNotifications((prev) =>
      prev ? prev.map((n) => (n.id === id ? { ...n, read: true } : n)) : prev,
    );
    refetchCount();
  };

  const markAllAsRead = async () => {
    await api.post('/notifications/mark-all-read');
    setNotifications((prev) =>
      prev ? prev.map((n) => ({ ...n, read: true })) : prev,
    );
    refetchCount();
  };

  const filtered = notifications?.filter((n) => {
    if (filter === 'all') return true;
    return n.type === filter;
  }) || [];

  const unreadCount = unreadData?.count || 0;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE': return <MessageSquare size={16} className="text-blue-500" />;
      case 'FLAG': return <Flag size={16} className="text-yellow-500" />;
      case 'ATTENDANCE': return <Users size={16} className="text-green-500" />;
      default: return <Bell size={16} className="text-gray-500" />;
    }
  };

  const typeBadgeColor = (type: string): 'blue' | 'yellow' | 'green' | 'gray' => {
    switch (type) {
      case 'MESSAGE': return 'blue';
      case 'FLAG': return 'yellow';
      case 'ATTENDANCE': return 'green';
      default: return 'gray';
    }
  };

  const timeAgo = (dateStr: string) => {
    // Relative labels need a stable clock anchor; purity rule flags Date.now during render intentionally.
    // eslint-disable-next-line react-hooks/purity -- timestamps are inherently wall-clock-derived
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'MESSAGE', label: 'Messages' },
    { key: 'FLAG', label: 'Escalations' },
    { key: 'ATTENDANCE', label: 'Attendance' },
    { key: 'SYSTEM', label: 'System' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            System notifications and alerts
            {unreadCount > 0 && (
              <span className="ml-2 text-blue-500 font-medium">{unreadCount} unread</span>
            )}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" onClick={markAllAsRead}>
            <CheckCircle size={16} className="mr-1.5" /> Mark all as read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filter === f.key
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notification list */}
      <div className="space-y-2">
        {filtered.map((n) => (
          <button
            key={n.id}
            onClick={() => !n.read && markAsRead(n.id)}
            className={`w-full text-left glass-card p-4 transition-all cursor-pointer ${
              !n.read
                ? 'border-l-4 border-l-blue-500 bg-blue-500/5'
                : 'opacity-75 hover:opacity-100'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className={`text-sm font-medium ${!n.read ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {n.title}
                  </p>
                  <Badge color={typeBadgeColor(n.type)}>{n.type}</Badge>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <Clock size={10} /> {timeAgo(n.createdAt)}
                </p>
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="glass-card p-12 text-center">
            <Bell size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No notifications</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filter === 'all'
                ? 'You\'re all caught up! New notifications will appear here.'
                : `No ${filter.toLowerCase()} notifications found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
