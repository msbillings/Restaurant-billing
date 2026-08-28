import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { Plus, ArrowLeft, Calendar, Clock, Users, Phone, Check, X, MapPin, Search, Filter, AlertCircle } from 'lucide-react';
import { getCachedOpenOrders } from '../db/offlineDb';
import realtimeService from '../services/realtimeService';

const Reservation = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [reservations, setReservations] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingAction, setProcessingAction] = useState(null);
  const [availableSpaces, setAvailableSpaces] = useState([]);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('All');
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');

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
    specialRequests: ''
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
        tables: [{ id: 't1', name: 'Table 1', type: 'table' }, { id: 't2', name: 'Table 2', type: 'table' }, { id: 't3', name: 'Table 3', type: 'table' }],
        cabins: [{ id: 'c1', name: 'Cabin 1', type: 'cabin' }, { id: 'c2', name: 'Cabin 2', type: 'cabin' }],
        sofas: [{ id: 's1', name: 'Sofa-01', type: 'sofa' }]
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
              spaces.push({ name: space.name, value: `${floor.name} - ${space.name}` });
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
        await axios.post(`${getApiUrl()}/reservations`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
        });
      }
      setIsModalOpen(false);
      setIsEditing(false);
      setEditingId(null);
      setFormData({
        customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0],
        time: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', guests: 2, tableType: '', specialRequests: ''
      });
      fetchReservations();
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

  const updateStatus = async (id, status) => {
    setProcessingAction({ id, action: status });
    try {
      await axios.put(`${getApiUrl()}/reservations/${id}`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      fetchReservations();
    } catch (error) {
      console.error('Error updating status', error);
      alert('Error updating status');
    } finally {
      setProcessingAction(null);
    }
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
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
  }, [reservations, searchTerm, statusFilter, dateFilter, timeFilter, customDateStart, customDateEnd]);

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
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full flex-1">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder={t("Name or phone...")}
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all shadow-sm"
            />
          </div>
          
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold transition-colors shadow-sm border text-sm ${showFilters ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}>
              <Filter size={16} />
              <span>{t("Filters")}</span>
            </button>

            <button
              onClick={() => {
                setIsEditing(false);
                setEditingId(null);
                setFormData({
                  customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0],
                  time: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', guests: 2, tableType: '', specialRequests: ''
                });
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg font-bold transition-colors shadow-md touch-target text-xs sm:text-sm">
              <Plus size={18} />
              <span className="hidden sm:inline">{t("New Reservation")}</span>
              <span className="sm:hidden">{t("New")}</span>
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
        </div>
      )}

      {loading ?
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div> :

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-20">
          {filteredReservations.length === 0 ?
            <div className="col-span-full text-center py-16 p-4 text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <Calendar size={40} className="mx-auto text-slate-300 mb-2" />
              <h3 className="text-base font-bold text-slate-800 mb-1">{t("No upcoming reservations.")}</h3>
              <p className="text-xs text-slate-400">{t("Click 'New Reservation' to add a booking.")}</p>
            </div> :

            filteredReservations.map((res) =>
              <div key={res._id} className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 sm:p-5 flex flex-col h-full hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3 sm:mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base sm:text-lg">{res.customerName}</h3>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs sm:text-sm mt-0.5 font-mono">
                      <Phone size={13} className="text-slate-400" />
                      <span>{res.phoneNumber}</span>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                    ${res.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' : ''}
                    ${res.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
                    ${res.status === 'seated' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : ''}
                    ${res.status === 'completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' : ''}
                    ${res.status === 'cancelled' || res.status === 'no-show' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
                  `}>
                    {res.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5 mb-4 flex-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Calendar size={15} className="text-slate-400 shrink-0" />
                    <span>{new Date(res.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Clock size={15} className="text-slate-400 shrink-0" />
                    <span className="font-mono">{formatTime12Hour(res.time)} - {formatTime12Hour(res.endTime)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <Users size={15} className="text-slate-400 shrink-0" />
                    <span>{res.guests} {t("Pax")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <MapPin size={15} className="text-slate-400 shrink-0" />
                    <span className="truncate">{res.tableType}</span>
                  </div>
                </div>

                {res.specialRequests &&
                  <div className="bg-amber-50/80 text-amber-900 border border-amber-200/60 p-2.5 rounded-xl text-xs mb-4">
                    <span className="font-bold mr-1">{t("Note:")}</span>{res.specialRequests}
                  </div>
                }

                {(res.status === 'pending' || res.status === 'confirmed' || res.status === 'seated') &&
                  <div className="flex gap-2 mt-auto border-t border-slate-100 pt-3.5 flex-wrap">
                    {res.status === 'pending' &&
                      <button
                        onClick={() => updateStatus(res._id, 'confirmed')}
                        disabled={processingAction?.id === res._id}
                        className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors touch-target flex items-center justify-center gap-1.5 disabled:opacity-70">
                        {processingAction?.id === res._id && processingAction?.action === 'confirmed' ? <div className="w-3.5 h-3.5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin"></div> : null}
                        {t("Confirm")}
                      </button>
                    }
                    {res.status === 'confirmed' &&
                      <button
                        onClick={() => updateStatus(res._id, 'seated')}
                        disabled={processingAction?.id === res._id}
                        className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors touch-target flex items-center justify-center gap-1.5 disabled:opacity-70">
                        {processingAction?.id === res._id && processingAction?.action === 'seated' ? <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin"></div> : null}
                        {t("Mark Seated")}
                      </button>
                    }
                    {res.status === 'seated' &&
                      <button
                        onClick={() => updateStatus(res._id, 'completed')}
                        disabled={processingAction?.id === res._id}
                        className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors touch-target flex items-center justify-center gap-1.5 disabled:opacity-70">
                        {processingAction?.id === res._id && processingAction?.action === 'completed' ? <div className="w-3.5 h-3.5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin"></div> : null}
                        {t("Finish")}
                      </button>
                    }
                    {res.status !== 'seated' && (
                      <button
                        onClick={() => updateStatus(res._id, 'cancelled')}
                        disabled={processingAction?.id === res._id}
                        className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl text-red-700 bg-red-50 hover:bg-red-100 transition-colors touch-target flex items-center justify-center gap-1.5 disabled:opacity-70">
                        {processingAction?.id === res._id && processingAction?.action === 'cancelled' ? <div className="w-3.5 h-3.5 border-2 border-red-700 border-t-transparent rounded-full animate-spin"></div> : null}
                        {t("Cancel")}
                      </button>
                    )}
                    {(res.status === 'pending' || res.status === 'confirmed') &&
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setEditingId(res._id);
                          setFormData({
                            customerName: res.customerName,
                            phoneNumber: res.phoneNumber,
                            date: new Date(res.date).toISOString().split('T')[0],
                            time: res.time,
                            endDate: new Date(res.endDate).toISOString().split('T')[0],
                            endTime: res.endTime,
                            guests: res.guests,
                            tableType: res.tableType || '',
                            specialRequests: res.specialRequests || ''
                          });
                          setIsModalOpen(true);
                        }}
                        disabled={processingAction?.id === res._id}
                        className="flex-1 py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors touch-target flex items-center justify-center gap-1.5 disabled:opacity-70">
                        {t("Edit")}
                      </button>
                    }
                  </div>
                }
              </div>
            )
          }
        </div>
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
                              {s.name} {status.unavailable ? `(${t(status.reason)})` : ""}
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
    </div>
  );

};

export default Reservation;