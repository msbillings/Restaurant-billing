import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from './common/BackButton';
import Toast from './Toast';
import axios from 'axios';
import { Plus, ArrowLeft, Calendar, Clock, Users, Phone, Check, X, MapPin, Search, Filter, AlertCircle, Loader2, MessageSquare, LayoutGrid, Table2, ChevronLeft, ChevronRight } from 'lucide-react';
import { getCachedOpenOrders } from '../db/offlineDb';
import realtimeService from '../services/realtimeService';

const Reservation = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [reservations, setReservations] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [availableSpaces, setAvailableSpaces] = useState([]);
  const [toast, setToast] = useState(null);

  // Dynamic Reminder Settings State (per restaurant, 30 min to 300 min / 5 hours)
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(() => {
    try {
      const saved = localStorage.getItem('restaurantSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.reservationReminderLeadMinutes) {
          return Math.max(30, Math.min(300, Number(parsed.reservationReminderLeadMinutes)));
        }
      }
    } catch (e) {}
    return 120; // Default: 2 hours (120 minutes)
  });
  const [showReminderSettingsModal, setShowReminderSettingsModal] = useState(false);
  const [tempLeadMinutes, setTempLeadMinutes] = useState(120);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All');
  const [sortFilter, setSortFilter] = useState('newToOld');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

  // View mode: 'table' (default) or 'card'
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('res_viewMode') || 'table');
  const setView = (v) => { setViewMode(v); localStorage.setItem('res_viewMode', v); setCurrentPage(1); };

  // Pagination
  const PAGE_SIZE = 15;
  const [currentPage, setCurrentPage] = useState(1);

  const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12.toString().padStart(2, '0')}:${m} ${ampm}`;
  };

  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '21:00',
    guests: 2,
    tableType: '',
    specialRequests: '',
    sendWhatsApp: true
  });

  const isDateTimeInvalid = useMemo(() => {
    if (!formData.date || !formData.time || !formData.endDate || !formData.endTime) return false;
    const start = new Date(`${formData.date}T${formData.time}`);
    const end = new Date(`${formData.endDate}T${formData.endTime}`);
    return end <= start;
  }, [formData.date, formData.time, formData.endDate, formData.endTime]);

  const fetchReservations = async () => {
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('accessToken')}` };
      const resResponse = await axios.get(`${getApiUrl()}/reservations`, { headers });
      setReservations(resResponse.data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTableStatus = (tableName) => {
    if (!tableName || tableName.includes('Entire') || tableName.includes('All ')) return { unavailable: false, reason: '' };

    const startDateTime = new Date(`${formData.date}T${formData.time}`);
    const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
    const now = new Date();
    const isToday = formData.date === now.toISOString().split('T')[0];

    const hasReservationOverlap = reservations.some(res => {
      if (isEditing && editingId === res._id) return false;
      if (res.status === 'cancelled' || res.status === 'completed' || res.status === 'no-show') return false;
      
      const resTable = res.tableType ? res.tableType.toLowerCase() : '';
      const tName = tableName.toLowerCase();
      if (resTable !== tName && !tName.includes(resTable) && !resTable.includes(tName)) return false;
      
      const resStart = new Date(`${new Date(res.date).toISOString().split('T')[0]}T${res.time}`);
      const resEnd = new Date(`${new Date(res.endDate).toISOString().split('T')[0]}T${res.endTime}`);

      return (resStart < endDateTime && resEnd > startDateTime);
    });

    if (hasReservationOverlap) return { unavailable: true, reason: 'Reserved' };

    // If booking for today, check if the table is currently busy
    // Rule: A "busy now" table only blocks bookings whose time range overlaps
    //       with the 1-hour window [currentTime, currentTime + 60 min] (IST).
    //       If the user is booking for a time OUTSIDE that window, allow it.
    if (isToday) {
      const isBusyNow = openOrders.some(order => {
        if (!order || order.status === 'Cancelled' || order.status === 'Paid') return false;
        const activeItems = (order.items || []).filter(i => !i.isCancelled && (i.quantity - (i.cancelledQuantity || 0)) > 0);
        if (activeItems.length === 0) return false;
        
        const oTable = order.tableNo ? order.tableNo.trim().toLowerCase() : '';
        const tName = tableName.trim().toLowerCase();
        
        return oTable === tName || oTable.includes(tName) || tName.includes(oTable);
      });
      
      if (isBusyNow) {
        // Current IST time
        const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        // Block window: [now, now + 1 hour]
        const blockWindowStart = nowIST;
        const blockWindowEnd = new Date(nowIST.getTime() + 60 * 60 * 1000);

        // The booking overlaps the block window if:
        //   bookingStart < blockWindowEnd  AND  bookingEnd > blockWindowStart
        const bookingOverlapsBlockWindow = startDateTime < blockWindowEnd && endDateTime > blockWindowStart;

        if (bookingOverlapsBlockWindow) {
          return { unavailable: true, reason: 'Busy Now' };
        }
        // Otherwise, booking is outside the 1-hour busy window — allow it
      }
    }

    return { unavailable: false, reason: '' };
  };

  useEffect(() => {
    getCachedOpenOrders().then(orders => {
      if (orders && Array.isArray(orders)) setOpenOrders(orders);
    }).catch(() => {});
    
    fetchReservations();

    const unsubReservation = realtimeService.subscribe('reservationUpdated', () => {
      fetchReservations();
    });

    // Fetch spaces from local storage
    const saved = localStorage.getItem('msbillings_spaces');
    let parsed = [];
    if (saved) {
      parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        parsed = [{
          id: 'f-default',
          name: 'Ground Floor',
          tables: parsed.tables || [],
          cabins: parsed.cabins || [],
          sofas: parsed.sofas || []
        }];
      }
    } else {
      parsed = [{
        id: 'f-1',
        name: 'Ground Floor',
        tables: [{ id: 't1', name: 'Table 1', type: 'table', capacity: 4 }, { id: 't2', name: 'Table 2', type: 'table', capacity: 4 }, { id: 't3', name: 'Table 3', type: 'table', capacity: 4 }],
        cabins: [{ id: 'c1', name: 'Cabin 1', type: 'cabin', capacity: 6 }, { id: 'c2', name: 'Cabin 2', type: 'cabin', capacity: 6 }],
        sofas: [{ id: 's1', name: 'Sofa-01', type: 'sofa', capacity: 4 }]
      }];
    }

    const formattedFloors = [];
    parsed.forEach((floor) => {
      const hasTables = floor.tables && floor.tables.length > 0;
      const hasCabins = floor.cabins && floor.cabins.length > 0;
      const hasSofas = floor.sofas && floor.sofas.length > 0;

      const spaces = [];
      ['tables', 'cabins', 'sofas', 'spaces'].forEach((category) => {
        if (floor[category]) {
          floor[category].forEach((space) => {
            if (space.name) {
              const cap = space.capacity || (category === 'cabins' ? 6 : 4);
              spaces.push({ name: space.name, value: `${floor.name} - ${space.name}`, capacity: cap });
            }
          });
        }
      });

      formattedFloors.push({
        name: floor.name,
        hasTables,
        hasCabins,
        hasSofas,
        spaces
      });
    });
    setAvailableSpaces(formattedFloors);

    return () => {
      unsubReservation();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      alert(t("Please enter customer name"));
      return;
    }
    if (!formData.phoneNumber || formData.phoneNumber.length !== 10) {
      alert(t("Please enter a valid 10-digit mobile number"));
      return;
    }
    if (!formData.tableType) {
      alert(t("Please select a specific table"));
      return;
    }
    const startDt = new Date(`${formData.date}T${formData.time}`);
    const endDt = new Date(`${formData.endDate}T${formData.endTime}`);
    if (isNaN(startDt.getTime()) || isNaN(endDt.getTime()) || endDt <= startDt) {
      alert(t("End date & time must be strictly after Start date & time"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await axios.put(`${getApiUrl()}/reservations/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/reservations`, { ...formData, status: 'confirmed' }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0],
        time: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', guests: 2, tableType: '', specialRequests: '', sendWhatsApp: true
      });
      fetchReservations();
      setToast({
        message: isEditing ? t("Reservation updated successfully!") : t("Reservation booked successfully!"),
        type: 'success'
      });
    } catch (error) {
      console.error('Error creating reservation', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      if (error.response?.status === 401 || error.response?.status === 403 || errorMessage.toLowerCase().includes('token')) {
        alert('Your session has expired or is invalid: ' + errorMessage);
      } else {
        alert('Error creating reservation: ' + errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveReminderTiming = async (mins) => {
    const validMins = Math.max(30, Math.min(300, Number(mins) || 120));
    setReminderLeadMinutes(validMins);
    setShowReminderSettingsModal(false);

    try {
      const saved = localStorage.getItem('restaurantSettings');
      let parsed = saved ? JSON.parse(saved) : {};
      parsed.reservationReminderLeadMinutes = validMins;
      localStorage.setItem('restaurantSettings', JSON.stringify(parsed));
      
      await axios.post(`${getApiUrl()}/config/info`, { restaurantSettings: parsed }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setToast({ message: t("Reminder window updated successfully!"), type: 'success' });
    } catch (err) {
      console.warn('Could not sync reminder timing:', err);
      setToast({ message: t("Reminder window saved locally!"), type: 'success' });
    }
  };

  const getReminderEligibility = (res) => {
    if (res.whatsappReminderSent) {
      return { eligible: false, status: 'already_sent', reason: t("One-time reminder already sent") };
    }
    if (['seated', 'completed', 'cancelled', 'no-show'].includes(res.status)) {
      return { eligible: false, status: 'hidden', reason: t("Reservation is no longer upcoming") };
    }
    if (!res.whatsappSent) {
      return { eligible: false, status: 'needs_confirmation', reason: t("Confirmation alert not sent yet") };
    }

    const now = Date.now();

    // 1. Must be at least 1 hour (60 min) after confirmation was sent
    if (res.whatsappSentAt) {
      const msSinceConfirm = now - new Date(res.whatsappSentAt).getTime();
      const oneHourMs = 60 * 60 * 1000;
      if (msSinceConfirm < oneHourMs) {
        const minLeft = Math.ceil((oneHourMs - msSinceConfirm) / (60 * 1000));
        return {
          eligible: false,
          status: 'cooldown',
          reason: `Available in ${minLeft}m (1-hour cooldown after confirmation message)`
        };
      }
    }

    // 2. Pre-arrival window check (min 30 min, max 5 hours, configured by restaurant)
    if (res.date && res.time) {
      const dateStr = new Date(res.date).toISOString().split('T')[0];
      const bookingTime = new Date(`${dateStr}T${res.time}`).getTime();

      if (!isNaN(bookingTime)) {
        const leadMs = (Number(reminderLeadMinutes) || 120) * 60 * 1000;
        const windowStart = bookingTime - leadMs;

        if (now < windowStart) {
          const waitHours = ((windowStart - now) / (3600 * 1000)).toFixed(1);
          const leadText = reminderLeadMinutes >= 60 ? `${(reminderLeadMinutes / 60).toFixed(1).replace('.0', '')}h` : `${reminderLeadMinutes}m`;
          return {
            eligible: false,
            status: 'too_early',
            reason: `Active ${leadText} before booking (starts in ~${waitHours}h)`
          };
        }

        if (now > bookingTime) {
          return {
            eligible: false,
            status: 'past',
            reason: t("Reservation start time has already passed")
          };
        }
      }
    }

    return { eligible: true, status: 'eligible', reason: '' };
  };

  const handleSendWhatsApp = async (res, type = 'confirmed') => {
    setProcessingAction({ id: res._id, action: 'whatsapp' });
    try {
      const resAlert = await axios.post(`${getApiUrl()}/reservations/${res._id}/send-whatsapp`, { type }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setToast({ message: resAlert.data?.message || t("WhatsApp alert sent successfully!"), type: 'success' });
      fetchReservations();
    } catch (err) {
      console.error('Error sending WhatsApp alert:', err);
      setToast({
        message: err.response?.data?.message || t("Failed to send WhatsApp alert. Check WhatsApp connection in Settings."),
        type: 'error'
      });
    } finally {
      setProcessingAction(null);
    }
  };

  const updateStatus = async (id, status) => {
    setProcessingAction({ id, action: status });
    try {
      await axios.put(`${getApiUrl()}/reservations/${id}`, { status, sendWhatsApp: false }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      fetchReservations();
      setToast({ message: `${t("Status updated to")} ${status}`, type: 'success' });
    } catch (error) {
      console.error('Error updating status', error);
      setToast({ message: error.response?.data?.message || t("Error updating status"), type: 'error' });
    } finally {
      setProcessingAction(null);
    }
  };

  const filteredReservations = useMemo(() => {
    let result = reservations.filter(res => {
      // 1. Search
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        if (!res.customerName?.toLowerCase().includes(term) && !res.phoneNumber?.includes(term)) {
          return false;
        }
      }

      // 2. Status
      if (statusFilter !== 'All') {
        if (res.status !== statusFilter.toLowerCase()) return false;
      }

      // 3. Date Filter
      const resDateStr = new Date(res.date).toISOString().split('T')[0];
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      if (dateFilter === 'Today' && resDateStr !== todayStr) return false;
      if (dateFilter === 'Tomorrow' && resDateStr !== tomorrowStr) return false;
      if (dateFilter === 'Custom') {
        if (customDateStart && resDateStr < customDateStart) return false;
        if (customDateEnd && resDateStr > customDateEnd) return false;
      }

      // 4. Time Filter
      if (timeFilter !== 'All') {
        const hour = parseInt(res.time.split(':')[0], 10);
        if (timeFilter === 'Morning' && hour >= 12) return false;
        if (timeFilter === 'Afternoon' && (hour < 12 || hour >= 17)) return false;
        if (timeFilter === 'Evening' && hour < 17) return false;
      }

      return true;
    });

    // 5. Sort
    result.sort((a, b) => {
      if (sortFilter === 'newToOld') {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        return dateCompare !== 0 ? dateCompare : String(b.time || '').localeCompare(String(a.time || ''));
      } else if (sortFilter === 'oldToNew') {
        const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
        return dateCompare !== 0 ? dateCompare : String(a.time || '').localeCompare(String(b.time || ''));
      } else if (sortFilter === 'az') {
        return String(a.customerName || '').toLowerCase().localeCompare(String(b.customerName || '').toLowerCase());
      } else if (sortFilter === 'za') {
        return String(b.customerName || '').toLowerCase().localeCompare(String(a.customerName || '').toLowerCase());
      } else if (sortFilter === 'guestsHigh') {
        return (Number(b.guests) || 0) - (Number(a.guests) || 0);
      } else if (sortFilter === 'guestsLow') {
        return (Number(a.guests) || 0) - (Number(b.guests) || 0);
      }
      return 0;
    });

    return result;
  }, [reservations, searchTerm, statusFilter, dateFilter, timeFilter, customDateStart, customDateEnd, sortFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / PAGE_SIZE));
  const paginatedReservations = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredReservations.slice(start, start + PAGE_SIZE);
  }, [filteredReservations, currentPage, PAGE_SIZE]);

  // Reset to page 1 when filters change
  const prevFilterKey = useMemo(() => `${searchTerm}|${statusFilter}|${dateFilter}|${timeFilter}|${customDateStart}|${customDateEnd}|${sortFilter}`, [searchTerm, statusFilter, dateFilter, timeFilter, customDateStart, customDateEnd, sortFilter]);
  useEffect(() => { setCurrentPage(1); }, [prevFilterKey]);

  // Status badge helper
  const statusBadge = (status) => {
    const map = {
      pending:   'bg-amber-100 text-amber-800 border-amber-200',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
      seated:    'bg-emerald-100 text-emerald-800 border-emerald-200',
      completed: 'bg-slate-100 text-slate-600 border-slate-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
      'no-show': 'bg-red-100 text-red-700 border-red-200',
    };
    return `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`;
  };

  // Compact action bar for a reservation row/card (shared)
  const ActionBar = ({ res, compact = false }) => {
    const rem = getReminderEligibility(res);
    const isProcessing = processingAction?.id === res._id;
    const btnBase = compact
      ? 'py-1 px-2 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50'
      : 'py-1.5 px-2.5 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors disabled:opacity-50';

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {res.status === 'pending' && (
          <button onClick={() => updateStatus(res._id, 'confirmed')} disabled={isProcessing}
            className={`${btnBase} text-blue-700 bg-blue-50 hover:bg-blue-100`}>
            {isProcessing && processingAction?.action === 'confirmed' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            <span>{t('Confirm')}</span>
          </button>
        )}
        {res.status === 'confirmed' && (
          <button onClick={() => updateStatus(res._id, 'seated')} disabled={isProcessing}
            className={`${btnBase} text-emerald-700 bg-emerald-50 hover:bg-emerald-100`}>
            {isProcessing && processingAction?.action === 'seated' ? <Loader2 size={10} className="animate-spin" /> : <Users size={10} />}
            <span>{t('Seat')}</span>
          </button>
        )}
        {res.status === 'seated' && (
          <button onClick={() => updateStatus(res._id, 'completed')} disabled={isProcessing}
            className={`${btnBase} text-teal-700 bg-teal-50 hover:bg-teal-100`}>
            {isProcessing && processingAction?.action === 'completed' ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
            <span>{t('Finish')}</span>
          </button>
        )}
        {res.status !== 'seated' && !['completed','cancelled','no-show'].includes(res.status) && (
          <button onClick={() => updateStatus(res._id, 'cancelled')} disabled={isProcessing}
            className={`${btnBase} text-red-600 bg-red-50 hover:bg-red-100`}>
            {isProcessing && processingAction?.action === 'cancelled' ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
            <span>{t('Cancel')}</span>
          </button>
        )}
        {(res.status === 'pending' || res.status === 'confirmed') && (
          <button onClick={() => {
            setIsEditing(true); setEditingId(res._id);
            setFormData({ customerName: res.customerName, phoneNumber: res.phoneNumber,
              date: new Date(res.date).toISOString().split('T')[0], time: res.time,
              endDate: new Date(res.endDate).toISOString().split('T')[0], endTime: res.endTime,
              guests: res.guests, tableType: res.tableType || '', specialRequests: res.specialRequests || '', sendWhatsApp: true });
            setIsModalOpen(true);
          }} disabled={isProcessing} className={`${btnBase} text-slate-600 bg-slate-100 hover:bg-slate-200`}>
            <span>{t('Edit')}</span>
          </button>
        )}
        {/* WA Button */}
        {rem.status === 'already_sent' ? (
          <span className={`${btnBase} text-purple-700 bg-purple-50 border border-purple-200 opacity-80 cursor-default select-none`}>
            <Check size={10} /> <span>{t('Reminded')}</span>
          </span>
        ) : rem.status !== 'hidden' && (
          <button type="button" disabled={isProcessing || !rem.eligible && rem.status !== 'needs_confirmation'}
            onClick={() => handleSendWhatsApp(res, rem.status === 'needs_confirmation' ? 'confirmed' : 'reminder')}
            title={rem.reason}
            className={`${btnBase} ${
              rem.eligible || rem.status === 'needs_confirmation'
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60'
            }`}>
            {isProcessing && processingAction?.action === 'whatsapp' ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} />}
            <span>{rem.status === 'needs_confirmation' ? t('WA') : t('Remind')}</span>
          </button>
        )}
      </div>
    );
  };

  const Pagination = ({ compact = false }) => (
    <div className={`flex items-center gap-2 ${ filteredReservations.length === 0 ? 'opacity-50' : '' }`}>
      {!compact && (
        <span className="text-xs text-slate-500 font-medium shrink-0 hidden sm:inline-block">
          {filteredReservations.length === 0 ? t('0 records') : `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filteredReservations.length)} / ${filteredReservations.length}`}
        </span>
      )}
      <div className={`flex items-center gap-0.5 sm:gap-1 rounded-lg border ${ filteredReservations.length === 0 ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white' } px-0.5 py-0.5`}>
        <button
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1 || filteredReservations.length === 0}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronLeft size={14} />
        </button>
        {!compact && Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .reduce((acc, p, idx, arr) => {
            if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) => p === '...' ? (
            <span key={`ellipsis-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-slate-400">…</span>
          ) : (
            <button key={p} onClick={() => setCurrentPage(p)}
              disabled={filteredReservations.length === 0}
              className={`w-7 h-7 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                p === currentPage && filteredReservations.length > 0
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 disabled:opacity-40'
              }`}>{p}</button>
          ))
        }
        {compact && (
          <span className="text-xs font-bold text-slate-700 px-1">{currentPage} / {totalPages}</span>
        )}
        <button
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages || filteredReservations.length === 0}
          className="w-7 h-7 flex items-center justify-center rounded text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto custom-scrollbar w-full">
      <div className="bg-white p-2 sm:p-2.5 rounded-2xl shadow-xs border border-slate-200 mb-2 sm:mb-2.5 shrink-0 w-full flex flex-col xl:flex-row items-start xl:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{t("Table Reservations")}</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{t("Manage upcoming bookings")}</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full flex-1">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 w-full min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder={t("Name or phone...")}
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
              />
            </div>
            
            <div className="shrink-0">
              <Pagination compact={true} />
            </div>
          </div>
          
          <div className="flex gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden shrink-0">
              <button
                onClick={() => setView('table')}
                title={t('Table View')}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${ viewMode === 'table' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50' }`}>
                <Table2 size={16} />
              </button>
              <button
                onClick={() => setView('card')}
                title={t('Card View')}
                className={`w-9 h-9 flex items-center justify-center transition-colors ${ viewMode === 'card' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50' }`}>
                <LayoutGrid size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setTempLeadMinutes(reminderLeadMinutes); setShowReminderSettingsModal(true); }}
              className="flex items-center gap-1 px-2.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
              title={t('Configure WhatsApp reminder window (30m–5h)')}>
              <Clock size={14} className="text-emerald-600" />
              <span className="text-emerald-700 font-mono font-black">
                {reminderLeadMinutes >= 60 ? `${(reminderLeadMinutes / 60).toFixed(1).replace('.0', '')}h` : `${reminderLeadMinutes}m`}
              </span>
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold transition-colors shadow-xs border text-xs shrink-0 ${ showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' }`}>
              <Filter size={14} />
              <span className="hidden sm:inline">{t('Filters')}</span>
            </button>

            <button
              onClick={() => {
                setIsEditing(false); setEditingId(null);
                setFormData({ customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0],
                  time: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', guests: 2, tableType: '', specialRequests: '', sendWhatsApp: true });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-lg font-bold transition-colors shadow-md text-xs shrink-0">
              <Plus size={15} />
              <span className="hidden sm:inline">{t('New Reservation')}</span>
              <span className="sm:hidden">{t('New')}</span>
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-xs border border-slate-200 mb-4 flex flex-wrap items-end gap-3 sm:gap-4 w-full animate-fade-in">
          <div className="flex-1 min-w-[130px] sm:w-36 shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("Status")}</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
              <option value="All">{t("All Status")}</option>
              <option value="pending">{t("Pending")}</option>
              <option value="confirmed">{t("Confirmed")}</option>
              <option value="seated">{t("Seated")}</option>
              <option value="completed">{t("Completed")}</option>
              <option value="cancelled">{t("Cancelled")}</option>
              <option value="no-show">{t("No-Show")}</option>
            </select>
          </div>

          <div className="flex-1 min-w-[130px] sm:w-36 shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("Date")}</label>
            <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
              <option value="All">{t("All Dates")}</option>
              <option value="Today">{t("Today")}</option>
              <option value="Tomorrow">{t("Tomorrow")}</option>
              <option value="Custom">{t("Custom Range")}</option>
            </select>
          </div>

          {dateFilter === 'Custom' && (
             <div className="flex items-center gap-3 flex-wrap animate-fade-in">
               <div className="min-w-[140px] sm:w-36">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("Start Date")}</label>
                  <input 
                    type="date" 
                    value={customDateStart} 
                    max={customDateEnd || undefined}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomDateStart(val);
                      if (customDateEnd && val > customDateEnd) {
                        setCustomDateEnd(val);
                      }
                    }} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
                  />
               </div>
               <div className="min-w-[140px] sm:w-36">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("End Date")}</label>
                  <input 
                    type="date" 
                    value={customDateEnd} 
                    min={customDateStart || undefined}
                    onChange={e => {
                      const val = e.target.value;
                      setCustomDateEnd(val);
                      if (customDateStart && val < customDateStart) {
                        setCustomDateStart(val);
                      }
                    }} 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" 
                  />
               </div>
             </div>
          )}

          <div className="flex-1 min-w-[130px] sm:w-36 shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("Time")}</label>
            <select value={timeFilter} onChange={e => setTimeFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
              <option value="All">{t("All Times")}</option>
              <option value="Morning">{t("Morning")}</option>
              <option value="Afternoon">{t("Afternoon")}</option>
              <option value="Evening">{t("Evening")}</option>
            </select>
          </div>
          
          <div className="flex-1 min-w-[130px] sm:w-36 shrink-0">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">{t("Sort By")}</label>
            <select value={sortFilter} onChange={e => setSortFilter(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer">
              <option value="newToOld">{t("New to Old")}</option>
              <option value="oldToNew">{t("Old to New")}</option>
              <option value="az">{t("A-Z (Customer)")}</option>
              <option value="za">{t("Z-A (Customer)")}</option>
              <option value="guestsHigh">{t("Guests (High to Low)")}</option>
              <option value="guestsLow">{t("Guests (Low to High)")}</option>
            </select>
          </div>
        </div>
      )}

      {loading ?
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div> :

        viewMode === 'table' ? (
          /* ─── TABLE VIEW ─── */
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm md:text-base">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">#</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Customer')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Phone')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Date')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Time')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Guests')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Table / Area')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Special Request')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('WA')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Status')}</th>
                    <th className="text-left px-3 md:px-4 py-3 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedReservations.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-16 text-slate-400">
                        <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-semibold text-slate-500">{t('No reservations found.')}</p>
                        <p className="text-xs mt-1">{t("Click 'New Reservation' to add a booking.")}</p>
                      </td>
                    </tr>
                  ) : paginatedReservations.map((res, idx) => (
                    <tr key={res._id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-3 md:px-4 py-3 text-xs md:text-sm text-slate-400 font-mono">{(currentPage - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="font-bold text-slate-800 text-sm md:text-base whitespace-nowrap">{res.customerName}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="text-xs md:text-sm font-mono text-slate-600 whitespace-nowrap">{res.phoneNumber}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="text-xs md:text-sm text-slate-700 whitespace-nowrap">{new Date(res.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="text-xs md:text-sm font-mono text-slate-700 whitespace-nowrap">{formatTime12Hour(res.time)} – {formatTime12Hour(res.endTime)}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="text-xs md:text-sm font-bold text-slate-700">{res.guests}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className="text-xs md:text-sm text-slate-700 max-w-[130px] md:max-w-[160px] truncate block" title={res.tableType}>{res.tableType || '—'}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        {res.specialRequests
                          ? <span className="text-xs md:text-sm text-amber-700 max-w-[120px] md:max-w-[150px] truncate block" title={res.specialRequests}>{res.specialRequests}</span>
                          : <span className="text-xs md:text-sm text-slate-300">—</span>}
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {res.whatsappSent && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={res.whatsappSentAt ? new Date(res.whatsappSentAt).toLocaleString() : ''}>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span> WA
                            </span>
                          )}
                          {res.whatsappReminderSent && (
                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                              <Clock size={10} className="md:w-3 md:h-3" /> Rem
                            </span>
                          )}
                          {!res.whatsappSent && !res.whatsappReminderSent && <span className="text-[10px] md:text-xs text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <span className={statusBadge(res.status)}>{res.status}</span>
                      </td>
                      <td className="px-3 md:px-4 py-3">
                        <ActionBar res={res} compact={true} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ─── CARD VIEW ─── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {paginatedReservations.length === 0 ? (
              <div className="col-span-full text-center py-16 p-4 text-slate-500 bg-white rounded-xl border border-slate-200 shadow-xs">
                <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
                <h3 className="text-sm font-bold text-slate-800 mb-1">{t('No upcoming reservations.')}</h3>
                <p className="text-xs text-slate-400">{t("Click 'New Reservation' to add a booking.")}</p>
              </div>
            ) : paginatedReservations.map((res) => (
              <div key={res._id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden relative group">
                <div className={`h-1 w-full ${res.status === 'pending' ? 'bg-amber-400' : res.status === 'confirmed' ? 'bg-blue-400' : res.status === 'seated' ? 'bg-emerald-400' : res.status === 'completed' ? 'bg-slate-400' : 'bg-red-400'}`}></div>
                
                {/* Card Header */}
                <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-slate-50">
                  <div className="min-w-0 pr-2">
                    <p className="font-bold text-slate-800 text-sm truncate group-hover:text-primary transition-colors">{res.customerName}</p>
                    <p className="text-[10px] md:text-xs text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                      <Phone size={10} className="text-slate-400" />
                      {res.phoneNumber}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={statusBadge(res.status)}>{res.status}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="px-3 py-2.5 grid grid-cols-2 gap-x-2 gap-y-2 text-[11px] md:text-xs bg-slate-50/50">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Calendar size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate">{new Date(res.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <span className="font-mono truncate">{formatTime12Hour(res.time)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Users size={12} className="text-slate-400 shrink-0" />
                    <span>{res.guests} {t('Pax')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <MapPin size={12} className="text-slate-400 shrink-0" />
                    <span className="truncate" title={res.tableType}>{res.tableType || '—'}</span>
                  </div>
                </div>

                {res.specialRequests && (
                  <div className="mx-3 mt-1.5 mb-2 px-2 py-1.5 bg-amber-50/80 border border-amber-100 rounded-lg flex gap-1.5 items-start">
                    <AlertCircle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] md:text-xs text-amber-900 leading-snug line-clamp-2" title={res.specialRequests}><span className="font-bold">{t('Note:')} </span>{res.specialRequests}</p>
                  </div>
                )}

                {/* Push footer to bottom */}
                <div className="flex-1"></div>

                {/* Card Footer */}
                <div className="px-3 py-2 border-t border-slate-100 bg-white flex items-center justify-between mt-auto min-h-[44px]">
                  <div className="flex gap-1 items-center">
                    {res.whatsappSent && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={res.whatsappSentAt ? new Date(res.whatsappSentAt).toLocaleString() : ''}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block"></span> WA
                      </span>
                    )}
                    {res.whatsappReminderSent && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Clock size={8} /> Rem
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-end w-full">
                    {(res.status === 'pending' || res.status === 'confirmed' || res.status === 'seated') ? (
                      <ActionBar res={res} compact={true} />
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">{t('No actions')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* New Reservation Modal */}
      {isModalOpen &&
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h2 className="text-lg sm:text-xl font-black text-slate-800">{isEditing ? t("Edit Reservation") : t("New Reservation")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 text-xl font-bold touch-target">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Customer Name")}</label>
                  <input
                    type="text" required
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    placeholder={t("John Doe")} />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Phone Number")}</label>
                  <input
                    type="tel" required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                    pattern="[0-9]{10}"
                    maxLength="10" title={t("Please enter a valid 10-digit mobile number")}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono"
                    placeholder="9876543210" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Start Date")}</label>
                  <input
                    type="date" required
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.date}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        date: newDate,
                        endDate: (!prev.endDate || prev.endDate < newDate) ? newDate : prev.endDate
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Start Time")}</label>
                  <input
                    type="time" required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("End Date")}</label>
                  <input
                    type="date" required
                    min={formData.date || new Date().toISOString().split('T')[0]}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("End Time")}</label>
                  <input
                    type="time" required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono" />
                </div>
              </div>

              {isDateTimeInvalid && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{t("End date & time must be strictly after Start date & time.")}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Number of Guests")}</label>
                  <input
                    type="number" required min="1"
                    value={formData.guests}
                    onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none font-mono" />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Table Preference")}</label>
                  <select
                    value={formData.tableType}
                    onChange={(e) => setFormData({ ...formData, tableType: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none">
                    <option value="" disabled>{t("Select a Table")}</option>
                    {availableSpaces.map((floor) =>
                      <optgroup key={floor.name} label={`--- ${floor.name} ---`}>
                        <option value={`Entire ${floor.name}`}>{t("Entire Floor")}</option>
                        {floor.hasTables && <option value={`All Tables - ${floor.name}`}>{t("All Tables")}</option>}
                        {floor.hasCabins && <option value={`All Cabins - ${floor.name}`}>{t("All Cabins")}</option>}
                        {floor.hasSofas && <option value={`All Sofas - ${floor.name}`}>{t("All Sofas")}</option>}
                        {floor.spaces.map((s) => {
                          const status = getTableStatus(s.value);
                          return (
                            <option key={s.value} value={s.value} disabled={status.unavailable}>
                              {s.name} {s.capacity ? `(${s.capacity} ${t("seats") || "seats"})` : ""} {status.unavailable ? `(${t(status.reason)})` : ""}
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1">{t("Special Requests (Optional)")}</label>
                <textarea
                  value={formData.specialRequests}
                  onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows="2" placeholder={t("e.g., Birthday celebration, high chair needed")} />
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800">{t("Send WhatsApp Notification")}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">{t("Instantly message booking details to customer")}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.sendWhatsApp} 
                    onChange={(e) => setFormData({ ...formData, sendWhatsApp: e.target.checked })} 
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <div className="pt-3 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors touch-target text-xs sm:text-sm">{t("Cancel")}</button>
                <button type="submit" disabled={isSubmitting || isDateTimeInvalid || !formData.tableType} className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-bold shadow-md transition-all touch-target text-xs sm:text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {isEditing ? t("Save Changes") : t("Book Table")}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      {/* Quick Reminder Timing Configuration Modal */}
      {showReminderSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-fade-in">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <Clock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">{t("Reminder Time Window")}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">{t("Dynamic per restaurant (30m to 5h)")}</p>
                </div>
              </div>
              <button onClick={() => setShowReminderSettingsModal(false)} className="text-slate-400 hover:text-slate-600 p-1 text-xl font-bold cursor-pointer">&times;</button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
                {t("Configure how early before booking time the WhatsApp reminder button becomes active. Note: Reminders are strictly 1-time only and require at least 1 hour after confirmation.")}
              </p>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  {t("Quick Presets")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '30 Mins', mins: 30 },
                    { label: '1 Hour', mins: 60 },
                    { label: '2 Hours (Default)', mins: 120 },
                    { label: '3 Hours', mins: 180 },
                    { label: '4 Hours', mins: 240 },
                    { label: '5 Hours', mins: 300 }
                  ].map(p => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => setTempLeadMinutes(p.mins)}
                      className={`py-2 px-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        tempLeadMinutes === p.mins
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  {t("Custom Minutes (Min: 30m, Max: 300m / 5 hrs)")}
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="30"
                      max="300"
                      step="5"
                      value={tempLeadMinutes}
                      onWheel={(e) => e.target.blur()}
                      onKeyDown={(e) => {
                        if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') setTempLeadMinutes('');
                        else {
                          const parsed = Math.abs(parseInt(raw, 10));
                          const clamped = isNaN(parsed) ? 30 : Math.max(30, Math.min(300, parsed));
                          setTempLeadMinutes(clamped);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">mins</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-700 px-3 py-2.5 bg-emerald-50 rounded-xl border border-emerald-200 whitespace-nowrap">
                    = {((tempLeadMinutes || 30) / 60).toFixed(1).replace('.0', '')} {t("hrs before")}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReminderSettingsModal(false)}
                  className="flex-1 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveReminderTiming(tempLeadMinutes)}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {t("Save Window")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );

};

export default Reservation;