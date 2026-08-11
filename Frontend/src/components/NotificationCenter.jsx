import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Bell, BellOff, AlertTriangle, Info, CheckCircle, Package, Clock, MessageSquare, Download, Image as ImageIcon, Send, Trash2 } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';
import useNotifications from '../hooks/useNotifications';
import BackButton from './common/BackButton';
import ConfirmationModal from './ConfirmationModal';

const NotificationCenter = ({ onNavigate, onGoBack, userRole = 'Admin' }) => {const { t } = useLanguage();
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState({});
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [readIds, setReadIds] = useState(() => {
    try {
      const savedRealtime = JSON.parse(localStorage.getItem('realtime_read_ids') || '[]');
      const savedBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
      return new Set([...savedRealtime, ...savedBroadcasts]);
    } catch (e) {
      return new Set();
    }
  });
  const [showClearModal, setShowClearModal] = useState(false);
  const [resolvedNotifs, setResolvedNotifs] = useState({});

  // Hook handles fetching broadcasts automatically
  const { broadcasts, markAsRead: markBroadcastRead, clearAllBroadcasts } = useBroadcasts(userRole);
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

  const handleResolveCancel = async (notif, action) => {
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${getApiUrl()}/bills/resolve-item-cancel`, {
        orderId: notif.data.orderId,
        itemId: notif.data.itemId,
        action
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResolvedNotifs(prev => ({ ...prev, [notif.id]: action }));
      setTimeout(() => {
        clearNotification(notif.id);
      }, 3000);
    } catch (error) {
      console.error(`Error ${action}ing cancellation:`, error);
      alert(`Failed to ${action} cancellation`);
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
    <div className="h-full flex flex-col bg-gray-50 px-2.5 py-4 sm:p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 sm:mb-8 shrink-0 gap-3">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Bell className="text-primary" size={20} />{t("Notification Center")}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">{t("System alerts, broadcasts, and updates")}</p>
          </div>
        </div>
        
        {allNotifications.length > 0 &&
        <button
          onClick={() => setShowClearModal(true)}
          className="flex items-center justify-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-gray-200 text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 rounded-xl transition-all font-semibold text-xs sm:text-sm shadow-sm self-start sm:self-auto shrink-0">
          
            <Trash2 size={14} className="sm:hidden" />
            <Trash2 size={16} className="hidden sm:block" />
            {t("Clear All")}
          </button>
        }
      </div>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {loading && broadcasts.length === 0 ?
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :
        allNotifications.length === 0 ?
        <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
              <BellOff size={40} className="text-gray-300" />
            </div>
            <p className="text-lg font-medium">{t("No new notifications")}</p>
          </div> :

        allNotifications.map((notif) => {
          const Icon = notif.icon || Bell;
          const isBroadcast = notif.type === 'broadcast';
          const isRead = readIds.has(notif.id) || notif.isRead || notif.read;

          const cardClass = isRead 
            ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs' 
            : isBroadcast 
              ? 'bg-white border-purple-200 shadow-purple-100/50' 
              : 'bg-white border-gray-200 shadow-xs';

          return (
            <div key={notif.id} className={`${cardClass} p-3 sm:p-5 rounded-2xl flex gap-3 sm:gap-4 items-start transition-all hover:shadow-md`}>
                <div className={`p-2 sm:p-3 rounded-xl ${isRead ? 'bg-emerald-100 text-emerald-700' : `${notif.bg} ${notif.color}`} shrink-0`}>
                  <Icon size={20} className="sm:hidden" />
                  <Icon size={24} className="hidden sm:block" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-bold text-base sm:text-lg truncate ${isRead ? 'text-emerald-900' : 'text-gray-800'}`}>{t(notif.title)}</h3>
                      {isRead && <span className="bg-emerald-200/80 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">{t("Read")}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-400 font-medium shrink-0">
                      <Clock size={12} />
                      {formatTimeAgo(notif.timestamp || notif.time)}
                    </div>
                  </div>
                  
                  <p className={`leading-relaxed text-xs sm:text-sm mb-3 whitespace-pre-wrap ${isRead ? 'text-emerald-800/90 font-medium' : 'text-gray-700'}`}>{t(notif.message)}</p>
                  
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors text-xs sm:text-sm">
                    
                        <Download size={14} className="sm:hidden" />
                        <Download size={16} className="hidden sm:block" />
                        {t("Download")}{notif.fileType === 'apk' ? 'Update (APK)' : notif.fileType === 'ipa' ? 'Update (IPA)' : 'Attachment'}
                      </a>
                    </div>
                }

                  {isBroadcast && notif.allowReplies &&
                <div className="mt-4 flex gap-2">
                      <input
                    type="text" placeholder={t("Write a reply to SuperAdmin...")}

                    value={replyText[notif.id] || ''}
                    onChange={(e) => handleReplyChange(notif.id, e.target.value)}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    onKeyDown={(e) => {if (e.key === 'Enter') handleSendReply(notif.id);}} />
                  
                      <button
                    onClick={() => handleSendReply(notif.id)}
                    disabled={isSubmittingReply || !replyText[notif.id]?.trim()}
                    className="bg-purple-600 hover:bg-purple-700 text-white p-1.5 sm:p-2 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center shrink-0">
                    
                        <Send size={16} className="sm:hidden" />
                        <Send size={18} className="hidden sm:block" />
                      </button>
                    </div>
                }
                
                {notif.data?.type === 'cancel_item_request' && (
                  <div className="mt-3 flex gap-2">
                    {resolvedNotifs[notif.id] ? (
                      <span className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold ${resolvedNotifs[notif.id] === 'accept' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>
                        {resolvedNotifs[notif.id] === 'accept' ? t("Accepted") : t("Rejected")}
                      </span>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleResolveCancel(notif, 'accept')}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors"
                        >
                          {t("Accept")}
                        </button>
                        <button 
                          onClick={() => handleResolveCancel(notif, 'reject')}
                          className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors"
                        >
                          {t("Reject")}
                        </button>
                      </>
                    )}
                  </div>
                )}
                </div>
                
                <button
                onClick={() => {
                  if (isBroadcast) {
                    markBroadcastRead(notif.id);
                  }
                  setReadIds((prev) => {
                    const newSet = new Set(prev);
                    if (newSet.has(notif.id)) {
                      newSet.delete(notif.id);
                    } else {
                      newSet.add(notif.id);
                    }
                    localStorage.setItem('realtime_read_ids', JSON.stringify([...newSet]));
                    return newSet;
                  });
                }}
                className={`p-1.5 sm:p-2 rounded-xl transition-colors shrink-0 ${isRead ? 'text-emerald-600 bg-emerald-100' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={t("Mark as read")}>
                
                  <CheckCircle size={18} className={isRead ? 'fill-emerald-200 sm:hidden' : 'sm:hidden'} />
                  <CheckCircle size={20} className={isRead ? 'fill-emerald-200 hidden sm:block' : 'hidden sm:block'} />
                </button>
              </div>);

        })
        }
      </div>

      <ConfirmationModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={() => {
          clearAllLocal();
          clearNotification('ALL');
          clearAllBroadcasts();
        }}
        title={t("Clear All Notifications")}
        message={t("Are you sure you want to delete these notifications permanently?")}
        confirmText={t("Clear")}
        cancelText={t("Cancel")}
        isDanger={true}
      />
    </div>);

};

export default NotificationCenter;