import { getApiUrl, getSuperadminApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import api from '../api/axios';
import { ArrowLeft, Bell, BellOff, AlertTriangle, Info, CheckCircle, Package, Clock, MessageSquare, Download, Image as ImageIcon, Send, Trash2, Loader2, ChefHat, UserCheck, Receipt, Radio } from 'lucide-react';
import useBroadcasts from '../hooks/useBroadcasts';
import useNotifications, { isNotificationForRole } from '../hooks/useNotifications';
import BackButton from './common/BackButton';
import ConfirmationModal from './ConfirmationModal';

const NotificationCenter = ({ onNavigate, onGoBack, userRole = 'Admin' }) => {
  const { t } = useLanguage();
  const [localNotifications, setLocalNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState({});
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'kitchen', 'service', 'billing', 'broadcasts'
  const [readIds, setReadIds] = useState(() => {
    try {
      const tenantKey = localStorage.getItem('resto_db_name') || 'default';
      const roleKeyLC = ((typeof userRole !== 'undefined' ? userRole : 'Admin') || 'Admin').toLowerCase();
      // ONLY load from the strict role-scoped key — do NOT fall back to shared keys
      // Falling back to shared keys causes ALL notifications to appear as "Read" on initial load
      const savedRealtime = JSON.parse(
        localStorage.getItem(`realtime_read_ids_${tenantKey}_${roleKeyLC}`) || '[]'
      );
      const savedBroadcasts = JSON.parse(localStorage.getItem('read_broadcasts') || '[]');
      return new Set([...savedRealtime, ...savedBroadcasts]);
    } catch (e) {
      return new Set();
    }
  });
  const [showClearModal, setShowClearModal] = useState(false);
  const [resolvedNotifs, setResolvedNotifs] = useState({});
  const [resolvingNotifs, setResolvingNotifs] = useState({});

  // Hook handles fetching broadcasts and real-time notifications automatically filtered by role
  const { broadcasts, markAsRead: markBroadcastRead, clearAllBroadcasts } = useBroadcasts(userRole);
  const { notifications: realTimeNotifs, markAllAsRead: markRtAllRead, clearNotification } = useNotifications(userRole);

  // One-time cleanup: remove legacy shared realtime_read_ids keys that caused false "Read" on load
  useEffect(() => {
    try {
      // Remove old shared (non-role-scoped) keys so they don't pollute role-scoped state
      localStorage.removeItem('realtime_read_ids');
      const tenantKey = localStorage.getItem('resto_db_name') || 'default';
      localStorage.removeItem(`realtime_read_ids_${tenantKey}`);
    } catch (e) {}
  }, []); // run once on mount

  useEffect(() => {
    fetchLocalNotifications();
  }, [userRole]);

  const fetchLocalNotifications = async () => {
    setLoading(true);
    try {
      const combined = [];

      // 1. Fetch low-stock inventory alerts (only for Admin & Manager)
      if (userRole === 'Admin' || userRole === 'Manager') {
        try {
          const res = await api.get('/inventory');
          const inventory = Array.isArray(res.data) ? res.data : [];
          const lowStockAlerts = inventory
            .filter((item) => item.currentStock <= item.minStockAlert)
            .map((item) => ({
              id: `inv-${item._id}`,
              type: 'warning',
              title: 'Low Stock Alert',
              message: `${item.name} is running low (${item.currentStock} ${item.unit} remaining). Minimum required is ${item.minStockAlert} ${item.unit}.`,
              timestamp: new Date(),
              icon: Package,
              color: 'text-amber-500',
              bg: 'bg-amber-50',
              targetRoles: ['Admin', 'Manager']
            }));
          combined.push(...lowStockAlerts);
        } catch (e) {}
      }

      // 2. Fetch active server notifications and filter by role
      try {
        const notifRes = await api.get('/bills/active-notifications');
        if (Array.isArray(notifRes.data)) {
          const roleFiltered = notifRes.data
            .filter(n => isNotificationForRole(n, userRole))
            .map(n => {
              let icon = Bell;
              let color = 'text-blue-500';
              let bg = 'bg-blue-50';

              if (n.type === 'error' || n.data?.type === 'cancel_item_request') {
                icon = AlertTriangle;
                color = 'text-red-500';
                bg = 'bg-red-50';
              } else if (n.data?.type === 'service_request') {
                icon = UserCheck;
                color = n.message === 'Pay the Bill' ? 'text-amber-600' : 'text-blue-600';
                bg = n.message === 'Pay the Bill' ? 'bg-amber-50' : 'bg-blue-50';
              } else if (n.data?.type === 'kot_update' || (n.title && n.title.includes('Order'))) {
                icon = ChefHat;
                color = 'text-orange-600';
                bg = 'bg-orange-50';
              }

              return {
                ...n,
                icon,
                color,
                bg
              };
            });
          combined.push(...roleFiltered);
        }
      } catch (e) {}

      setLocalNotifications(
        combined.sort((a, b) => new Date(b.timestamp || b.time || 0) - new Date(a.timestamp || a.time || 0))
      );
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
    if (resolvingNotifs[notif.id]) return;
    setResolvingNotifs(prev => ({ ...prev, [notif.id]: action }));
    try {
      const token = localStorage.getItem('accessToken');
      await axios.post(`${getApiUrl()}/bills/resolve-item-cancel`, {
        orderId: notif.data.orderId,
        itemId: notif.data.itemId,
        action
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResolvingNotifs(prev => ({ ...prev, [notif.id]: null }));
      setResolvedNotifs(prev => ({ ...prev, [notif.id]: action }));
      window.dispatchEvent(new CustomEvent('cancellationResolved', { detail: { orderId: notif.data.orderId, itemId: notif.data.itemId, action } }));
      setTimeout(() => {
        clearNotification(notif.id);
      }, 800);
    } catch (error) {
      console.error(`Error ${action}ing cancellation:`, error);
      setResolvingNotifs(prev => ({ ...prev, [notif.id]: null }));
      alert(`Failed to ${action} cancellation`);
    }
  };

  // Combine and sort all notifications strictly filtered by userRole
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
    icon: Radio,
    color: 'text-purple-600',
    bg: 'bg-purple-100'
  }));

  // Role-filtered unified notification list
  const allNotifications = useMemo(() => {
    const rawList = [...formattedBroadcasts, ...localNotifications, ...realTimeNotifs];
    const uniqueMap = new Map();
    rawList.forEach(n => {
      if (isNotificationForRole(n, userRole) && !uniqueMap.has(n.id)) {
        uniqueMap.set(n.id, n);
      }
    });

    let list = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = a.timestamp || new Date(a.time) || 0;
      const timeB = b.timestamp || new Date(b.time) || 0;
      return new Date(timeB) - new Date(timeA);
    });

    // Admin / Manager Tab Filtering
    if (activeTab === 'kitchen') {
      list = list.filter(n => {
        const title = (n.title || '').toLowerCase();
        const type = (n.data?.type || n.type || '').toLowerCase();
        return title.includes('kot') || title.includes('order') || title.includes('item') || type.includes('kot');
      });
    } else if (activeTab === 'service') {
      list = list.filter(n => {
        const title = (n.title || '').toLowerCase();
        const type = (n.data?.type || n.type || '').toLowerCase();
        return title.includes('service') || title.includes('waiter') || title.includes('water') || title.includes('cancel') || type.includes('service');
      });
    } else if (activeTab === 'billing') {
      list = list.filter(n => {
        const title = (n.title || '').toLowerCase();
        const msg = (n.message || '').toLowerCase();
        return title.includes('bill') || title.includes('payment') || msg.includes('pay the bill');
      });
    } else if (activeTab === 'broadcasts') {
      list = list.filter(n => n.type === 'broadcast');
    }

    return list;
  }, [formattedBroadcasts, localNotifications, realTimeNotifs, userRole, activeTab]);

  const SUPERADMIN_URL = getSuperadminApiUrl();

  const getRoleHeaderSubtitle = () => {
    const r = (userRole || 'Admin').toLowerCase();
    if (r === 'chef' || r === 'kds') return t("Kitchen, KOT updates, and dish notifications");
    if (r === 'captain') return t("Table service calls, food ready alerts, and requests");
    if (r === 'cashier') return t("Payment requests, bill settlements, and cashier alerts");
    return t("System alerts, kitchen orders, service requests, and broadcasts");
  };

  return (
    <div className="h-full flex flex-col bg-background p-2.5 sm:p-6 overflow-hidden w-full">
      <div className="flex flex-col mb-3 sm:mb-4 shrink-0 gap-2 sm:gap-3">
        <div className="flex items-center justify-between gap-2.5 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <BackButton onClick={onGoBack} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight flex items-center gap-1.5 truncate">
                  <Bell className="text-orange-500 shrink-0" size={19} />
                  <span className="truncate">
                    {userRole === 'Chef' ? t("Kitchen Notifications") :
                     userRole === 'Captain' ? t("Captain Notifications") :
                     userRole === 'Cashier' ? t("Cashier Notifications") :
                     t("Notification Center")}
                  </span>
                </h1>
                <span className="text-[9px] sm:text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 shrink-0">
                  {userRole}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-text-muted mt-0.5 truncate">{getRoleHeaderSubtitle()}</p>
            </div>
          </div>
          
          {/* Clear All — Admin only */}
          {allNotifications.length > 0 && (userRole === 'Admin' || userRole === 'Manager') && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center justify-center gap-1 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-surface border border-border text-text-muted hover:text-red-600 hover:border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all font-bold text-xs sm:text-sm shadow-xs shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Trash2 size={13} />
              <span>{t("Clear All")}</span>
            </button>
          )}
        </div>

        {/* Role category filter tabs for Admin / Manager */}
        {(userRole === 'Admin' || userRole === 'Manager') && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs shrink-0 flex-nowrap scrollbar-none">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 cursor-pointer whitespace-nowrap ${
                activeTab === 'all' ? 'bg-orange-500 text-white shadow-xs' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              {t("All")}
            </button>
            <button
              onClick={() => setActiveTab('kitchen')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'kitchen' ? 'bg-orange-500 text-white shadow-xs' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              <ChefHat size={13} />
              <span>{t("Kitchen & KOT")}</span>
            </button>
            <button
              onClick={() => setActiveTab('service')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'service' ? 'bg-orange-500 text-white shadow-xs' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              <UserCheck size={13} />
              <span>{t("Floor & Service")}</span>
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'billing' ? 'bg-orange-500 text-white shadow-xs' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              <Receipt size={13} />
              <span>{t("Cashier & Billing")}</span>
            </button>
            <button
              onClick={() => setActiveTab('broadcasts')}
              className={`px-3 py-1.5 rounded-full font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                activeTab === 'broadcasts' ? 'bg-purple-600 text-white shadow-xs' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'
              }`}
            >
              <Radio size={13} />
              <span>{t("Broadcasts")}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 sm:space-y-3.5">
        {loading && broadcasts.length === 0 ?
        <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :
        allNotifications.length === 0 ?
        <div className="flex flex-col items-center justify-center h-full text-text-muted space-y-4">
            <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center border border-border">
              <BellOff size={36} className="text-text-muted" />
            </div>
            <p className="text-sm sm:text-base font-bold">{t("No new notifications")}</p>
          </div> :

        allNotifications.map((notif) => {
          const Icon = notif.icon || Bell;
          const isBroadcast = notif.type === 'broadcast';
          // Only Admin/Manager can mark notifications as read — all other roles always see unread state
          const isAdmin = userRole === 'Admin' || userRole === 'Manager';
          const isRead = isAdmin && readIds.has(notif.id);

          const cardClass = isRead 
            ? 'bg-emerald-50/90 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 shadow-2xs' 
            : isBroadcast 
              ? 'bg-surface border-purple-200 dark:border-purple-900/50 shadow-xs' 
              : 'bg-surface border-border shadow-xs';

          return (
            <div key={notif.id} className={`${cardClass} p-3 sm:p-4 rounded-xl sm:rounded-2xl border flex gap-2.5 sm:gap-3.5 items-start transition-all shadow-xs`}>
                <div className={`p-2 sm:p-2.5 rounded-xl ${isRead ? 'bg-emerald-100 text-emerald-700' : `${notif.bg} ${notif.color}`} shrink-0`}>
                  <Icon size={18} className="sm:hidden" />
                  <Icon size={22} className="hidden sm:block" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-1.5 gap-0.5 sm:gap-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className={`font-bold text-xs sm:text-base truncate ${isRead ? 'text-emerald-900 dark:text-emerald-300' : 'text-text-main'}`}>{t(notif.title)}</h3>
                      {isRead && <span className="bg-emerald-200/80 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase">{t("Read")}</span>}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] sm:text-xs text-text-muted font-medium shrink-0">
                      <Clock size={11} />
                      {formatTimeAgo(notif.timestamp || notif.time)}
                    </div>
                  </div>

                  <p className={`leading-relaxed text-xs sm:text-sm mb-2.5 whitespace-pre-wrap ${isRead ? 'text-emerald-800/90 dark:text-emerald-400 font-medium' : 'text-text-muted'}`}>{t(notif.message)}</p>

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
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(notif.id); }} />
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
                    <div className="mt-3 flex gap-2 items-center">
                      {resolvingNotifs[notif.id] ? (
                        <span className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold animate-pulse ${
                          resolvingNotifs[notif.id] === 'accept' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          <Loader2 size={14} className="animate-spin" />
                          {resolvingNotifs[notif.id] === 'accept' ? t("Accepting...") : t("Rejecting...")}
                        </span>
                      ) : resolvedNotifs[notif.id] ? (
                        <span className={`px-3 py-1 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold ${
                          resolvedNotifs[notif.id] === 'accept' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {resolvedNotifs[notif.id] === 'accept' ? t("✓ Accepted") : t("✕ Rejected")}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleResolveCancel(notif, 'accept')}
                            className="bg-red-500 hover:bg-red-600 active:scale-95 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer">
                            {t("Accept")}
                          </button>
                          <button
                            onClick={() => handleResolveCancel(notif, 'reject')}
                            className="bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer">
                            {t("Reject")}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Right-side actions: Mark as Read + Delete — Admin only */}
                {(userRole === 'Admin' || userRole === 'Manager') && (
                  <div className="flex flex-col items-center gap-1.5 shrink-0 self-start mt-0.5">
                    {/* Mark as Read toggle */}
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
                          const tenantKey = localStorage.getItem('resto_db_name') || 'default';
                          const roleKeyLC = (userRole || 'Admin').toLowerCase();
                          localStorage.setItem(`realtime_read_ids_${tenantKey}_${roleKeyLC}`, JSON.stringify([...newSet]));
                          return newSet;
                        });
                      }}
                      className={`p-1.5 sm:p-2 rounded-xl transition-colors ${isRead ? 'text-emerald-600 bg-emerald-100' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                      title={t("Mark as read")}
                    >
                      <CheckCircle size={18} className={isRead ? 'fill-emerald-200 sm:hidden' : 'sm:hidden'} />
                      <CheckCircle size={20} className={isRead ? 'fill-emerald-200 hidden sm:block' : 'hidden sm:block'} />
                    </button>

                    {/* Delete this notification */}
                    <button
                      onClick={() => {
                        if (isBroadcast) {
                          clearAllBroadcasts && clearAllBroadcasts();
                        } else {
                          clearNotification(notif.id);
                          setLocalNotifications((prev) => prev.filter((n) => n.id !== notif.id));
                        }
                        setReadIds((prev) => {
                          const newSet = new Set(prev);
                          newSet.delete(notif.id);
                          const tenantKey = localStorage.getItem('resto_db_name') || 'default';
                          const roleKeyLC = (userRole || 'Admin').toLowerCase();
                          localStorage.setItem(`realtime_read_ids_${tenantKey}_${roleKeyLC}`, JSON.stringify([...newSet]));
                          return newSet;
                        });
                      }}
                      className="p-1.5 sm:p-2 rounded-xl text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title={t("Delete notification")}
                    >
                      <Trash2 size={16} className="sm:hidden" />
                      <Trash2 size={18} className="hidden sm:block" />
                    </button>
                  </div>
                )}
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
          // Only Admin & Manager can clear shared broadcast notifications
          // Chef, Captain, Cashier clearing does NOT remove broadcasts from other roles
          const isAdminOrManager = userRole === 'Admin' || userRole === 'Manager';
          if (isAdminOrManager) {
            clearAllBroadcasts();
          }
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