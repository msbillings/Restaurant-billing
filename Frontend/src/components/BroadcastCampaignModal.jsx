import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Users, Star, Clock, Image, RefreshCw, CheckCircle2, 
  AlertCircle, Pause, Play, Square, Check, Sparkles, ChevronDown, ChevronUp, Search, Info
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { sendWhatsAppBill, sendWhatsAppMessage, logWhatsAppCampaign } from '../api/whatsapp';
import { getApiUrl } from '../config';
import { getOfferCategoryMeta } from './DiscountConfig';

const BroadcastCampaignModal = ({ isOpen, onClose, discount, restaurantName = '', initialTarget = 'all' }) => {
  const { t } = useLanguage();

  // Step / UI State
  const [step, setStep] = useState('compose'); // 'compose' | 'sending' | 'completed'
  const [customers, setCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [segment, setSegment] = useState(initialTarget); // 'all' | 'vip' | 'inactive'
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Message & Media State
  const [customMessage, setCustomMessage] = useState('');
  const [flyerImage, setFlyerImage] = useState(null); // base64
  const [flyerFileName, setFlyerFileName] = useState('');
  const [flyerDetails, setFlyerDetails] = useState(null); // { name, sizeStr, rawSize, ext, mimeType, width, height }
  const [flyerError, setFlyerError] = useState('');
  const [campaignEndDate, setCampaignEndDate] = useState(() => {
    if (discount?.endDate) {
      try {
        return new Date(discount.endDate).toISOString().split('T')[0];
      } catch (e) {}
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });

  // Queue & Progress State
  const [isPaused, setIsPaused] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deliveryLog, setDeliveryLog] = useState([]);
  const [stats, setStats] = useState({ sent: 0, failed: 0, total: 0 });

  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    isCancelledRef.current = isCancelled;
  }, [isCancelled]);

  // Construct default message from discount
  useEffect(() => {
    if (!discount) return;

    let offerSummary = discount.name || 'Special Offer';
    if (discount.type === 'percentage') {
      offerSummary = `${discount.value}% OFF`;
    } else if (discount.type === 'flat') {
      offerSummary = `₹${discount.value} OFF`;
    } else if (discount.type === 'bogo') {
      offerSummary = `Buy ${discount.buyQty || 2} Get ${discount.getQty || 1} Free`;
    }

    // Determine dynamic end date: use discount.endDate if present, or default dynamically to 7 days from now
    let initialEndDate = '';
    if (discount.endDate) {
      try {
        initialEndDate = new Date(discount.endDate).toISOString().split('T')[0];
      } catch (e) {}
    }
    if (!initialEndDate) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      initialEndDate = d.toISOString().split('T')[0];
    }
    setCampaignEndDate(initialEndDate);

    const validityStr = formatValidityDate(initialEndDate);

    const categoryTitle = discount.offerCategory || 'Special Offer';
    let headerEmoji = '🎉';
    if (/festival/i.test(categoryTitle)) headerEmoji = '🎉';
    else if (/weekend/i.test(categoryTitle)) headerEmoji = '⚡';
    else if (/birthday/i.test(categoryTitle)) headerEmoji = '🎂';
    else if (/anniversary/i.test(categoryTitle)) headerEmoji = '💍';
    else if (/opening/i.test(categoryTitle)) headerEmoji = '🚀';
    else if (/menu/i.test(categoryTitle)) headerEmoji = '🍲';
    else if (/lunch/i.test(categoryTitle)) headerEmoji = '☀️';
    else if (/dinner/i.test(categoryTitle)) headerEmoji = '🌙';
    else if (/coupon/i.test(categoryTitle)) headerEmoji = '🎟️';
    else if (/loyal|vip/i.test(categoryTitle)) headerEmoji = '👑';

    const defaultText = `${headerEmoji} *${categoryTitle} from ${restaurantName || 'our restaurant'}!*

Hi *[Name]*,
Enjoy our exclusive *${offerSummary}* on your next visit! 🍽️

🏷️ *Offer:* ${discount.name}
✨ *Occasion:* ${categoryTitle}
🗓️ *Valid Until:* ${validityStr}

Show this message at the billing counter to claim your discount.
Visit us today! ✨`;

    setCustomMessage(defaultText);

    if (/loyal|vip/i.test(categoryTitle)) {
      setSegment('vip');
    }
  }, [discount, restaurantName]);

  // Fetch customers from backend / localStorage cache
  useEffect(() => {
    if (!isOpen) return;

    const loadCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const cached = localStorage.getItem('resto_crm_cache');
        let custList = [];
        if (cached) {
          try {
            custList = JSON.parse(cached);
          } catch (e) {}
        }

        if (!custList || custList.length === 0) {
          const API_BASE_URL = getApiUrl();
          const res = await fetch(`${API_BASE_URL}/customers`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken') || localStorage.getItem('token') || ''}`,
              'X-Tenant-DB': localStorage.getItem('resto_db_name') || ''
            }
          });
          if (res.ok) {
            custList = await res.json();
            localStorage.setItem('resto_crm_cache', JSON.stringify(custList));
          }
        }

        const validCustomers = (Array.isArray(custList) ? custList : []).filter(c => c.phone && String(c.phone).trim().length >= 10);
        setCustomers(validCustomers);

        // Auto-select based on initial segment
        applySegmentSelection(validCustomers, segment);
      } catch (err) {
        console.error('Failed to load customers for broadcast:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    loadCustomers();
  }, [isOpen]);

  const applySegmentSelection = (list, targetSegment) => {
    let filtered = list;
    const now = new Date();

    if (targetSegment === 'vip') {
      filtered = list.filter(c => c.isVIP || (c.totalVisits >= 5) || (c.totalSpend >= 5000));
    } else if (targetSegment === 'inactive') {
      filtered = list.filter(c => {
        if (!c.lastVisit) return true;
        const diffDays = (now - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24);
        return diffDays >= 30;
      });
    }

    const phoneSet = new Set(filtered.map(c => String(c.phone).trim()));
    setSelectedPhones(phoneSet);
  };

  const handleSegmentChange = (newSeg) => {
    setSegment(newSeg);
    applySegmentSelection(customers, newSeg);
  };

  const toggleCustomer = (phone) => {
    const clean = String(phone).trim();
    setSelectedPhones(prev => {
      const next = new Set(prev);
      if (next.has(clean)) {
        next.delete(clean);
      } else {
        next.add(clean);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPhones(new Set(customers.map(c => String(c.phone).trim())));
  };

  const deselectAll = () => {
    setSelectedPhones(new Set());
  };

  // Format file size into readable units (KB, MB)
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Flyer upload with frontend 5MB restriction and rich metadata extraction
  const handleFlyerUpload = (e) => {
    setFlyerError('');
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Enforce strict 5MB limit on frontend
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE_BYTES) {
      const actualSize = formatFileSize(file.size);
      setFlyerError(
        `File is too large (${actualSize}). The maximum allowed image size for WhatsApp broadcast is 5 MB. Please choose a smaller or compressed image.`
      );
      e.target.value = ''; // Disallow and reset input
      return;
    }

    // 2. Validate file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    if (!allowedExts.includes(ext) && !file.type.startsWith('image/')) {
      setFlyerError(
        `Unsupported file format (.${ext || 'unknown'}). Please choose a valid PNG, JPG, JPEG, or WEBP image.`
      );
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new window.Image();
      img.onload = () => {
        setFlyerImage(dataUrl);
        setFlyerFileName(file.name);
        setFlyerDetails({
          name: file.name,
          sizeStr: formatFileSize(file.size),
          rawSize: file.size,
          ext: ext.toUpperCase(),
          mimeType: file.type || `image/${ext}`,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
        setFlyerError('');
      };
      img.onerror = () => {
        setFlyerImage(dataUrl);
        setFlyerFileName(file.name);
        setFlyerDetails({
          name: file.name,
          sizeStr: formatFileSize(file.size),
          rawSize: file.size,
          ext: ext.toUpperCase(),
          mimeType: file.type || `image/${ext}`,
          width: null,
          height: null
        });
        setFlyerError('');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input to allow selecting same file again if modified
  };

  const removeFlyer = () => {
    setFlyerImage(null);
    setFlyerFileName('');
    setFlyerDetails(null);
    setFlyerError('');
  };

  // Helper to format validity date cleanly without generic text
  const formatValidityDate = (dateVal) => {
    if (!dateVal) return 'Limited Time Only';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return dateVal;
    }
  };

  // Dynamically update the selected campaign end date and sync with message text
  const handleEndDateChange = (newDate) => {
    setCampaignEndDate(newDate);
    const newValidityStr = formatValidityDate(newDate);
    setCustomMessage((prev) => {
      if (!prev) return prev;
      const regex = /(?:📅|🗓️|⏳|⏰)?\s*\*Valid Until:\*\s*[^\n]*/i;
      if (regex.test(prev)) {
        return prev.replace(regex, `🗓️ *Valid Until:* ${newValidityStr}`);
      }
      return `${prev}\n🗓️ *Valid Until:* ${newValidityStr}`;
    });
  };

  // Preview interpolation
  const getPreviewText = () => {
    let text = customMessage || '';
    text = text.replace(/\[Name\]/gi, 'Rahul');
    text = text.replace(/\[Restaurant\]/gi, restaurantName || 'Our Restaurant');
    text = text.replace(/\[Offer\]/gi, discount?.name || 'Special Offer');
    text = text.replace(/\[Category\]/gi, discount?.offerCategory || 'Special offers');
    text = text.replace(/\[Occasion\]/gi, discount?.offerCategory || 'Special offers');
    const validityStr = formatValidityDate(campaignEndDate);
    text = text.replace(/\[Validity\]/gi, validityStr);
    return text;
  };

  // Parses WhatsApp markdown (*bold*) for the live mobile chat preview bubble
  const renderWhatsAppFormattedText = (rawText) => {
    if (!rawText) return null;
    const lines = rawText.split('\n');
    return lines.map((line, lineIdx) => {
      const parts = [];
      let lastIndex = 0;
      const regex = /\*([^*]+)\*/g;
      let match;
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(
          <strong key={match.index} className="font-bold text-gray-950">
            {match[1]}
          </strong>
        );
        lastIndex = regex.lastIndex;
      }
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      return (
        <React.Fragment key={lineIdx}>
          {parts.length > 0 ? parts : line}
          {lineIdx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  // Start Broadcast Process
  const handleStartBroadcast = async () => {
    const recipients = customers.filter(c => selectedPhones.has(String(c.phone).trim()));
    if (recipients.length === 0) {
      alert('Please select at least one customer to send the offer to.');
      return;
    }

    setStep('sending');
    setIsPaused(false);
    setIsCancelled(false);
    isPausedRef.current = false;
    isCancelledRef.current = false;
    setCurrentIndex(0);
    setStats({ sent: 0, failed: 0, total: recipients.length });
    setDeliveryLog([]);

    let sentCount = 0;
    let failedCount = 0;
    const logEntries = [];

    for (let i = 0; i < recipients.length; i++) {
      if (isCancelledRef.current) {
        console.log('[Broadcast] Campaign cancelled by user.');
        break;
      }

      // Check if paused
      while (isPausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (isCancelledRef.current) break;
      }
      if (isCancelledRef.current) break;

      const customer = recipients[i];
      setCurrentIndex(i + 1);

      // Interpolate text for this specific customer
      const custName = customer.name || 'Valued Customer';
      let messageToSend = customMessage || '';
      messageToSend = messageToSend.replace(/\[Name\]/gi, custName);
      messageToSend = messageToSend.replace(/\[Restaurant\]/gi, restaurantName || 'Our Restaurant');
      messageToSend = messageToSend.replace(/\[Offer\]/gi, discount?.name || 'Special Offer');
      messageToSend = messageToSend.replace(/\[Category\]/gi, discount?.offerCategory || 'Special offers');
      messageToSend = messageToSend.replace(/\[Occasion\]/gi, discount?.offerCategory || 'Special offers');
      const validityStr = formatValidityDate(campaignEndDate);
      messageToSend = messageToSend.replace(/\[Validity\]/gi, validityStr);

      let success = false;
      let errorMsg = '';

      try {
        if (flyerImage) {
          // Send flyer image with caption
          await sendWhatsAppBill(customer.phone, messageToSend, flyerImage, null, flyerFileName || 'offer.jpg');
        } else {
          // Send formatted text message
          await sendWhatsAppMessage(customer.phone, messageToSend);
        }
        success = true;
        sentCount++;
      } catch (err) {
        console.warn(`[Broadcast] Failed to send to ${customer.phone}:`, err?.message || err);
        success = false;
        errorMsg = err?.response?.data?.error || err?.message || 'Send failed';
        failedCount++;
      }

      const logItem = {
        phone: customer.phone,
        name: custName,
        status: success ? 'delivered' : 'failed',
        error: errorMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      logEntries.unshift(logItem);
      setDeliveryLog([...logEntries]);
      setStats({ sent: sentCount, failed: failedCount, total: recipients.length });

      // Anti-Ban human jitter delay: 2.5s to 4.5s randomized pause between messages
      if (i < recipients.length - 1 && !isCancelledRef.current) {
        const jitterMs = 2500 + Math.floor(Math.random() * 2000);
        await new Promise(r => setTimeout(r, jitterMs));
      }
    }

    // Finished or cancelled
    setStep('completed');

    // Log campaign to backend
    try {
      await logWhatsAppCampaign({
        title: discount?.name ? `Broadcast: ${discount.name}` : 'WhatsApp Offer Broadcast',
        offerName: discount?.name || '',
        offerId: discount?._id || null,
        message: customMessage,
        imageUrl: flyerImage ? 'data:image_stored' : '',
        targetSegment: segment,
        totalRecipients: recipients.length,
        sentCount,
        failedCount,
        status: isCancelledRef.current ? 'cancelled' : 'completed',
        recipients: logEntries
      });
    } catch (logErr) {
      console.warn('[Broadcast] Could not save campaign log:', logErr);
    }
  };

  if (!isOpen) return null;

  const selectedCount = selectedPhones.size;
  const filteredCustomerList = customers.filter(c => {
    if (!customerSearch) return true;
    const term = customerSearch.toLowerCase();
    return (c.name && c.name.toLowerCase().includes(term)) || (c.phone && c.phone.includes(term));
  });

  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-3xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366] shadow-xs">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text-main flex items-center gap-2">
                {t("Broadcast Offer via WhatsApp")}
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Bulk
                </span>
              </h2>
              <p className="text-xs text-text-muted">
                {t("Send this discount flyer & promotional text to your customers")}
              </p>
            </div>
          </div>
          {step === 'compose' && (
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full hover:bg-surface-hover flex items-center justify-center transition-colors cursor-pointer text-text-muted hover:text-text-main"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {step === 'compose' && (
            <>
              {/* Selected Offer Summary Card */}
              {discount && (() => {
                const catMeta = getOfferCategoryMeta(discount.offerCategory);
                return (
                  <div className="p-3.5 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-200/70 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] uppercase font-black tracking-wider text-orange-700">
                          {t("Selected Offer")}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shadow-2xs ${catMeta.badgeColor}`}>
                          <span>{catMeta.icon}</span>
                          <span>{catMeta.label}</span>
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {discount.name}
                      </p>
                      <p className="text-xs text-orange-800/80 font-medium">
                        {discount.type === 'bogo'
                          ? `Buy ${discount.buyQty || 2} Get ${discount.getQty || 1} Free`
                          : discount.type === 'percentage'
                          ? `${discount.value}% OFF on ${discount.applicableTo === 'category' ? 'Selected Category' : 'All Menu Items'}`
                          : `₹${discount.value} Flat OFF`}
                      </p>
                    </div>
                    <span className="px-3 py-1 bg-white border border-orange-200 text-orange-700 text-xs font-black rounded-xl shrink-0 shadow-2xs">
                      {discount.type === 'bogo' ? 'BOGO' : discount.type === 'percentage' ? `${discount.value}%` : `₹${discount.value}`}
                    </span>
                  </div>
                );
              })()}

              {/* Step 1: Target Audience Selection */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-1.5">
                    <Users size={15} className="text-emerald-600" />
                    {t("Select Customer Audience")}
                  </label>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {selectedCount} {t("Selected")}
                  </span>
                </div>

                {/* Audience Segmentation Pills */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSegmentChange('all')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      segment === 'all'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-surface hover:bg-surface-hover text-text-main border-border'
                    }`}
                  >
                    <span>👥 {t("All Customers")}</span>
                    <span className={`text-[10px] ${segment === 'all' ? 'text-emerald-100' : 'text-text-muted'}`}>
                      {customers.length} {t("total")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSegmentChange('vip')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      segment === 'vip'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-surface hover:bg-surface-hover text-text-main border-border'
                    }`}
                  >
                    <span>⭐ {t("VIP Only")}</span>
                    <span className={`text-[10px] ${segment === 'vip' ? 'text-emerald-100' : 'text-text-muted'}`}>
                      {customers.filter(c => c.isVIP || c.totalVisits >= 5 || c.totalSpend >= 5000).length} {t("customers")}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSegmentChange('inactive')}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col items-center gap-1 cursor-pointer ${
                      segment === 'inactive'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-surface hover:bg-surface-hover text-text-main border-border'
                    }`}
                  >
                    <span>💤 {t("Inactive (30d+)")}</span>
                    <span className={`text-[10px] ${segment === 'inactive' ? 'text-emerald-100' : 'text-text-muted'}`}>
                      {customers.filter(c => {
                        if (!c.lastVisit) return true;
                        return (new Date() - new Date(c.lastVisit)) / (1000 * 60 * 60 * 24) >= 30;
                      }).length} {t("customers")}
                    </span>
                  </button>
                </div>

                {/* Customer List Collapsible Toggle */}
                <div className="border border-border rounded-xl bg-surface overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowCustomerList(!showCustomerList)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-text-main flex items-center justify-between hover:bg-surface-hover cursor-pointer"
                  >
                    <span>{t("Customise Individual Recipients")} ({selectedCount}/{customers.length})</span>
                    {showCustomerList ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showCustomerList && (
                    <div className="p-3 border-t border-border space-y-2 bg-background/50">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            type="text"
                            placeholder={t("Search by name or phone...")}
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-border rounded-lg text-xs outline-none focus:border-emerald-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={selectAll}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-white border border-border rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          {t("Select All")}
                        </button>
                        <button
                          type="button"
                          onClick={deselectAll}
                          className="px-2.5 py-1.5 text-[11px] font-bold bg-white border border-border rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          {t("Clear")}
                        </button>
                      </div>

                      <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                        {filteredCustomerList.map(c => {
                          const isSelected = selectedPhones.has(String(c.phone).trim());
                          return (
                            <label
                              key={c.phone}
                              className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                                isSelected ? 'bg-emerald-50/80 border border-emerald-200' : 'bg-white hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleCustomer(c.phone)}
                                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="font-semibold text-text-main truncate max-w-[130px]">
                                  {c.name || 'Unnamed Customer'}
                                </span>
                                {(c.isVIP || c.totalVisits >= 5) && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
                                    VIP
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-text-muted text-[11px] shrink-0">
                                +{c.phone}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Promotional Flyer Banner (Optional Image) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-1.5">
                    <Image size={15} className="text-emerald-600" />
                    <span>{t("Promotional Flyer / Photo (Optional)")}</span>
                    <span className="text-[10px] text-gray-400 font-normal">({t("Max 5MB")})</span>
                  </label>
                  {flyerImage && (
                    <button
                      type="button"
                      onClick={removeFlyer}
                      className="text-xs font-bold text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      {t("Remove Image")}
                    </button>
                  )}
                </div>

                {/* Friendly Error Banner for file > 5MB or invalid format */}
                {flyerError && (
                  <div className="p-3 bg-red-50/90 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800 shadow-2xs">
                    <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-red-900">{t("Upload Restricted")}</p>
                      <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{flyerError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFlyerError('')}
                      className="text-red-400 hover:text-red-700 p-1 cursor-pointer shrink-0"
                      title={t("Dismiss")}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {flyerImage ? (
                  <div className="relative rounded-2xl overflow-hidden border border-emerald-300/80 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        <img
                          src={flyerImage}
                          alt="Flyer Preview"
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-emerald-300 shadow-xs"
                        />
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 bg-emerald-700 text-white text-[9px] font-black rounded-md uppercase tracking-wider shadow-xs">
                          {flyerDetails?.ext || 'IMG'}
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs sm:text-sm font-bold text-gray-900 truncate max-w-xs sm:max-w-sm" title={flyerDetails?.name || flyerFileName}>
                            {flyerDetails?.name || flyerFileName}
                          </p>
                          <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded border border-emerald-200 uppercase shrink-0">
                            ✓ {t("Ready")}
                          </span>
                        </div>

                        {/* File Details Badges: Size, Format, Dimensions */}
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          {flyerDetails?.sizeStr && (
                            <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 font-bold rounded-md shadow-2xs">
                              📦 {flyerDetails.sizeStr}
                            </span>
                          )}
                          {flyerDetails?.ext && (
                            <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 font-bold rounded-md shadow-2xs">
                              🏷️ {flyerDetails.ext}
                            </span>
                          )}
                          {flyerDetails?.width && flyerDetails?.height && (
                            <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 font-bold rounded-md shadow-2xs">
                              📐 {flyerDetails.width} × {flyerDetails.height} px
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-emerald-100/90 border border-emerald-300 text-emerald-900 font-bold rounded-md shadow-2xs">
                            ✓ {t("Under 5MB limit")}
                          </span>
                        </div>

                        <p className="text-[11px] text-emerald-700 font-medium">
                          {t("✓ Attached to WhatsApp broadcast as flyer with caption")}
                        </p>
                      </div>
                    </div>

                    {/* Change / Remove Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <label className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs flex items-center gap-1">
                        <RefreshCw size={12} />
                        <span>{t("Change")}</span>
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          onChange={handleFlyerUpload}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={removeFlyer}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs"
                      >
                        {t("Remove")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 sm:p-5 border-2 border-dashed border-border hover:border-emerald-500/50 rounded-2xl bg-surface-hover hover:bg-emerald-50/20 cursor-pointer transition-colors group">
                    <Image size={26} className="text-text-muted group-hover:text-emerald-600 transition-colors mb-1.5" />
                    <span className="text-xs sm:text-sm font-bold text-text-main group-hover:text-emerald-700">
                      {t("Click to upload promo flyer or dish banner")}
                    </span>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted flex-wrap justify-center">
                      <span>Supported: <strong className="text-gray-700">PNG, JPG, JPEG, WEBP</strong></span>
                      <span>•</span>
                      <span className="text-emerald-700 font-bold">Max Size: 5 MB</span>
                    </div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      onChange={handleFlyerUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Campaign Validity / End Date Selector */}
              <div className="p-3 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 border border-emerald-200/80 rounded-2xl space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs sm:text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Clock size={15} className="text-emerald-600" />
                    <span>{t("Offer Validity (End Date)")}</span>
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-500 font-semibold">{t("Quick Presets:")}</span>
                    {[
                      { label: '+3 Days', days: 3 },
                      { label: '+7 Days', days: 7 },
                      { label: '+14 Days', days: 14 },
                      { label: 'End of Month', endOfMonth: true }
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          if (preset.endOfMonth) {
                            const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                            handleEndDateChange(lastDay.toISOString().split('T')[0]);
                          } else {
                            d.setDate(d.getDate() + preset.days);
                            handleEndDateChange(d.toISOString().split('T')[0]);
                          }
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg cursor-pointer transition-colors shadow-2xs"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <input
                      type="date"
                      value={campaignEndDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none shadow-2xs"
                    />
                  </div>
                  <div className="px-3 py-1.5 bg-emerald-100/90 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs">
                    <span>🗓️</span>
                    <span>{t("Valid Until:")} {formatValidityDate(campaignEndDate)}</span>
                  </div>
                </div>
              </div>

              {/* Step 3: Message Content & Placeholders */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs sm:text-sm font-bold text-text-main">
                      {t("WhatsApp Message Text")}
                    </label>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                      💡 *words* = <b>Bold</b> in WhatsApp
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted flex-wrap">
                    <span>{t("Click tags:")}</span>
                    {['[Name]', '[Offer]', '[Category]', '[Validity]'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setCustomMessage(prev => `${prev} ${tag}`)}
                        className="px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 font-mono font-bold cursor-pointer"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={6}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder={t("Type your promotional message here...")}
                  className="w-full px-3.5 py-2.5 bg-white border border-border rounded-xl text-xs sm:text-sm font-sans focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              {/* Step 4: Smartphone WhatsApp Live Chat Preview */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-600" />
                  {t("Live WhatsApp Mobile Preview")}
                </label>

                <div className="bg-[#efeae2] p-4 rounded-2xl border border-border max-w-sm mx-auto shadow-inner">
                  <div className="bg-[#075E54] text-white -mx-4 -mt-4 px-3.5 py-2 rounded-t-2xl flex items-center gap-2.5 shadow-sm mb-3">
                    <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center font-bold text-xs text-white shrink-0">
                      {restaurantName ? restaurantName.charAt(0).toUpperCase() : 'R'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight truncate">{restaurantName || 'Your Restaurant'}</p>
                      <p className="text-[9px] text-green-200">Online</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl rounded-tl-sm p-2.5 shadow-sm max-w-[95%] space-y-2">
                    {flyerImage && (
                      <img
                        src={flyerImage}
                        alt="Promo Preview"
                        className="w-full h-36 object-cover rounded-lg border border-slate-100"
                      />
                    )}
                    <div className="text-xs text-gray-800 leading-relaxed font-sans">
                      {renderWhatsAppFormattedText(getPreviewText())}
                    </div>
                    <p className="text-[9px] text-gray-400 text-right">
                      {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Sending State (Live Queue & Anti-Ban Progress Monitor) */}
          {(step === 'sending' || step === 'completed') && (
            <div className="py-4 space-y-5">
              {/* Progress Overview */}
              <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                      {step === 'completed' ? (
                        <>
                          <CheckCircle2 size={18} className="text-emerald-600" />
                          <span>{isCancelled ? t("Broadcast Stopped") : t("Broadcast Completed!")}</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw size={16} className={`text-emerald-600 ${isPaused ? '' : 'animate-spin'}`} />
                          <span>{isPaused ? t("Broadcast Paused") : t("Sending Messages...")}</span>
                        </>
                      )}
                    </h3>
                    <p className="text-xs text-emerald-800/80 mt-0.5">
                      {step === 'completed'
                        ? t("All selected recipients have been processed.")
                        : t("Safely throttled with 2-4s human delay to protect WhatsApp connection.")}
                    </p>
                  </div>

                  {step === 'sending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPaused(!isPaused)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        {isPaused ? <Play size={13} /> : <Pause size={13} />}
                        {isPaused ? t("Resume") : t("Pause")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsCancelled(true)}
                        className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Square size={12} />
                        {t("Cancel")}
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                      style={{ width: `${stats.total > 0 ? Math.round((currentIndex / stats.total) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-emerald-950">
                    <span>
                      {currentIndex} / {stats.total} {t("processed")} ({stats.total > 0 ? Math.round((currentIndex / stats.total) * 100) : 0}%)
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-emerald-700">✓ {stats.sent} {t("delivered")}</span>
                      {stats.failed > 0 && <span className="text-red-600">✗ {stats.failed} {t("failed")}</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Delivery Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-600" />
                  {t("Live Dispatch Activity")}
                </h4>
                <div className="max-h-56 overflow-y-auto space-y-1.5 border border-border rounded-xl p-2.5 bg-background/50">
                  {deliveryLog.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-4">{t("Starting dispatch queue...")}</p>
                  ) : (
                    deliveryLog.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium ${
                          item.status === 'delivered' ? 'bg-emerald-50/70 border border-emerald-100 text-emerald-950' : 'bg-red-50/70 border border-red-100 text-red-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {item.status === 'delivered' ? (
                            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                          ) : (
                            <AlertCircle size={14} className="text-red-500 shrink-0" />
                          )}
                          <span className="font-bold truncate max-w-[140px]">{item.name}</span>
                          <span className="font-mono text-text-muted text-[11px]">+{item.phone}</span>
                        </div>
                        <span className="text-[10px] text-text-muted shrink-0">{item.time}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-t border-border bg-surface shrink-0 flex items-center justify-end gap-3">
          {step === 'compose' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-border text-text-muted hover:bg-surface-hover cursor-pointer"
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                disabled={selectedCount === 0 || loadingCustomers}
                onClick={handleStartBroadcast}
                className="px-5 sm:px-6 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
              >
                <Send size={15} />
                <span>
                  {t("Broadcast to")} {selectedCount} {t("Customers")}
                </span>
              </button>
            </>
          ) : step === 'completed' ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
            >
              {t("Done & Close")}
            </button>
          ) : (
            <p className="text-xs text-text-muted font-medium italic">
              {isPaused ? t("Queue paused. Click Resume to continue.") : t("Sending in progress. Please keep this tab open...")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BroadcastCampaignModal;
