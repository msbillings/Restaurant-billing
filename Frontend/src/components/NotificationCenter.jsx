import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Bell, AlertTriangle, Info, CheckCircle, Package, Clock } from 'lucide-react';

const NotificationCenter = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      // Fetch low stock items to generate real alerts
      const res = await axios.get('http://localhost:5002/api/inventory');
      const inventory = res.data;
      
      const lowStockAlerts = inventory
        .filter(item => item.currentStock <= item.minStockAlert)
        .map(item => ({
          id: `inv-${item._id}`,
          type: 'warning',
          title: 'Low Stock Alert',
          message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining). Minimum required is ${item.minStockAlert} ${item.unit}.`,
          timestamp: new Date(),
          icon: Package,
          color: 'text-amber-500',
          bg: 'bg-amber-50'
        }));

      // Add some system notifications
      const systemAlerts = [
        {
          id: 'sys-1',
          type: 'info',
          title: 'System Update Completed',
          message: 'The billing system was successfully updated to v1.2.4. New features include Language Profiles and Admin Controls.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          icon: Info,
          color: 'text-blue-500',
          bg: 'bg-blue-50'
        },
        {
          id: 'sys-2',
          type: 'success',
          title: 'Daily Cloud Backup',
          message: 'All restaurant data was successfully synced and backed up to the cloud at 3:00 AM.',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
          icon: CheckCircle,
          color: 'text-green-500',
          bg: 'bg-green-50'
        }
      ];

      setNotifications([...lowStockAlerts, ...systemAlerts].sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const formatTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="text-primary" /> Notification Center
            </h1>
            <p className="text-sm text-gray-500">System alerts, inventory warnings, and updates</p>
          </div>
        </div>
        
        {notifications.length > 0 && (
          <button 
            onClick={clearAll}
            className="text-sm font-bold text-gray-500 hover:text-red-500 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bell size={64} className="mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-gray-500">All caught up!</h3>
            <p>You have no new notifications.</p>
          </div>
        ) : (
          notifications.map(notif => {
            const Icon = notif.icon || Bell;
            return (
              <div key={notif.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-start transition-all hover:shadow-md">
                <div className={`p-3 rounded-full ${notif.bg} ${notif.color} shrink-0`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-gray-800">{notif.title}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Clock size={12} />
                      {formatTimeAgo(notif.timestamp)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug pr-4">{notif.message}</p>
                </div>
                <button 
                  onClick={() => markAsRead(notif.id)}
                  className="p-1.5 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                  title="Mark as read"
                >
                  <CheckCircle size={18} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;
