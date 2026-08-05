import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Bell, AlertTriangle, Info, CheckCircle, Package, Clock, MessageSquare, Download, Image as ImageIcon, Send } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';
import useNotifications from '../hooks/useNotifications';
import BackButton from './common/BackButton';

const NotificationCenter = ({ onNavigate, onGoBack, userRole = 'Admin' }) => {const { t } = useLanguage();
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState({});
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  // Hook handles fetching broadcasts automatically
  const { broadcasts, markAsRead: markBroadcastRead } = useBroadcasts(userRole);
  const { notifications: realTimeNotifs, markAllAsRead: markRtAllRead, clearNotification } = useNotifications(userRole);

  useEffect(() => {
    fetchLocalNotifications();
  }, []);

  const fetchLocalNotifications = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getApiUrl()}/inventory`);
      const inventory = res.data;

      const lowStockAlerts = inventory.
      filter((item) => item.currentStock <= item.minStockAlert).
      map((item) => ({
        id: `inv-${item._id}`,
        type: 'warning',
        title: 'Low Stock Alert',
        message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining). Minimum required is ${item.minStockAlert} ${item.unit}.`,
        timestamp: new Date(),
        icon: Package,
        color: 'text-amber-500',
        bg: 'bg-amber-50'
      }));

      const systemAlerts = [
      {
        id: 'sys-1',
        type: 'info',
        title: 'System Update Completed',
        message: 'The billing system was successfully updated to v1.2.4. New features include Language Profiles and Admin Controls.',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        icon: Info,
        color: 'text-blue-500',
        bg: 'bg-blue-50'
      }];


      setLocalNotifications([...lowStockAlerts, ...systemAlerts].sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markLocalAsRead = (id) => {
    setLocalNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllLocal = () => {
    setLocalNotifications([]);
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return '';
    }
  };

  const handleReplyChange = (id, text) => {
    setReplyText((prev) => ({ ...prev, [id]: text }));
  };

  const handleSendReply = async (broadcastId) => {
    const text = replyText[broadcastId];
    if (!text || text.trim() === '') return;

    setIsSubmittingReply(true);
    try {
      const SUPERADMIN_API_URL = getSuperadminApiUrl();
      const tenantDb = localStorage.getItem('resto_db_name');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const senderName = user.username || userRole;

      await axios.post(`${SUPERADMIN_API_URL}/api/broadcasts/reply`, {
        broadcastId,
        clientId: tenantDb,
        shopName: tenantDb,
        senderRole: userRole,
        senderUsername: senderName,
        message: text
      });

      alert('Reply sent successfully!');
      setReplyText((prev) => ({ ...prev, [broadcastId]: '' }));
    } catch (error) {
      console.error('Error sending reply:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  // Combine and sort all notifications
  const formattedBroadcasts = broadcasts.map((b) => ({
    id: b._id,
    type: 'broadcast',
    title: b.title,
    message: b.message,
    imageUrl: b.imageUrl,
    fileUrl: b.fileUrl,
    fileType: b.fileType,
    allowReplies: b.allowReplies,
    timestamp: new Date(b.createdAt),
    icon: Bell,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  }));

  const allNotifications = [...formattedBroadcasts, ...localNotifications, ...realTimeNotifs].sort((a, b) => {
    const timeA = a.timestamp || new Date(a.time) || 0;
    const timeB = b.timestamp || new Date(b.time) || 0;
    return new Date(timeB) - new Date(timeA);
  });

  const SUPERADMIN_URL = getSuperadminApiUrl();

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="text-primary" />{t("Notification Center")}
            </h1>
            <p className="text-sm text-gray-500">{t("System alerts, broadcasts, and updates")}</p>
          </div>
        </div>
        
        {allNotifications.length > 0 &&
        <button
          onClick={() => { clearAllLocal(); clearNotification('ALL'); }}
          className="text-sm font-bold text-gray-500 hover:text-red-500 transition-colors">{t("Clear All")}
        </button>
        }
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {loading && broadcasts.length === 0 ?
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :
        allNotifications.length === 0 ?
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bell size={64} className="mb-4 opacity-20" />
            <h3 className="text-xl font-bold text-gray-500">{t("All caught up!")}</h3>
            <p>{t("You have no new notifications.")}</p>
          </div> :

        allNotifications.map((notif) => {
          const Icon = notif.icon || Bell;
          const isBroadcast = notif.type === 'broadcast';

          return (
            <div key={notif.id} className={`bg-white p-5 rounded-2xl shadow-sm border ${isBroadcast ? 'border-purple-200 shadow-purple-100/50' : 'border-gray-100'} flex gap-4 items-start transition-all hover:shadow-md`}>
                <div className={`p-3 rounded-xl ${notif.bg} ${notif.color} shrink-0`}>
                  <Icon size={24} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-800 text-lg">{t(notif.title)}</h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Clock size={12} />
                      {formatTimeAgo(notif.timestamp || notif.time)}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap">{t(notif.message)}</p>
                  
                  {isBroadcast && notif.imageUrl &&
                <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 inline-block max-w-sm">
                      <img src={notif.imageUrl} alt="Broadcast Attachment" className="w-full h-auto object-cover max-h-64" />
                    </div>
                }
                  
                  {isBroadcast && notif.fileUrl &&
                <div className="mb-4">
                      <a
                    href={notif.fileUrl.startsWith('http') ? notif.fileUrl : `${SUPERADMIN_URL}${notif.fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors text-sm">
                    
                        <Download size={16} />{t("Download")}{notif.fileType === 'apk' ? 'Update (APK)' : notif.fileType === 'ipa' ? 'Update (IPA)' : 'Attachment'}
                      </a>
                    </div>
                }

                  {isBroadcast && notif.allowReplies &&
                <div className="mt-4 flex gap-2">
                      <input
                    type="text" placeholder={t("Write a reply to SuperAdmin...")}

                    value={replyText[notif.id] || ''}
                    onChange={(e) => handleReplyChange(notif.id, e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {if (e.key === 'Enter') handleSendReply(notif.id);}} />
                  
                      <button
                    onClick={() => handleSendReply(notif.id)}
                    disabled={isSubmittingReply || !replyText[notif.id]?.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0">
                    
                        <Send size={18} />
                      </button>
                    </div>
                }
                </div>
                
                <button
                onClick={() => {
                  if (isBroadcast) {
                    markBroadcastRead(notif.id);
                  } else {
                    markLocalAsRead(notif.id);
                    clearNotification(notif.id);
                  }
                }}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors shrink-0" title={t("Mark as read / Dismiss")}>
                
                  <CheckCircle size={20} />
                </button>
              </div>);

        })
        }
      </div>
    </div>);

};

export default NotificationCenter;