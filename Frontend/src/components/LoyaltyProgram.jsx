import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import {
  Award,
  Wallet,
  Gift,
  TrendingUp,
  Users,
  Plus,
  Trash2,
  MessageSquare,
  Sparkles,
  ShoppingBag,
  Coins,
  CheckCircle2,
  AlertCircle,
  Send,
  Loader2,
  Upload,
  Image as ImageIcon,
  Target,
  Megaphone,
  X,
  Eye,
  RefreshCw,
  Play,
  Check
} from 'lucide-react';
import { getMenuItems } from '../api/menu';

const LoyaltyProgram = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(true);
  const [loyaltyMode, setLoyaltyMode] = useState('spend'); // 'spend' | 'item' | 'both'
  const [conversionRate, setConversionRate] = useState('100'); // Rs 100 = 1 Point
  const [redemptionValue, setRedemptionValue] = useState('1'); // 1 Point = Rs 1
  const [minBillAmount, setMinBillAmount] = useState('0');
  const [maxRedemptionPercent, setMaxRedemptionPercent] = useState('100');
  const [walletExpiry, setWalletExpiry] = useState('365'); // days
  const [welcomeBonus, setWelcomeBonus] = useState('0');
  const [whatsappNotify, setWhatsappNotify] = useState(true);
  const [itemBonusRules, setItemBonusRules] = useState([]);

  // New item rule input state
  const [newItemName, setNewItemName] = useState('');
  const [newItemPoints, setNewItemPoints] = useState('5');
  const [availableMenuItems, setAvailableMenuItems] = useState([]);

  const [stats, setStats] = useState({ activeMembers: 0, pointsDistributed: 0, totalWalletBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // WhatsApp Gateway Integration State
  const [waStatus, setWaStatus] = useState({ status: 'CHECKING', connectedNumber: null });
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Loyalty Banner / Poster Image State
  const [loyaltyImageUrl, setLoyaltyImageUrl] = useState('');
  const [attachImageToReceipt, setAttachImageToReceipt] = useState(true);

  // Automated Bulk Campaign by Points State
  const [campaignFilter, setCampaignFilter] = useState('all_with_points'); // 'all_with_points' | 'min_points' | 'range_points' | 'vip' | 'all'
  const [campaignMinPoints, setCampaignMinPoints] = useState('50');
  const [campaignMaxPoints, setCampaignMaxPoints] = useState('500');
  const [audienceData, setAudienceData] = useState({ totalMatched: 0, customers: [] });
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [showAudienceList, setShowAudienceList] = useState(false);

  const [campaignTemplate, setCampaignTemplate] = useState(
`👑 *Exclusive Reward for {customerName}!*
🍽️ *{restaurantName}* | *VIP Privilege*
{read_more}
━━━━━━━━━━━━━━━━━━━━
You have *{points} Loyalty Points* (worth ₹{walletBalance}) ready to redeem! 🎁

Visit us this week to enjoy delicious food and redeem your points on any order! ✨`
  );

  const [campaignImageMode, setCampaignImageMode] = useState('default'); // 'default' | 'custom' | 'none'
  const [customCampaignImage, setCustomCampaignImage] = useState('');
  const [campaignSending, setCampaignSending] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [campaignProgress, setCampaignProgress] = useState(null); // { sent: 0, total: 0, status: 'sending' | 'complete', failCount: 0 }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };

        // Fetch config
        const configRes = await axios.get(`${getApiUrl()}/loyalty/config`, { headers });
        const config = configRes.data;
        if (config) {
          setEnabled(config.enabled ?? true);
          setLoyaltyMode(config.loyaltyMode || 'spend');
          setConversionRate(String(config.conversionRate ?? '100'));
          setRedemptionValue(String(config.redemptionValue ?? '1'));
          setMinBillAmount(String(config.minBillAmount ?? '0'));
          setMaxRedemptionPercent(String(config.maxRedemptionPercent ?? '100'));
          setWalletExpiry(String(config.walletExpiry ?? '365'));
          setWelcomeBonus(String(config.welcomeBonus ?? '0'));
          setWhatsappNotify(config.whatsappNotify !== false);
          setItemBonusRules(Array.isArray(config.itemBonusRules) ? config.itemBonusRules : []);
          setLoyaltyImageUrl(config.loyaltyImageUrl || '');
          setAttachImageToReceipt(config.attachImageToReceipt !== false);
        }

        // Fetch stats
        const statsRes = await axios.get(`${getApiUrl()}/loyalty/stats`, { headers });
        if (statsRes.data) {
          setStats(statsRes.data);
        }

        // Fetch WhatsApp Gateway status
        try {
          const waRes = await axios.get(`${getApiUrl()}/whatsapp/status`, { headers });
          if (waRes.data) {
            setWaStatus(waRes.data);
            if (waRes.data.connectedNumber) {
              setTestPhone(waRes.data.connectedNumber.replace(/^91/, ''));
            }
          }
        } catch (waErr) {
          console.warn('Could not fetch WhatsApp gateway status:', waErr);
          setWaStatus({ status: 'DISCONNECTED' });
        }

        // Fetch menu items for autocomplete/selector
        try {
          const menuData = await getMenuItems();
          if (Array.isArray(menuData)) {
            setAvailableMenuItems(menuData);
          }
        } catch (menuErr) {
          console.warn('Could not load menu items for loyalty rules:', menuErr);
        }
      } catch (err) {
        console.error('Error fetching loyalty data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const fetchAudience = async () => {
    setAudienceLoading(true);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${getApiUrl()}/loyalty/campaign/audience`, {
        headers,
        params: {
          filterType: campaignFilter,
          minPoints: campaignMinPoints,
          maxPoints: campaignMaxPoints
        }
      });
      if (res.data) {
        setAudienceData(res.data);
      }
    } catch (err) {
      console.warn('Error fetching campaign audience:', err);
    } finally {
      setAudienceLoading(false);
    }
  };

  useEffect(() => {
    fetchAudience();
  }, [campaignFilter, campaignMinPoints, campaignMaxPoints]);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(t('Image size should be less than 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setLoyaltyImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleCustomCampaignImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert(t('Image size should be less than 5MB'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomCampaignImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleLaunchCampaign = async () => {
    setShowConfirmModal(false);
    setCampaignSending(true);
    setCampaignProgress({ sent: 0, total: audienceData.totalMatched, status: 'sending', failCount: 0 });

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      let selectedImg = null;
      if (campaignImageMode === 'default') {
        selectedImg = loyaltyImageUrl || null;
      } else if (campaignImageMode === 'custom') {
        selectedImg = customCampaignImage || null;
      }

      const res = await axios.post(`${getApiUrl()}/loyalty/campaign/send`, {
        filterType: campaignFilter,
        minPoints: Number(campaignMinPoints) || 0,
        maxPoints: Number(campaignMaxPoints) || 999999,
        messageTemplate: campaignTemplate,
        imageUrl: selectedImg && !selectedImg.startsWith('data:image/') ? selectedImg : undefined,
        imageBase64: selectedImg && selectedImg.startsWith('data:image/') ? selectedImg : undefined
      }, { headers });

      const summary = res.data?.summary || {};
      setCampaignProgress({
        sent: summary.sentCount ?? audienceData.totalMatched,
        total: summary.totalTargeted ?? audienceData.totalMatched,
        failCount: summary.failCount || 0,
        status: 'complete'
      });
    } catch (err) {
      console.error('Error sending campaign:', err);
      const errMsg = err.response?.data?.message || err.message || t('Failed to send campaign');
      alert(`${t('Campaign Error')}: ${errMsg}`);
      setCampaignProgress(null);
    } finally {
      setCampaignSending(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    const cleanNumber = (testPhone || '').trim().replace(/\D/g, '').slice(-10);
    if (!cleanNumber || cleanNumber.length < 10) {
      setTestResult({ type: 'error', message: t('Please enter a valid 10-digit mobile number.') });
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.post(`${getApiUrl()}/loyalty/test-whatsapp`, {
        phone: cleanNumber
      }, { headers });
      setTestResult({
        type: 'success',
        message: res.data?.message || t('WhatsApp test alert delivered successfully!')
      });
    } catch (err) {
      console.error('Error sending test WhatsApp:', err);
      const errMsg = err.response?.data?.message || err.message || t('Failed to send test message');
      setTestResult({ type: 'error', message: errMsg });
    } finally {
      setTestSending(false);
    }
  };

  const handleAddItemRule = () => {
    const trimmedName = newItemName.trim();
    const points = parseInt(newItemPoints, 10);
    if (!trimmedName) {
      alert(t('Please enter or select a menu item name.'));
      return;
    }
    if (isNaN(points) || points <= 0) {
      alert(t('Please enter valid bonus points greater than 0.'));
      return;
    }

    const exists = itemBonusRules.some(
      r => r.itemName.toLowerCase() === trimmedName.toLowerCase()
    );
    if (exists) {
      setItemBonusRules(itemBonusRules.map(r =>
        r.itemName.toLowerCase() === trimmedName.toLowerCase()
          ? { ...r, bonusPoints: points }
          : r
      ));
    } else {
      setItemBonusRules([...itemBonusRules, { itemName: trimmedName, bonusPoints: points }]);
    }

    setNewItemName('');
    setNewItemPoints('5');
  };

  const handleRemoveItemRule = (indexToRemove) => {
    setItemBonusRules(itemBonusRules.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      await axios.post(`${getApiUrl()}/loyalty/config`, {
        enabled,
        loyaltyMode,
        conversionRate: Math.max(1, Number(conversionRate) || 100),
        redemptionValue: Math.max(0.1, Number(redemptionValue) || 1),
        minBillAmount: Math.max(0, Number(minBillAmount) || 0),
        maxRedemptionPercent: Math.min(100, Math.max(1, Number(maxRedemptionPercent) || 100)),
        walletExpiry: Math.max(1, Number(walletExpiry) || 365),
        welcomeBonus: Math.max(0, Number(welcomeBonus) || 0),
        itemBonusRules,
        whatsappNotify,
        loyaltyImageUrl,
        attachImageToReceipt
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving loyalty configuration:', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save configuration.';
      alert(`${t('Failed to save configuration')}: ${errMsg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-text-main tracking-tight flex items-center gap-2 truncate">
              <Award className="text-amber-500 shrink-0" size={22} />
              <span>{t("Dynamic Loyalty & CRM Program")}</span>
            </h1>
            <p className="text-xs text-text-muted truncate">
              {t("Reward customers like Reelo with customizable points, item bonuses & free WhatsApp")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <label className="flex items-center cursor-pointer gap-2 bg-background px-3 py-1.5 rounded-xl border border-border shadow-xs">
            <span className="text-xs sm:text-sm font-bold text-text-main">{t("Program Active")}</span>
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-surface-hover border border-border'}`}>
              <input type="checkbox" className="sr-only" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
            {saveSuccess ? (
              <>
                <CheckCircle2 size={16} className="text-white" />
                <span>{t("Saved!")}</span>
              </>
            ) : (
              <span>{saving ? t("Saving...") : t("Save All Rules")}</span>
            )}
          </button>
        </div>
      </div>

      <div className={`flex-1 w-full space-y-3 sm:space-y-3.5 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
        
        {/* KPI Summary Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider">{t("Active Members")}</div>
              <div className="text-xl sm:text-2xl font-black text-text-main mt-0.5">
                {loading ? '...' : stats.activeMembers.toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
          </div>

          <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider">{t("Points Issued")}</div>
              <div className="text-xl sm:text-2xl font-black text-amber-500 mt-0.5">
                {loading ? '...' : stats.pointsDistributed.toLocaleString()}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Award size={20} />
            </div>
          </div>

          <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider">{t("Customer Wallet Balances")}</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-600 font-mono mt-0.5">
                {loading ? '...' : `₹${stats.totalWalletBalance.toLocaleString()}`}
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wallet size={20} />
            </div>
          </div>
        </div>

        {/* Section 1: Earning Mode Selector */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                <Coins className="text-primary" size={18} />
                <span>{t("Point Earning Strategy")}</span>
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {t("Choose whether customers earn points based on money spent, ordered items, or both")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
            {[
              {
                id: 'spend',
                title: t('Money Spent Based'),
                desc: t('Earn points proportional to bill total (e.g., ₹100 = 1 pt)'),
                icon: <TrendingUp size={20} className="text-blue-500" />
              },
              {
                id: 'item',
                title: t('Item / Dish Based'),
                desc: t('Earn points strictly for ordering specific promotional items'),
                icon: <ShoppingBag size={20} className="text-amber-500" />
              },
              {
                id: 'both',
                title: t('Hybrid (Spend + Item Bonus)'),
                desc: t('Earn base points on bill total PLUS extra bonus points on featured items'),
                icon: <Sparkles size={20} className="text-purple-500" />
              }
            ].map(mode => (
              <button
                type="button"
                key={mode.id}
                onClick={() => setLoyaltyMode(mode.id)}
                className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  loyaltyMode === mode.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-background hover:bg-surface-hover'
                }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-1.5 rounded-lg bg-surface border border-border">{mode.icon}</div>
                  {loyaltyMode === mode.id && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {t("Active")}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-text-main">{mode.title}</h3>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">{mode.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Spend & Conversion Configuration */}
        {(loyaltyMode === 'spend' || loyaltyMode === 'both') && (
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-3">
            <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
              <TrendingUp className="text-primary" size={18} />
              <span>{t("Spend-to-Point Conversion Rules")}</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-background p-3.5 rounded-xl border border-border">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  {t("Earning Rate")}
                </label>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-text-main">{t("Every ₹")}</span>
                  <input
                    type="number"
                    min="1"
                    value={conversionRate}
                    onChange={(e) => setConversionRate(e.target.value)}
                    className="w-24 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-sm text-text-main focus:border-primary focus:outline-none"
                  />
                  <span className="font-bold text-xs sm:text-sm text-text-main">
                    {t("spent earns")} <strong className="text-primary font-black">1 Point</strong>
                  </span>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">
                  {t("Example: A ₹500 bill gives")} <strong>{Math.floor(500 / (Number(conversionRate) || 100))} pts</strong>
                </p>
              </div>

              <div className="bg-background p-3.5 rounded-xl border border-border">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                  {t("Minimum Bill To Qualify")}
                </label>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-text-main">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={minBillAmount}
                    onChange={(e) => setMinBillAmount(e.target.value)}
                    className="w-28 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-sm text-text-main focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-muted font-medium">{t("(0 = all bills qualify)")}</span>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">
                  {t("Bills below this amount will not accrue loyalty points")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Item-Based Bonus Rules */}
        {(loyaltyMode === 'item' || loyaltyMode === 'both') && (
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                  <ShoppingBag className="text-amber-500" size={18} />
                  <span>{t("Item-Based Bonus Points Rules")}</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {t("Reward customers with extra bonus points when ordering specific featured menu items")}
                </p>
              </div>
              <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full self-start">
                {itemBonusRules.length} {t("Rules Active")}
              </span>
            </div>

            {/* Add New Rule Form */}
            <div className="bg-background p-3 rounded-xl border border-border flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              <div className="flex-1">
                <input
                  type="text"
                  list="menu-items-list"
                  placeholder={t("Enter dish name (e.g. Biryani, Paneer Butter Masala)")}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-xs sm:text-sm font-medium text-text-main focus:border-primary focus:outline-none"
                />
                <datalist id="menu-items-list">
                  {availableMenuItems.map((item, idx) => (
                    <option key={item._id || idx} value={item.name} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-muted shrink-0">{t("Bonus:")}</span>
                <input
                  type="number"
                  min="1"
                  value={newItemPoints}
                  onChange={(e) => setNewItemPoints(e.target.value)}
                  className="w-20 px-3 py-2 bg-surface border border-border rounded-xl font-bold text-center text-xs sm:text-sm text-text-main focus:border-primary focus:outline-none"
                />
                <span className="text-xs font-bold text-amber-500 shrink-0">{t("pts")}</span>
              </div>

              <button
                type="button"
                onClick={handleAddItemRule}
                className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
                <Plus size={15} />
                <span>{t("Add Item Rule")}</span>
              </button>
            </div>

            {/* Existing Item Rules List */}
            {itemBonusRules.length === 0 ? (
              <div className="text-center py-5 border border-dashed border-border rounded-xl text-text-muted text-xs">
                {t("No item bonus rules created yet. Add menu items above to boost their sales!")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {itemBonusRules.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-background border border-border hover:border-amber-500/50 transition-all">
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-xs sm:text-sm text-text-main truncate">{rule.itemName}</div>
                      <div className="text-xs font-black text-amber-500 mt-0.5">+{rule.bonusPoints} {t("Points per item")}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRule(idx)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                      title={t("Delete rule")}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 4: Redemption & Wallet Settings */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-3">
          <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
            <Wallet className="text-emerald-500" size={18} />
            <span>{t("Redemption & Checkout Rules")}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-background p-3.5 rounded-xl border border-border">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                {t("Point Value in Cash")}
              </label>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-text-main">1 Point = ₹</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={redemptionValue}
                  onChange={(e) => setRedemptionValue(e.target.value)}
                  className="w-20 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-sm text-text-main focus:border-primary focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                {t("Converted to customer's wallet balance upon earning")}
              </p>
            </div>

            <div className="bg-background p-3.5 rounded-xl border border-border">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                {t("Max Wallet Redemption %")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxRedemptionPercent}
                  onChange={(e) => setMaxRedemptionPercent(e.target.value)}
                  className="w-20 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-sm text-text-main focus:border-primary focus:outline-none"
                />
                <span className="font-bold text-xs sm:text-sm text-text-main">% {t("of bill total")}</span>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                {t("e.g. 50% = Customer can pay max half the bill using wallet")}
              </p>
            </div>

            <div className="bg-background p-3.5 rounded-xl border border-border">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                {t("First Visit Welcome Bonus")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  value={welcomeBonus}
                  onChange={(e) => setWelcomeBonus(e.target.value)}
                  className="w-20 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-sm text-text-main focus:border-primary focus:outline-none"
                />
                <span className="font-bold text-xs sm:text-sm text-primary">{t("Bonus Points")}</span>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                {t("Automatically credited when a new customer visits first time")}
              </p>
            </div>
          </div>

          <div className="bg-background p-3.5 rounded-xl border border-border flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Gift size={16} className="text-primary shrink-0" />
              <div>
                <span className="font-bold text-xs sm:text-sm text-text-main">{t("Wallet Expiry Duration")}</span>
                <p className="text-xs text-text-muted">{t("Wallet balance resets if customer is inactive for this long")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={walletExpiry}
                onChange={(e) => setWalletExpiry(e.target.value)}
                className="w-20 px-3 py-1.5 bg-surface border border-border rounded-xl font-bold text-center text-xs sm:text-sm text-text-main focus:border-primary focus:outline-none"
              />
              <span className="text-xs sm:text-sm font-bold text-text-main">{t("days")}</span>
            </div>
          </div>
        </div>

        {/* Section 4.5: Promotional Loyalty Flyer & Membership Card Image */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <ImageIcon size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                  <span>{t("Loyalty Promotional Flyer & Membership Poster")}</span>
                  <span className="bg-purple-500/10 text-purple-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {t("High Engagement")}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">
                  {t("Upload a reward poster, VIP card, or special dining offer banner to send with WhatsApp messages")}
                </p>
              </div>
            </div>

            <label className="flex items-center cursor-pointer gap-2 bg-background px-3 py-1.5 rounded-xl border border-border shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={attachImageToReceipt}
                onChange={(e) => setAttachImageToReceipt(e.target.checked)}
              />
              <span className="text-xs font-bold text-text-main">{t("Attach to Auto Receipts")}</span>
              <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${attachImageToReceipt ? 'bg-primary' : 'bg-surface-hover border border-border'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${attachImageToReceipt ? 'translate-x-4' : 'translate-x-1'}`} />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-center">
            {/* Flyer Upload / Dropzone */}
            <div className="md:col-span-2 space-y-2.5">
              <div className="relative border-2 border-dashed border-border hover:border-primary/50 bg-background rounded-2xl p-4 sm:p-6 text-center transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-text-main">
                    {loyaltyImageUrl ? t("Click or drag to replace promotional flyer") : t("Upload Loyalty Flyer or Membership Banner")}
                  </div>
                  <p className="text-[11px] text-text-muted">
                    {t("PNG, JPG, WEBP up to 5MB (Recommended: 1200x628 or 800x800)")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Sparkles size={14} className="text-amber-500 shrink-0" />
                <span>{t("Pro Tip: Attaching visual flyers increases WhatsApp message open rates and repeat visits by up to 40%.")}</span>
              </div>
            </div>

            {/* Flyer Live Preview Box */}
            <div className="bg-background rounded-2xl p-3 border border-border flex flex-col items-center justify-center relative min-h-[160px]">
              {loyaltyImageUrl ? (
                <div className="relative w-full h-full flex flex-col items-center">
                  <img
                    src={loyaltyImageUrl}
                    alt="Loyalty Banner"
                    className="w-full h-36 object-cover rounded-xl shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setLoyaltyImageUrl('')}
                    className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-lg hover:bg-red-700 shadow-sm transition-colors cursor-pointer"
                    title={t("Remove Image")}
                  >
                    <Trash2 size={13} />
                  </button>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-2">
                    {t("Active Loyalty Flyer ✓")}
                  </span>
                </div>
              ) : (
                <div className="text-center p-4 space-y-1 text-text-muted">
                  <ImageIcon size={32} className="mx-auto opacity-30" />
                  <p className="text-xs font-medium">{t("No flyer attached")}</p>
                  <span className="text-[10px]">{t("Messages will be sent as rich text")}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 5: WhatsApp CRM Integration (FREE via Baileys) */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                <MessageSquare size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2 flex-wrap">
                  <span>{t("Free WhatsApp Loyalty Notifications")}</span>
                  <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {t("100% Free / No Reelo Fees")}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">
                  {t("Automatically send point balance and wallet updates to customers after bill settlement")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              {/* Live WhatsApp Gateway Status Pill */}
              {waStatus.status === 'CONNECTED' ? (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 px-3 py-1 rounded-xl text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>+{waStatus.connectedNumber || 'Online'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-xl text-xs font-semibold">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{t("Gateway Offline")}</span>
                </div>
              )}

              <label className="flex items-center cursor-pointer gap-2 shrink-0">
                <span className="text-xs font-bold text-text-muted">{whatsappNotify ? t("Enabled") : t("Disabled")}</span>
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${whatsappNotify ? 'bg-emerald-500' : 'bg-surface-hover border border-border'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={whatsappNotify}
                    onChange={(e) => setWhatsappNotify(e.target.checked)}
                  />
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${whatsappNotify ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>
          </div>

          {/* WhatsApp Message Bubble Preview and Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 items-center">
            <div className="space-y-2 text-xs text-text-muted leading-relaxed">
              <p>
                {t("Customers receive an instant, personalized WhatsApp message with their earned points, available wallet balance, and a warm greeting after every bill.")}
              </p>
              <ul className="space-y-1 text-text-main font-medium list-disc list-inside">
                <li>{t("Zero per-message fees — routed directly through your linked WhatsApp")}</li>
                <li>{t("Includes customer name, bill amount, new points, and total wallet balance")}</li>
                <li>{t("Drives repeat restaurant visits effortlessly")}</li>
              </ul>
            </div>
            <div className="bg-emerald-950/5 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-500/20">
              <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                {t("Live Message Preview (Sent to Customer's WhatsApp)")}
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl p-3 shadow-sm border border-emerald-500/30 max-w-sm text-xs space-y-1.5 text-zinc-800 dark:text-zinc-200 font-sans">
                {loyaltyImageUrl && attachImageToReceipt && (
                  <img
                    src={loyaltyImageUrl}
                    alt="Receipt Flyer"
                    className="w-full h-28 object-cover rounded-lg mb-1.5 border border-border"
                  />
                )}
                <p>🌟 Hi <strong>Anand Kumar</strong>!</p>
                <p>Thank you for visiting <strong>{waStatus.restaurantName || (() => {
                  try { return JSON.parse(localStorage.getItem('restaurantSettings') || '{}').restaurantName; } catch (e) { return ''; }
                })() || 'our restaurant'}</strong>! 🍽️</p>
                <div className="bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40 space-y-1">
                  <p>⭐ <strong>Points Earned:</strong> 15 pts</p>
                  <p>🏆 <strong>Total Points:</strong> 130 pts</p>
                  <p>💰 <strong>Wallet Balance:</strong> ₹130</p>
                </div>
                <p className="text-zinc-500 dark:text-zinc-400 text-[11px]">Use your wallet balance on your next visit! 😊</p>
              </div>
            </div>
          </div>

          {/* Interactive Test WhatsApp Alert Section */}
          <div className="bg-background p-3 sm:p-4 rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Send size={14} className="text-primary" />
                {t("Send Live Test WhatsApp Notification")}
              </span>
              <span className="text-[11px] text-text-muted">
                {t("Verify immediate delivery to your phone")}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-text-muted">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-11 pr-3 py-2 bg-surface border border-border rounded-xl font-bold text-xs sm:text-sm text-text-main focus:border-primary focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={handleSendTestWhatsApp}
                disabled={testSending || !whatsappNotify}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                {testSending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>{t("Sending...")}</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>{t("Send Test Alert")}</span>
                  </>
                )}
              </button>
            </div>

            {testResult && (
              <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                testResult.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }`}>
                {testResult.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Section 6: Automated Bulk WhatsApp Campaigns (Targeted by Points) */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Megaphone size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2 flex-wrap">
                  <span>{t("Targeted WhatsApp Campaigns & Bulk Points Broadcast")}</span>
                  <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {t("Reelo Alternative")}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">
                  {t("Automate promotional broadcasts targeting customers by point balance with custom flyers and personalized tags")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/25 text-primary px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">
                <Target size={14} />
                <span>
                  {audienceLoading ? t("Calculating...") : `${audienceData.totalMatched} ${t("Customers Targeted")}`}
                </span>
              </div>
              {audienceData.totalMatched > 0 && (
                <button
                  type="button"
                  onClick={() => setShowAudienceList(!showAudienceList)}
                  className="px-2.5 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold text-text-main flex items-center gap-1 transition-colors cursor-pointer"
                  title={t("Preview Audience List")}
                >
                  <Eye size={13} />
                  <span>{showAudienceList ? t("Hide") : t("View")}</span>
                </button>
              )}
            </div>
          </div>

          {/* Optional Audience Preview Tray */}
          {showAudienceList && audienceData.customers.length > 0 && (
            <div className="bg-background p-3 rounded-xl border border-border space-y-2">
              <div className="text-xs font-bold text-text-main flex items-center justify-between">
                <span>{t("Targeted Recipients Preview")}</span>
                <span className="text-[11px] text-text-muted">{t("Showing top matching members")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {audienceData.customers.map(c => (
                  <div key={c._id || c.phone} className="bg-surface border border-border px-2.5 py-1 rounded-lg text-xs flex items-center gap-2 shadow-2xs">
                    <span className="font-bold text-text-main">{c.name || 'Customer'}</span>
                    <span className="text-text-muted text-[11px]">+{c.phone}</span>
                    <span className="bg-amber-500/10 text-amber-600 px-1.5 py-0.2 rounded font-black text-[10px]">
                      {c.points} pts
                    </span>
                    {c.isVIP && (
                      <span className="bg-purple-500/10 text-purple-600 px-1 py-0.2 rounded text-[9px] font-black">
                        VIP
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Targeting Criteria Selector Tabs */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">
              {t("1. Select Target Customer Segment by Points")}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { id: 'all_with_points', label: t('All Points Members'), desc: t('Points > 0') },
                { id: 'min_points', label: t('Minimum Points'), desc: `${campaignMinPoints}+ pts` },
                { id: 'range_points', label: t('Points Range'), desc: `${campaignMinPoints}-${campaignMaxPoints} pts` },
                { id: 'vip', label: t('VIP Members Only'), desc: t('VIP Status') },
                { id: 'all', label: t('All Customers'), desc: t('Full Database') }
              ].map(seg => (
                <button
                  type="button"
                  key={seg.id}
                  onClick={() => setCampaignFilter(seg.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    campaignFilter === seg.id
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary'
                      : 'border-border bg-background hover:bg-surface-hover'
                  }`}
                >
                  <span className="font-bold text-xs text-text-main">{seg.label}</span>
                  <span className="text-[10px] text-text-muted mt-0.5">{seg.desc}</span>
                </button>
              ))}
            </div>

            {/* Numeric Inputs for Range/Min */}
            {(campaignFilter === 'min_points' || campaignFilter === 'range_points') && (
              <div className="bg-background p-3 rounded-xl border border-border flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text-main">{t("Minimum Points:")}</span>
                  <input
                    type="number"
                    min="1"
                    value={campaignMinPoints}
                    onChange={(e) => setCampaignMinPoints(e.target.value)}
                    className="w-20 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-center text-text-main focus:border-primary focus:outline-none"
                  />
                </div>
                {campaignFilter === 'range_points' && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-text-main">{t("Maximum Points:")}</span>
                    <input
                      type="number"
                      min="1"
                      value={campaignMaxPoints}
                      onChange={(e) => setCampaignMaxPoints(e.target.value)}
                      className="w-20 px-2.5 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-center text-text-main focus:border-primary focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campaign Message Composer & Live Phone Mockup Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start pt-1">
            {/* Left Column: Composer */}
            <div className="lg:col-span-7 space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {t("2. Campaign Message Content")}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-text-muted font-bold">{t("Insert Tag:")}</span>
                    {[
                      { tag: '{customerName}', label: '{name}' },
                      { tag: '{points}', label: '{points}' },
                      { tag: '{walletBalance}', label: '{wallet}' },
                      { tag: '{visits}', label: '{visits}' },
                      { tag: '{spend}', label: '{spend}' },
                      { tag: '{tier}', label: '{tier}' },
                      { tag: '{rate}', label: '{rate}' },
                      { tag: '{restaurantName}', label: '{restaurant}' },
                      { tag: '{read_more}', label: '{read_more}' }
                    ].map(btn => (
                      <button
                        type="button"
                        key={btn.tag}
                        onClick={() => setCampaignTemplate(prev => `${prev} ${btn.tag}`)}
                        className="px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer"
                      >
                        +{btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preset Template Chips */}
                <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-text-muted shrink-0">{t("Quick Presets:")}</span>
                  <button
                    type="button"
                    onClick={() => setCampaignTemplate(
`👑 *Exclusive Reward for {customerName}!*
🍽️ *{restaurantName}* | *VIP Privilege*
{read_more}
━━━━━━━━━━━━━━━━━━━━
You have *{points} Loyalty Points* (worth ₹{walletBalance}) ready to redeem! 🎁

Visit us this week to enjoy delicious food and redeem your points on any order! ✨`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    🎁 {t("Reward Offer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignTemplate(
`⏰ *Points Expiry Alert for {customerName}!*
🍽️ *{restaurantName}* | *Loyalty Balance*
{read_more}
━━━━━━━━━━━━━━━━━━━━
Your *{points} Loyalty Points* (₹{walletBalance} Wallet Balance) are active! 🎁

Don't miss out on savings! Drop by and redeem your points on your next visit. 😊`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    ⏳ {t("Expiry Alert")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignTemplate(
`🌟 *VIP Privilege for {customerName}!*
🍽️ *{restaurantName}* | *VIP Elite Status*
{read_more}
━━━━━━━━━━━━━━━━━━━━
Thank you for being one of our most valued guests! 🍷

Your current reward balance is *{points} Points* (₹{walletBalance}). Enjoy a complimentary treat when you dine with us this week! 🍰`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    👑 {t("VIP Special")}
                  </button>
                </div>

                <textarea
                  rows={6}
                  value={campaignTemplate}
                  onChange={(e) => setCampaignTemplate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-xs sm:text-sm text-text-main font-sans focus:border-primary focus:outline-none leading-relaxed"
                  placeholder="Enter personalized campaign message..."
                />
              </div>

              {/* Flyer Attachment Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">
                  {t("3. Campaign Flyer / Image Attachment")}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCampaignImageMode('default')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      campaignImageMode === 'default'
                        ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-surface-hover text-text-main'
                    }`}
                  >
                    <span className="text-xs">{t("Default Flyer")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignImageMode('custom')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      campaignImageMode === 'custom'
                        ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-surface-hover text-text-main'
                    }`}
                  >
                    <span className="text-xs">{t("Upload Specific")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignImageMode('none')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      campaignImageMode === 'none'
                        ? 'border-primary bg-primary/10 font-bold text-primary ring-1 ring-primary'
                        : 'border-border bg-background hover:bg-surface-hover text-text-main'
                    }`}
                  >
                    <span className="text-xs">{t("Text Only")}</span>
                  </button>
                </div>

                {campaignImageMode === 'custom' && (
                  <div className="bg-background p-2.5 rounded-xl border border-border space-y-2 mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCustomCampaignImageUpload}
                      className="text-xs text-text-main file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                    />
                    {customCampaignImage && (
                      <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-border">
                        <img src={customCampaignImage} alt="Custom campaign flyer" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setCustomCampaignImage('')}
                          className="absolute top-1 right-1 bg-red-600 text-white p-0.5 rounded-md"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Live WhatsApp Smartphone Simulator */}
            <div className="lg:col-span-5 bg-background rounded-2xl border border-border p-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                    <Eye size={12} className="text-emerald-500" />
                    {t("Live Smartphone WhatsApp Preview")}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    {t("Recipient: Anand Kumar")}
                  </span>
                </div>

                {/* WhatsApp Chat Bubble Mockup */}
                <div className="bg-[#E5DDD5] dark:bg-[#111B21] rounded-2xl p-3 shadow-inner space-y-2 max-w-sm mx-auto border border-border/40 font-sans">
                  <div className="bg-white dark:bg-[#202C33] rounded-2xl p-2.5 shadow-sm space-y-2 text-xs text-text-main max-w-[280px] ml-auto rounded-tr-none">
                    {/* Attached Image Preview in Chat Bubble */}
                    {((campaignImageMode === 'default' && loyaltyImageUrl) ||
                      (campaignImageMode === 'custom' && customCampaignImage)) && (
                      <img
                        src={campaignImageMode === 'default' ? loyaltyImageUrl : customCampaignImage}
                        alt="Campaign Flyer"
                        className="w-full h-32 object-cover rounded-xl"
                      />
                    )}

                    {/* Formatted Text Preview with Mock Variables */}
                    <div className="whitespace-pre-line text-zinc-900 dark:text-zinc-100 text-xs leading-relaxed">
                      {(() => {
                        const activeRestName = waStatus.restaurantName || (() => {
                          try { return JSON.parse(localStorage.getItem('restaurantSettings') || '{}').restaurantName; } catch (e) { return ''; }
                        })() || 'Restaurant';

                        const replaceMockTags = (text) => text
                          .replace(/\{customerName\}/gi, 'Anand Kumar')
                          .replace(/\{name\}/gi, 'Anand Kumar')
                          .replace(/\{points\}/gi, '130')
                          .replace(/\{walletBalance\}/gi, '130')
                          .replace(/\{wallet\}/gi, '130')
                          .replace(/\{visits\}|\{totalVisits\}/gi, '57')
                          .replace(/\{spend\}|\{totalSpend\}/gi, '1,17,010')
                          .replace(/\{tier\}|\{membershipTier\}/gi, 'Elite VIP Member')
                          .replace(/\{rate\}|\{redemptionRate\}/gi, '1.00')
                          .replace(/\{restaurantName\.toUpperCase\(\)\}/gi, activeRestName.toUpperCase())
                          .replace(/\{restaurantName\}/gi, activeRestName)
                          .replace(/\{restaurant\}/gi, activeRestName);

                        if (campaignTemplate.includes('{read_more}')) {
                          return (
                            <>
                              <span>{replaceMockTags(campaignTemplate.split('{read_more}')[0]).trim()}</span>
                              <span className="text-emerald-600 font-bold block mt-1 hover:underline cursor-pointer">... Read more</span>
                            </>
                          );
                        }
                        return replaceMockTags(campaignTemplate);
                      })()}
                    </div>

                    <div className="flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                      <span>Just now</span>
                      <span className="text-blue-500">✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Launch Bar */}
              <div className="mt-3 pt-3 border-t border-border space-y-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  disabled={campaignSending || audienceData.totalMatched === 0}
                  className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white font-black text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={15} />
                  <span>
                    {campaignSending
                      ? t("Broadcasting Campaign...")
                      : `${t("Launch WhatsApp Broadcast to")} ${audienceData.totalMatched} ${t("Customers")}`}
                  </span>
                </button>
                <p className="text-[10px] text-center text-text-muted">
                  {t("Zero SMS charges. Automated 1.5s delay to keep your WhatsApp account safe.")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal Before Launching Broadcast */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border p-5 max-w-md w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-500">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Megaphone size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-main">{t("Confirm Campaign Broadcast")}</h3>
                  <p className="text-xs text-text-muted">{t("Ready to dispatch personalized WhatsApp messages")}</p>
                </div>
              </div>

              <div className="bg-background p-3 rounded-xl border border-border space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("Target Segment:")}</span>
                  <span className="font-bold text-text-main capitalize">{campaignFilter.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("Total Recipients:")}</span>
                  <span className="font-bold text-primary">{audienceData.totalMatched} {t("Customers")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">{t("Flyer Attached:")}</span>
                  <span className="font-bold text-emerald-600">
                    {campaignImageMode === 'none' ? t("None (Text Only)") : t("Yes (Promotional Image Included)")}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleLaunchCampaign}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  {t("Yes, Launch Broadcast")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Real-Time Progress / Result Modal */}
        {campaignProgress && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border p-5 max-w-sm w-full shadow-2xl space-y-4 text-center">
              {campaignProgress.status === 'sending' ? (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Loader2 size={24} className="animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">{t("Sending WhatsApp Campaign...")}</h3>
                    <p className="text-xs text-text-muted mt-1">
                      {t("Pacing messages safely to avoid rate limits")}
                    </p>
                  </div>
                  <div className="w-full bg-background rounded-full h-2.5 border border-border overflow-hidden">
                    <div className="bg-primary h-2.5 rounded-full animate-pulse w-full" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={26} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">{t("Campaign Successfully Completed!")}</h3>
                    <p className="text-xs text-text-muted mt-1">
                      {t("Personalized messages delivered directly to customer WhatsApp")}
                    </p>
                  </div>
                  <div className="bg-background p-3 rounded-xl border border-border grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-text-muted text-[10px]">{t("Delivered")}</div>
                      <div className="text-emerald-600 font-bold text-sm">{campaignProgress.sent}</div>
                    </div>
                    <div>
                      <div className="text-text-muted text-[10px]">{t("Failed")}</div>
                      <div className="text-red-500 font-bold text-sm">{campaignProgress.failCount}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCampaignProgress(null)}
                    className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                  >
                    {t("Done")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoyaltyProgram;