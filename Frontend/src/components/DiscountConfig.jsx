import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Edit2, Tags, Gift, Sparkles, CheckCircle2,
  XCircle, AlertCircle, Loader2, Calendar, Clock, AlertTriangle,
  Info, ShieldCheck, Timer
} from 'lucide-react';
import BackButton from './common/BackButton';
import { getMenuItems } from '../api/menu';

const getTodayDateStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getFutureDateStr = (days = 4) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const getOfferStatus = (discount) => {
  if (!discount.isActive) {
    return {
      status: 'inactive',
      label: 'Inactive',
      badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
      description: 'Disabled manually'
    };
  }

  if (discount.hasTimeline && discount.endDate) {
    const endStr = `${discount.endDate.split('T')[0]}T${discount.endTime || '23:59'}:59`;
    const startStr = `${(discount.startDate || discount.endDate).split('T')[0]}T${discount.startTime || '00:00'}:00`;
    
    const now = new Date();
    const end = new Date(endStr);
    const start = new Date(startStr);

    if (now > end) {
      const endFormatted = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return {
        status: 'expired',
        label: 'Offer Expired',
        badgeClass: 'bg-red-100 text-red-800 border-red-200',
        description: `Expired on ${endFormatted}`,
        isExpired: true
      };
    }

    if (now < start) {
      const startFormatted = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return {
        status: 'upcoming',
        label: 'Scheduled',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
        description: `Starts on ${startFormatted}`
      };
    }

    // Active within timeline
    const diffMs = end - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    let timeRemainingStr = '';
    if (diffDays > 0) {
      timeRemainingStr = `${diffDays}d ${diffHours}h left`;
    } else {
      timeRemainingStr = `${diffHours}h remaining`;
    }

    const endFormatted = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return {
      status: 'active',
      label: 'Active',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      timeRemaining: timeRemainingStr,
      description: `Ends ${endFormatted} (${timeRemainingStr})`
    };
  }

  return {
    status: 'active',
    label: 'Active Always',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: 'Ongoing offer'
  };
};

const DiscountConfig = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [discounts, setDiscounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [validationError, setValidationError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    type: 'percentage',
    value: '',
    buyQty: 2,
    getQty: 1,
    applicableTo: 'all',
    targetCategory: '',
    isActive: true,
    hasTimeline: false,
    startDate: getTodayDateStr(),
    startTime: '00:00',
    endDate: getFutureDateStr(4),
    endTime: '23:59',
    validityDays: 4
  });

  const fetchDiscounts = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/discounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDiscounts(response.data);
    } catch (error) {
      console.error('Error fetching discounts', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const items = await getMenuItems();
      if (Array.isArray(items)) {
        const catNames = items
          .map(i => (typeof i.category === 'object' && i.category !== null ? i.category.name : i.category))
          .filter(c => typeof c === 'string' && c.trim().length > 0);
        const uniqueCats = [...new Set(catNames)];
        setCategories(uniqueCats);
      }
    } catch (e) {
      console.error('Error fetching categories for discount config:', e);
    }
  };

  useEffect(() => {
    fetchDiscounts();
    fetchCategories();
  }, []);

  // Quick Preset Helper for Timeline
  const applyTimelinePreset = (days) => {
    const today = getTodayDateStr();
    const future = getFutureDateStr(days);
    setFormData(prev => ({
      ...prev,
      hasTimeline: true,
      startDate: today,
      startTime: '00:00',
      endDate: future,
      endTime: '23:59',
      validityDays: days
    }));
    setValidationError('');
  };

  // Conflict / Overlap Detection
  const conflictingOffers = useMemo(() => {
    if (!formData.isActive) return [];

    const activeList = discounts.filter(d => {
      if (editingDiscount && d._id === editingDiscount._id) return false;
      const st = getOfferStatus(d);
      return st.status === 'active' || st.status === 'upcoming';
    });

    const conflicts = [];
    const currentScope = formData.applicableTo;
    const currentCat = (formData.targetCategory || '').trim().toLowerCase();

    for (const d of activeList) {
      const targetCat = (typeof d.targetCategory === 'object' && d.targetCategory !== null ? d.targetCategory.name : d.targetCategory || '').trim().toLowerCase();
      
      if (currentScope === 'all') {
        if (d.applicableTo === 'all') {
          conflicts.push({
            offerName: d.name,
            type: d.type,
            value: d.value,
            scope: 'All Menu Items',
            message: `"${d.name}" (${d.type === 'percentage' ? `${d.value}% Off` : (d.type === 'bogo' ? 'BOGO' : `₹${d.value} Flat`)}) is already active on All Menu Items.`
          });
        } else if (d.applicableTo === 'category' && targetCat) {
          conflicts.push({
            offerName: d.name,
            type: d.type,
            value: d.value,
            scope: `Category "${d.targetCategory}"`,
            message: `"${d.name}" is already active on Category "${d.targetCategory}".`
          });
        }
      } else if (currentScope === 'category' && currentCat) {
        if (d.applicableTo === 'all') {
          conflicts.push({
            offerName: d.name,
            type: d.type,
            value: d.value,
            scope: 'All Menu Items',
            message: `"${d.name}" is active across All Menu Items (including "${formData.targetCategory}").`
          });
        } else if (d.applicableTo === 'category' && targetCat === currentCat) {
          conflicts.push({
            offerName: d.name,
            type: d.type,
            value: d.value,
            scope: `Category "${formData.targetCategory}"`,
            message: `Category "${formData.targetCategory}" is already applied in active offer "${d.name}" (${d.type === 'percentage' ? `${d.value}% Off` : (d.type === 'bogo' ? 'BOGO' : `₹${d.value} Flat`)}).`
          });
        }
      }
    }

    return conflicts;
  }, [formData.applicableTo, formData.targetCategory, formData.isActive, discounts, editingDiscount]);

  // Identify expired offers for notification banner
  const expiredOffers = useMemo(() => {
    return discounts.filter(d => getOfferStatus(d).status === 'expired');
  }, [discounts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    // Start date & End date validations
    if (formData.hasTimeline) {
      if (!formData.startDate || !formData.endDate) {
        setValidationError(t('Start Date and End Date are mandatory when enabling an offer timeline.'));
        return;
      }

      const sDate = new Date(`${formData.startDate}T${formData.startTime || '00:00'}:00`);
      const eDate = new Date(`${formData.endDate}T${formData.endTime || '23:59'}:00`);

      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
        setValidationError(t('Invalid Start or End Date & Time format.'));
        return;
      }

      if (sDate > eDate) {
        setValidationError(t('Start Date & Time cannot be later than End Date & Time. Please adjust the timeline.'));
        return;
      }
    }

    if (formData.applicableTo === 'category' && !formData.targetCategory) {
      setValidationError(t('Please select a specific category.'));
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const payload = {
        name: formData.name.trim(),
        type: formData.type,
        value: formData.type === 'bogo' ? 0 : Number(formData.value) || 0,
        buyQty: formData.type === 'bogo' ? (Number(formData.buyQty) || 2) : 2,
        getQty: formData.type === 'bogo' ? (Number(formData.getQty) || 1) : 1,
        applicableTo: formData.applicableTo,
        targetCategory: formData.applicableTo === 'category' ? formData.targetCategory : '',
        isActive: formData.isActive,
        hasTimeline: formData.hasTimeline,
        startDate: formData.hasTimeline ? formData.startDate : null,
        endDate: formData.hasTimeline ? formData.endDate : null,
        startTime: formData.hasTimeline ? (formData.startTime || '00:00') : '00:00',
        endTime: formData.hasTimeline ? (formData.endTime || '23:59') : '23:59',
        validityDays: formData.hasTimeline ? Number(formData.validityDays) || 0 : 0
      };

      if (editingDiscount) {
        await axios.put(`${getApiUrl()}/discounts/${editingDiscount._id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${getApiUrl()}/discounts`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      setIsModalOpen(false);
      setEditingDiscount(null);
      fetchDiscounts();
    } catch (error) {
      console.error('Error saving discount', error);
      const msg = error.response?.data?.message || 'Error saving discount';
      setValidationError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('Are you sure you want to delete this discount/offer?'))) {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        await axios.delete(`${getApiUrl()}/discounts/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        fetchDiscounts();
      } catch (error) {
        console.error('Error deleting discount', error);
        alert(t('Error deleting discount'));
      }
    }
  };

  const handleEditClick = (discount) => {
    setEditingDiscount(discount);
    setValidationError('');
    const catName = typeof discount.targetCategory === 'object' && discount.targetCategory !== null
      ? discount.targetCategory.name
      : (discount.targetCategory || '');

    const sDate = discount.startDate ? discount.startDate.split('T')[0] : getTodayDateStr();
    const eDate = discount.endDate ? discount.endDate.split('T')[0] : getFutureDateStr(4);

    setFormData({
      name: discount.name || '',
      type: discount.type || 'percentage',
      value: discount.value || '',
      buyQty: discount.buyQty || 2,
      getQty: discount.getQty || 1,
      applicableTo: discount.applicableTo || 'all',
      targetCategory: catName,
      isActive: discount.isActive !== undefined ? discount.isActive : true,
      hasTimeline: !!discount.hasTimeline,
      startDate: sDate,
      startTime: discount.startTime || '00:00',
      endDate: eDate,
      endTime: discount.endTime || '23:59',
      validityDays: discount.validityDays || 4
    });
    setIsModalOpen(true);
  };

  const openNewModal = (initialType = 'percentage') => {
    setEditingDiscount(null);
    setValidationError('');
    setFormData({
      name: '',
      type: initialType,
      value: '',
      buyQty: 2,
      getQty: 1,
      applicableTo: 'all',
      targetCategory: categories[0] || '',
      isActive: true,
      hasTimeline: true, // Default to true so 4-day timeline is ready
      startDate: getTodayDateStr(),
      startTime: '00:00',
      endDate: getFutureDateStr(4),
      endTime: '23:59',
      validityDays: 4
    });
    setIsModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-4 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-xl font-black text-gray-800 tracking-tight">
              {t("Discounts & BOGO Offers")}
            </h1>
            <p className="text-xs text-gray-500">{t("Configure percentage discounts, flat reductions, custom Buy X Get Y Free rules, and dynamic timeline validity.")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            onClick={() => openNewModal('bogo')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-3 py-2 rounded-xl transition-all text-xs font-bold shadow-sm active:scale-95 cursor-pointer">
            <Gift size={15} />
            <span>{t("Add BOGO Rule")}</span>
          </button>
          <button
            onClick={() => openNewModal('percentage')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-xl transition-all text-xs font-bold shadow-sm active:scale-95 cursor-pointer">
            <Plus size={16} />
            <span>{t("Add Discount")}</span>
          </button>
        </div>
      </div>

      {/* EXPIRED OFFERS NOTIFICATION BANNER */}
      {expiredOffers.length > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200/80 rounded-2xl p-3.5 shadow-sm flex items-start gap-3">
          <div className="p-2 bg-red-100 text-red-600 rounded-xl shrink-0 mt-0.5">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-red-900 text-sm">{t("Offer Expired Notification")}</span>
              <span className="bg-red-200 text-red-900 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                {expiredOffers.length} {t("Expired")}
              </span>
            </div>
            <p className="text-red-700 mt-1 leading-relaxed">
              {t("The following offer(s) have passed their scheduled end date and are now expired:")}{' '}
              <span className="font-bold">
                {expiredOffers.map(o => `"${o.name}"`).join(', ')}
              </span>.
              {' '}{t("Expired offers are automatically deactivated from billing calculations. You can edit them to extend their dates or delete them.")}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mb-3"></div>
          <p className="text-xs text-gray-500 font-semibold">{t("Loading discounts & offers...")}</p>
        </div>
      ) : discounts.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-12 text-center text-gray-400">
          <div className="flex flex-col items-center justify-center">
            <Tags size={36} className="text-gray-300 mb-2.5" />
            <p className="font-bold text-gray-700 text-sm mb-1">{t("No discounts or BOGO offers configured yet")}</p>
            <p className="text-xs text-gray-400 max-w-sm">{t("Create custom BOGO deals or promo codes to apply them on the billing page.")}</p>
          </div>
        </div>
      ) : (
        <>
          {/* MOBILE VIEW (< sm): Responsive Cards */}
          <div className="block sm:hidden space-y-3">
            {discounts.map((discount) => {
              const statusInfo = getOfferStatus(discount);
              return (
                <div key={discount._id} className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-200 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${discount.type === 'bogo' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-primary'}`}>
                        {discount.type === 'bogo' ? <Gift size={15} /> : <Tags size={15} />}
                      </div>
                      <span className="font-bold text-gray-900 text-xs truncate">{discount.name}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleEditClick(discount)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title={t("Edit")}>
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(discount._id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title={t("Delete")}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100 text-[11px]">
                    <span className={`px-2 py-0.5 rounded-full font-black uppercase text-[10px] border ${
                      discount.type === 'bogo'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : discount.type === 'percentage'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {discount.type === 'bogo' ? t("BOGO") : discount.type === 'percentage' ? t("% Off") : t("₹ Flat")}
                    </span>

                    <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded">
                      {discount.type === 'bogo' ? `Buy ${discount.buyQty || 2} Get ${discount.getQty || 1} Free` : (discount.type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`)}
                    </span>

                    <span className="bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded font-bold text-[10px]">
                      {discount.applicableTo === 'category'
                        ? (typeof discount.targetCategory === 'object' && discount.targetCategory !== null
                            ? discount.targetCategory.name
                            : (discount.targetCategory || t("Category")))
                        : t("All Items")}
                    </span>

                    <span className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badgeClass}`}>
                      {statusInfo.status === 'active' && <CheckCircle2 size={10} />}
                      {statusInfo.status === 'expired' && <AlertTriangle size={10} />}
                      {statusInfo.status === 'upcoming' && <Clock size={10} />}
                      {statusInfo.status === 'inactive' && <XCircle size={10} />}
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  {discount.hasTimeline && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 font-medium">
                      <Timer size={12} className={statusInfo.status === 'expired' ? 'text-red-500' : 'text-primary'} />
                      <span>{statusInfo.description}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* DESKTOP & TABLET VIEW (>= sm): Dynamic Width Columns Table */}
          <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-xs font-black text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Offer / Discount Name")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Type")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Rule / Value")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Applies To")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Timeline & Validity")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">{t("Status")}</th>
                    <th className="px-5 py-3.5 whitespace-nowrap text-right">{t("Actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {discounts.map((discount) => {
                    const statusInfo = getOfferStatus(discount);
                    return (
                      <tr key={discount._id} className={`transition-colors ${statusInfo.status === 'expired' ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-orange-50/30'}`}>
                        <td className="px-5 py-3.5 font-bold text-gray-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {discount.type === 'bogo' ? (
                              <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg shrink-0">
                                <Gift size={15} />
                              </div>
                            ) : (
                              <div className="p-1.5 bg-blue-100 text-primary rounded-lg shrink-0">
                                <Tags size={15} />
                              </div>
                            )}
                            <div>
                              <span>{discount.name}</span>
                              {statusInfo.status === 'expired' && (
                                <span className="ml-2 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded border border-red-200">
                                  {t("EXPIRED")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            discount.type === 'bogo'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : discount.type === 'percentage'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {discount.type === 'bogo' ? t("BOGO Offer") : discount.type === 'percentage' ? t("Percentage (%)") : t("Flat (₹)")}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 font-bold text-gray-800 whitespace-nowrap font-mono">
                          {discount.type === 'bogo' ? (
                            <span className="text-orange-600">
                              Buy {discount.buyQty || 2} Get {discount.getQty || 1} Free
                            </span>
                          ) : discount.type === 'percentage' ? (
                            <span>{discount.value}%</span>
                          ) : (
                            <span>₹{discount.value}</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap">
                          {discount.applicableTo === 'category' ? (
                            <span className="bg-orange-50 text-orange-800 border border-orange-200/60 px-2 py-0.5 rounded-md font-bold text-[11px]">
                              {typeof discount.targetCategory === 'object' && discount.targetCategory !== null
                                ? (discount.targetCategory.name || 'Category')
                                : (discount.targetCategory || t("Category"))}
                            </span>
                          ) : (
                            <span className="text-gray-500 font-medium">{t("All Items")}</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          {discount.hasTimeline ? (
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-800 flex items-center gap-1">
                                <Clock size={12} className={statusInfo.status === 'expired' ? 'text-red-500' : 'text-primary'} />
                                {statusInfo.description}
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {discount.startDate ? new Date(discount.startDate).toLocaleDateString() : ''} → {discount.endDate ? new Date(discount.endDate).toLocaleDateString() : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-medium">{t("Always Active (No expiry)")}</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.badgeClass}`}>
                            {statusInfo.status === 'active' && <CheckCircle2 size={11} />}
                            {statusInfo.status === 'expired' && <AlertTriangle size={11} />}
                            {statusInfo.status === 'upcoming' && <Clock size={11} />}
                            {statusInfo.status === 'inactive' && <XCircle size={11} />}
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-1">
                            <button
                              onClick={() => handleEditClick(discount)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title={t("Edit")}>
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(discount._id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title={t("Delete")}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-gray-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-orange-500/10 to-amber-500/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-500 text-white rounded-lg">
                  {formData.type === 'bogo' ? <Gift size={18} /> : <Tags size={18} />}
                </div>
                <h2 className="text-base font-black text-gray-900">
                  {editingDiscount ? t("Edit Offer / Discount") : t("Add Offer / Discount")}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Validation Error Box */}
              {validationError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <span className="font-semibold">{validationError}</span>
                </div>
              )}

              {/* OVERLAP / CONFLICT VALIDATION WARNING BANNER */}
              {conflictingOffers.length > 0 && formData.isActive && (
                <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs flex flex-col gap-1.5 text-amber-950">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                    <span>{t("Active Offer Overlap Notice")}</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-snug">
                    {t("The scope you selected overlaps with already active offer(s):")}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] font-medium text-amber-800 pl-1">
                    {conflictingOffers.map((c, i) => (
                      <li key={i}>{c.message}</li>
                    ))}
                  </ul>
                  <p className="text-[10px] text-amber-700 italic">
                    {t("You can still proceed, but having multiple active offers for the same items can lead to overlapping discounts.")}
                  </p>
                </div>
              )}

              {/* Offer Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {t("Offer Type")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'bogo' })}
                    className={`py-2 px-2 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                      formData.type === 'bogo'
                        ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    🎁 {t("BOGO Offer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'percentage' })}
                    className={`py-2 px-2 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                      formData.type === 'percentage'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    % {t("Percentage")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, type: 'flat' })}
                    className={`py-2 px-2 rounded-xl font-bold text-xs border text-center transition-all cursor-pointer ${
                      formData.type === 'flat'
                        ? 'bg-primary text-white border-primary shadow-sm'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    ₹ {t("Flat Off")}
                  </button>
                </div>
              </div>

              {/* Offer Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {formData.type === 'bogo' ? t("Offer Title (e.g. Biryani BOGO or Buy 2 Get 1)") : t("Discount Name (e.g. SUMMER20 or Staff 10%)")}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                  placeholder={formData.type === 'bogo' ? "Weekend BOGO Deal" : "Testing Offer"}
                />
              </div>

              {/* Dynamic Inputs based on Type */}
              {formData.type === 'bogo' ? (
                <div className="space-y-3 bg-orange-50/50 p-3.5 rounded-xl border border-orange-200/70">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-orange-950 uppercase mb-1">
                        {t("Buy Quantity (X)")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.buyQty}
                        onChange={(e) => setFormData({ ...formData, buyQty: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm font-bold text-gray-900 outline-none focus:border-orange-500 font-mono"
                        placeholder="2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-orange-950 uppercase mb-1">
                        {t("Get Free Qty (Y)")}
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.getQty}
                        onChange={(e) => setFormData({ ...formData, getQty: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm font-bold text-gray-900 outline-none focus:border-orange-500 font-mono"
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {formData.type === 'percentage' ? t("Discount Value (%)") : t("Discount Amount (₹)")}
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max={formData.type === 'percentage' ? '100' : undefined}
                    step={formData.type === 'percentage' ? '0.1' : '1'}
                    value={formData.value}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (formData.type === 'percentage' && val !== '') {
                        const num = parseFloat(val);
                        setFormData({ ...formData, value: isNaN(num) ? '' : Math.min(100, Math.max(0, num)) });
                      } else {
                        setFormData({ ...formData, value: val });
                      }
                    }}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-bold font-mono"
                    placeholder={formData.type === 'percentage' ? "18 (Max 100%)" : "50"}
                  />
                </div>
              )}

              {/* Applies To Category Selector (Available for BOGO, Percentage, Flat) */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200/80 space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  {t("Applies To")}
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.applicableTo}
                    onChange={(e) => setFormData({ ...formData, applicableTo: e.target.value })}
                    className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-primary"
                  >
                    <option value="all">{t("All Menu Items")}</option>
                    <option value="category">{t("Specific Category")}</option>
                  </select>

                  {formData.applicableTo === 'category' && (
                    <select
                      value={formData.targetCategory}
                      onChange={(e) => setFormData({ ...formData, targetCategory: e.target.value })}
                      className="w-1/2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-primary"
                    >
                      <option value="">{t("Select Category...")}</option>
                      {categories.map((c, idx) => {
                        const val = typeof c === 'object' && c !== null ? c.name : String(c);
                        return (
                          <option key={idx} value={val}>{val}</option>
                        );
                      })}
                    </select>
                  )}
                </div>
                {formData.applicableTo === 'category' && !formData.targetCategory && (
                  <p className="text-[10px] text-amber-600 font-medium">
                    {t("Please select which category this discount will apply to.")}
                  </p>
                )}
              </div>

              {/* DYNAMIC TIMELINE & DATE-TIME SCHEDULING SECTION */}
              <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/60 p-4 rounded-xl border border-indigo-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-indigo-600" />
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                      {t("Offer Validity & Timeline")}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasTimeline}
                      onChange={(e) => setFormData({ ...formData, hasTimeline: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {formData.hasTimeline ? (
                  <div className="space-y-3 pt-1">
                    {/* Quick Preset Buttons */}
                    <div>
                      <span className="text-[10px] font-bold text-indigo-900 block mb-1">
                        {t("Quick Duration Presets:")}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyTimelinePreset(1)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          {t("Today Only (24h)")}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTimelinePreset(3)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          {t("3 Days")}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTimelinePreset(4)}
                          className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[11px] rounded-lg border border-indigo-600 transition-colors shadow-2xs cursor-pointer"
                        >
                          {t("4 Days (Recommended)")}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyTimelinePreset(7)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                        >
                          {t("1 Week (7d)")}
                        </button>
                      </div>
                    </div>

                    {/* Start Date & Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-950 uppercase mb-1">
                          {t("Start Date *")}
                        </label>
                        <input
                          type="date"
                          required={formData.hasTimeline}
                          value={formData.startDate}
                          onChange={(e) => {
                            setFormData({ ...formData, startDate: e.target.value });
                            setValidationError('');
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-950 uppercase mb-1">
                          {t("Start Time")}
                        </label>
                        <input
                          type="time"
                          value={formData.startTime}
                          onChange={(e) => {
                            setFormData({ ...formData, startTime: e.target.value });
                            setValidationError('');
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    {/* End Date & Time */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-950 uppercase mb-1">
                          {t("End Date (Expiry) *")}
                        </label>
                        <input
                          type="date"
                          required={formData.hasTimeline}
                          value={formData.endDate}
                          onChange={(e) => {
                            setFormData({ ...formData, endDate: e.target.value });
                            setValidationError('');
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-950 uppercase mb-1">
                          {t("End Time")}
                        </label>
                        <input
                          type="time"
                          value={formData.endTime}
                          onChange={(e) => {
                            setFormData({ ...formData, endTime: e.target.value });
                            setValidationError('');
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-800 outline-none focus:border-indigo-600"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-indigo-700/90 font-medium">
                      {t("Once the end date & time passes, the offer will automatically expire and be disabled during billing.")}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 font-medium">
                    {t("Timeline disabled. This offer will remain active continuously until manually deactivated.")}
                  </p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary cursor-pointer"
                />
                <label htmlFor="isActive" className="text-xs font-bold text-gray-700 cursor-pointer">
                  {t("Offer is currently enabled for billing")}
                </label>
              </div>

              <div className="pt-3 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs transition-colors cursor-pointer">
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-white bg-primary hover:bg-primary-hover rounded-xl font-bold text-xs shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-75">
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin text-white" />
                      <span>{editingDiscount ? t("Updating Offer...") : t("Saving Offer...")}</span>
                    </>
                  ) : (
                    <span>{editingDiscount ? t("Update Offer") : t("Save Offer")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountConfig;