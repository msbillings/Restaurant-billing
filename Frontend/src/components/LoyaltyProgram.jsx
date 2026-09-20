import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useRef } from 'react';
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
  Check,
  Clock,
  ShieldAlert,
  Crown,
  Zap,
  Calendar,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { getMenuItems } from '../api/menu';

const LoyaltyProgram = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const textareaRef = useRef(null);
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

  // Reelo-grade Expiry & VIP Club State
  const [autoExpiryEnabled, setAutoExpiryEnabled] = useState(true);
  const [expiryWarningDays, setExpiryWarningDays] = useState('7');
  const [expiryWarningNotify, setExpiryWarningNotify] = useState(true);
  const [tiers, setTiers] = useState([
    { name: 'Silver', minVisits: 0, minSpend: 0, pointMultiplier: 1.0, perks: 'Standard 1x Points Earning', color: '#94a3b8' },
    { name: 'Gold', minVisits: 5, minSpend: 5000, pointMultiplier: 1.25, perks: '1.25x Points + Priority Booking', color: '#f59e0b' },
    { name: 'Platinum VIP', minVisits: 15, minSpend: 15000, pointMultiplier: 1.5, perks: '1.5x Points + Complimentary Dessert + Chef Greeting', color: '#10b981' }
  ]);
  const [milestoneRewards, setMilestoneRewards] = useState([
    { visitNumber: 5, rewardPoints: 50, rewardDescription: '5th Visit Club Bonus' },
    { visitNumber: 10, rewardPoints: 100, rewardDescription: '10th Milestone Celebration Treat' }
  ]);

  // Expiry Dashboard Stats & Audit State
  const [expiryStats, setExpiryStats] = useState({
    totalWithBalance: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    healthyCount: 0,
    tierStats: { Silver: 0, Gold: 0, 'Platinum VIP': 0 }
  });
  const [expiringSoonList, setExpiringSoonList] = useState([]);
  const [expiredList, setExpiredList] = useState([]);
  const [expiryStatsLoading, setExpiryStatsLoading] = useState(false);
  const [runningAudit, setRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [viewExpiryType, setViewExpiryType] = useState(null); // 'expiring' | 'expired' | null

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

          setAutoExpiryEnabled(config.autoExpiryEnabled !== false);
          setExpiryWarningDays(String(config.expiryWarningDays ?? '7'));
          setExpiryWarningNotify(config.expiryWarningNotify !== false);
          if (Array.isArray(config.tiers) && config.tiers.length > 0) {
            setTiers(config.tiers);
          }
          if (Array.isArray(config.milestoneRewards) && config.milestoneRewards.length > 0) {
            setMilestoneRewards(config.milestoneRewards);
          }
        }

        // Fetch stats
        const statsRes = await axios.get(`${getApiUrl()}/loyalty/stats`, { headers });
        if (statsRes.data) {
          setStats(statsRes.data);
        }

        // Fetch Expiry Dashboard breakdown
        try {
          const expRes = await axios.get(`${getApiUrl()}/loyalty/expiry/stats`, { headers });
          if (expRes.data && expRes.data.success) {
            setExpiryStats(expRes.data.stats || {});
            if (expRes.data.expiringSoonList) setExpiringSoonList(expRes.data.expiringSoonList);
            if (expRes.data.expiredList) setExpiredList(expRes.data.expiredList);
          }
        } catch (expErr) {
          console.warn('Could not fetch loyalty expiry stats:', expErr);
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

  const fetchExpiryStats = async () => {
    try {
      setExpiryStatsLoading(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.get(`${getApiUrl()}/loyalty/expiry/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.success) {
        setExpiryStats(res.data.stats || {});
        if (res.data.expiringSoonList) setExpiringSoonList(res.data.expiringSoonList);
        if (res.data.expiredList) setExpiredList(res.data.expiredList);
      }
    } catch (err) {
      console.warn('Error refreshing expiry stats:', err);
    } finally {
      setExpiryStatsLoading(false);
    }
  };

  const handleRunExpiryAudit = async () => {
    try {
      setRunningAudit(true);
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const res = await axios.post(`${getApiUrl()}/loyalty/expiry/audit`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data && res.data.success) {
        setAuditResult(res.data);
        setShowAuditModal(true);
        fetchExpiryStats();
      }
    } catch (err) {
      console.error('Error running expiry audit:', err);
      alert(err.response?.data?.message || err.message || 'Failed to execute expiry audit.');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleInsertTag = (tag) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setCampaignTemplate(prev => `${prev} ${tag}`);
      return;
    }

    const start = textarea.selectionStart ?? campaignTemplate.length;
    const end = textarea.selectionEnd ?? campaignTemplate.length;
    const text = campaignTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const spacerBefore = (before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n')) ? ' ' : '';
    const spacerAfter = (after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n')) ? ' ' : '';

    const insertion = `${spacerBefore}${tag}${spacerAfter}`;
    const newText = `${before}${insertion}${after}`;
    setCampaignTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + insertion.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 10);
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
        autoExpiryEnabled,
        expiryWarningDays: Math.max(1, Number(expiryWarningDays) || 7),
        expiryWarningNotify,
        welcomeBonus: Math.max(0, Number(welcomeBonus) || 0),
        itemBonusRules,
        whatsappNotify,
        loyaltyImageUrl,
        attachImageToReceipt,
        tiers,
        milestoneRewards
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      fetchExpiryStats();
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

        {/* Section 4: Redemption & Automated Inactivity Expiry Engine */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center shrink-0">
                <Wallet size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2 flex-wrap">
                  <span>{t("Redemption Rules & Automated Expiry Engine")}</span>
                  <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {t("Reelo Parity")}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">
                  {t("Configure conversion rates, wallet caps, and automated point expiry with advance WhatsApp alerts")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRunExpiryAudit}
                disabled={runningAudit}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {runningAudit ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>{t("Auditing Accounts...")}</span>
                  </>
                ) : (
                  <>
                    <Zap size={13} />
                    <span>{t("⚡ Run Expiry Audit Now")}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Standard Redemption Rates */}
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
                {t("Direct wallet cash credit on bill payment")}
              </p>
            </div>

            <div className="bg-background p-3.5 rounded-xl border border-border">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider block mb-1.5">
                {t("Max Bill Redemption %")}
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
                {t("Limits wallet discount per order (e.g. 50% max)")}
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
                {t("Credited instantly on customer's first bill")}
              </p>
            </div>
          </div>

          {/* Automated Inactivity Expiry & Warning Engine Settings */}
          <div className="bg-background/70 p-3.5 rounded-xl border border-border space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-orange-500" />
                <div>
                  <h3 className="font-bold text-xs sm:text-sm text-text-main">{t("Automated Points Expiry & Pre-Expiry Warnings")}</h3>
                  <p className="text-[11px] text-text-muted">{t("Keep liability under control by resetting dormant points and nudging customers back")}</p>
                </div>
              </div>
              <label className="flex items-center cursor-pointer gap-2 bg-surface px-3 py-1.5 rounded-xl border border-border shadow-2xs">
                <span className="text-xs font-bold text-text-main">{autoExpiryEnabled ? t("Auto-Expiry Active") : t("Never Expire")}</span>
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoExpiryEnabled ? 'bg-orange-500' : 'bg-surface-hover border border-border'}`}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={autoExpiryEnabled}
                    onChange={(e) => setAutoExpiryEnabled(e.target.checked)}
                  />
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${autoExpiryEnabled ? 'translate-x-4' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-surface p-3 rounded-xl border border-border flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-text-main block">{t("Inactivity Validity Period")}</span>
                  <p className="text-[11px] text-text-muted">{t("Points reset if no order placed for this many days")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="30"
                    value={walletExpiry}
                    onChange={(e) => setWalletExpiry(e.target.value)}
                    className="w-20 px-2.5 py-1 bg-background border border-border rounded-lg font-bold text-center text-xs sm:text-sm text-text-main focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-muted font-semibold">{t("days")}</span>
                </div>
              </div>

              <div className="bg-surface p-3 rounded-xl border border-border flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-text-main">{t("Advance WhatsApp Alert Notice")}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={expiryWarningNotify}
                        onChange={(e) => setExpiryWarningNotify(e.target.checked)}
                      />
                      <div className={`w-7 h-4 rounded-full transition-colors ${expiryWarningNotify ? 'bg-emerald-500' : 'bg-border'}`}>
                        <div className={`w-3 h-3 rounded-full bg-white transition-transform ${expiryWarningNotify ? 'translate-x-3.5' : 'translate-x-0.5'} mt-0.5`} />
                      </div>
                    </label>
                  </div>
                  <p className="text-[11px] text-text-muted">{t("Sends urgent 'Points Expiring Soon' alert via WhatsApp")}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={expiryWarningDays}
                    onChange={(e) => setExpiryWarningDays(e.target.value)}
                    className="w-16 px-2 py-1 bg-background border border-border rounded-lg font-bold text-center text-xs sm:text-sm text-text-main focus:border-primary focus:outline-none"
                  />
                  <span className="text-xs text-text-muted font-semibold">{t("days before")}</span>
                </div>
              </div>
            </div>

            {/* Live Expiry Status Bar */}
            <div className="bg-surface p-3 rounded-xl border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <ShieldAlert size={14} className="text-primary" />
                  {t("Real-Time Points Expiry Dashboard")}
                </span>
                <button
                  type="button"
                  onClick={fetchExpiryStats}
                  className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} className={expiryStatsLoading ? "animate-spin" : ""} />
                  <span>{t("Refresh")}</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => expiringSoonList.length > 0 && setViewExpiryType('expiring')}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    expiringSoonList.length > 0 ? 'bg-amber-500/10 border-amber-500/30 cursor-pointer hover:border-amber-500' : 'bg-background border-border'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">{t("Expiring Soon (7d)")}</div>
                  <div className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                    {expiryStats.expiringSoonCount || 0}
                  </div>
                  {expiringSoonList.length > 0 && <span className="text-[9px] text-amber-600 underline font-semibold block">{t("View Details")}</span>}
                </div>

                <div
                  onClick={() => expiredList.length > 0 && setViewExpiryType('expired')}
                  className={`p-2.5 rounded-lg border text-center transition-all ${
                    expiredList.length > 0 ? 'bg-rose-500/10 border-rose-500/30 cursor-pointer hover:border-rose-500' : 'bg-background border-border'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">{t("Overdue / Expired")}</div>
                  <div className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                    {expiryStats.expiredCount || 0}
                  </div>
                  {expiredList.length > 0 && <span className="text-[9px] text-rose-600 underline font-semibold block">{t("View Details")}</span>}
                </div>

                <div className="p-2.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-center">
                  <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">{t("Healthy & Active")}</div>
                  <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {expiryStats.healthyCount || 0}
                  </div>
                  <span className="text-[9px] text-emerald-600 font-semibold block">{t("Normal validity")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4.5: Reelo-Grade 3-Tier VIP Club Management */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center shrink-0">
                <Crown size={20} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2 flex-wrap">
                  <span>{t("Multi-Tier VIP Loyalty Club")}</span>
                  <span className="bg-amber-500/10 text-amber-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {t("Reelo Alternative")}
                  </span>
                </h2>
                <p className="text-xs text-text-muted">
                  {t("Automate VIP progression with Silver, Gold, and Platinum status to incentivize repeat visits and higher spend")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-text-muted bg-background px-3 py-1.5 rounded-xl border border-border">
              <span>{t("Active Members:")}</span>
              <span className="text-slate-400">🥈 {expiryStats.tierStats?.Silver || 0}</span>
              <span className="text-amber-500">🥇 {expiryStats.tierStats?.Gold || 0}</span>
              <span className="text-emerald-500">👑 {expiryStats.tierStats?.['Platinum VIP'] || 0}</span>
            </div>
          </div>

          {/* 3 Tier Config Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {tiers.map((tier, idx) => {
              const tierIcons = [
                <Award key="silver" size={20} className="text-slate-400" />,
                <Crown key="gold" size={20} className="text-amber-500" />,
                <Sparkles key="platinum" size={20} className="text-emerald-500" />
              ];
              const borderStyles = [
                'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20',
                'border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20',
                'border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-950/20'
              ];

              return (
                <div key={idx} className={`p-4 rounded-2xl border-2 space-y-3 ${borderStyles[idx] || 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-surface border border-border shadow-2xs">
                        {tierIcons[idx] || <Award size={18} />}
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-text-main">{tier.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                          {idx === 0 ? t("Entry Level") : idx === 1 ? t("Regular Diners") : t("Elite VIP")}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-xl bg-surface border border-border shadow-2xs text-primary">
                      {tier.pointMultiplier}x {t("Multiplier")}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-border">
                      <span className="text-text-muted font-bold">{t("Min Visits:")}</span>
                      <input
                        type="number"
                        min="0"
                        value={tier.minVisits}
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[idx] = { ...updated[idx], minVisits: Number(e.target.value) || 0 };
                          setTiers(updated);
                        }}
                        className="w-16 px-2 py-0.5 bg-background border border-border rounded-lg font-bold text-center text-text-main"
                      />
                    </div>

                    <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-border">
                      <span className="text-text-muted font-bold">{t("Min Spend:")}</span>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-text-muted">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={tier.minSpend}
                          onChange={(e) => {
                            const updated = [...tiers];
                            updated[idx] = { ...updated[idx], minSpend: Number(e.target.value) || 0 };
                            setTiers(updated);
                          }}
                          className="w-20 px-2 py-0.5 bg-background border border-border rounded-lg font-bold text-center text-text-main"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-border">
                      <span className="text-text-muted font-bold">{t("Point Earning:")}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.05"
                          min="1.0"
                          max="3.0"
                          value={tier.pointMultiplier}
                          onChange={(e) => {
                            const updated = [...tiers];
                            updated[idx] = { ...updated[idx], pointMultiplier: Number(e.target.value) || 1.0 };
                            setTiers(updated);
                          }}
                          className="w-16 px-2 py-0.5 bg-background border border-border rounded-lg font-bold text-center text-text-main"
                        />
                        <span className="font-bold text-text-muted">x</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">{t("Perks & Description")}</label>
                      <input
                        type="text"
                        value={tier.perks}
                        onChange={(e) => {
                          const updated = [...tiers];
                          updated[idx] = { ...updated[idx], perks: e.target.value };
                          setTiers(updated);
                        }}
                        placeholder="e.g. Priority table reservation"
                        className="w-full px-2.5 py-1.5 bg-surface border border-border rounded-xl text-xs text-text-main"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Milestone Rewards Strip */}
          <div className="bg-background p-3 rounded-xl border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Gift size={14} className="text-amber-500" />
                {t("Visit Milestone Bonus Rewards")}
              </span>
              <span className="text-[11px] text-text-muted">{t("Surprise bonus points upon reaching visit count")}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {milestoneRewards.map((m, mIdx) => (
                <div key={mIdx} className="bg-surface p-2.5 rounded-xl border border-border flex items-center justify-between gap-2">
                  <div>
                    <span className="font-black text-xs text-text-main">{m.visitNumber}th Visit Milestone</span>
                    <p className="text-[11px] text-text-muted">{m.rewardDescription || 'Celebration Reward'}</p>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg text-xs font-black">
                    +{m.rewardPoints} pts
                  </div>
                </div>
              ))}
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
                      { tag: '{name}', label: 'Name' },
                      { tag: '{points}', label: 'Points' },
                      { tag: '{wallet}', label: 'Wallet' },
                      { tag: '{visits}', label: 'Visits' },
                      { tag: '{spend}', label: 'Spend' },
                      { tag: '{tier}', label: 'Tier' },
                      { tag: '{rate}', label: 'Rate' },
                      { tag: '{restaurant}', label: 'Restaurant' },
                      { tag: '{read_more}', label: 'Read More' }
                    ].map(btn => (
                      <button
                        type="button"
                        key={btn.tag}
                        onClick={() => handleInsertTag(btn.tag)}
                        className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-md text-[11px] font-bold transition-colors cursor-pointer"
                        title={t(`Insert ${btn.label} at cursor`)}
                      >
                        + {btn.label}
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
`👑 *Exclusive Reward for {name}!*
🍽️ *{restaurant}* | *VIP Privilege*
{read_more}
━━━━━━━━━━━━━━━━━━━━
You have *{points} Loyalty Points* (worth ₹{wallet}) ready to redeem! 🎁

Visit us this week to enjoy delicious food and redeem your points on any order! ✨`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    🎁 {t("Reward Offer")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignTemplate(
`⏰ *Points Expiry Alert for {name}!*
🍽️ *{restaurant}* | *Loyalty Balance*
{read_more}
━━━━━━━━━━━━━━━━━━━━
Your *{points} Loyalty Points* (₹{wallet} Wallet Balance) are active! 🎁

Don't miss out on savings! Drop by and redeem your points on your next visit. 😊`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    ⏳ {t("Expiry Alert")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCampaignTemplate(
`🌟 *VIP Privilege for {name}!*
🍽️ *{restaurant}* | *VIP Elite Status*
{read_more}
━━━━━━━━━━━━━━━━━━━━
Thank you for being one of our most valued guests! 🍷

Your current reward balance is *{points} Points* (₹{wallet}). Enjoy a complimentary treat when you dine with us this week! 🍰`
                    )}
                    className="px-2 py-1 bg-surface hover:bg-surface-hover border border-border rounded-lg text-[10px] font-bold text-text-main shrink-0 transition-colors cursor-pointer"
                  >
                    👑 {t("VIP Special")}
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
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
                          .replace(/\{tier\}|\{membershipTier\}/gi, 'Platinum VIP')
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

        {/* Real-Time Expiry Audit Execution Modal */}
        {showAuditModal && auditResult && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border p-5 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                    <Zap size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">{t("Expiry Audit & Alert Report")}</h3>
                    <p className="text-xs text-text-muted">{auditResult.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="p-1 rounded-lg text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 bg-background p-3 rounded-xl border border-border text-center">
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase">{t("Accounts Evaluated")}</div>
                  <div className="text-base font-black text-text-main mt-0.5">{auditResult.stats?.totalEvaluated || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-amber-600 uppercase">{t("Warnings Sent")}</div>
                  <div className="text-base font-black text-amber-600 mt-0.5">{auditResult.stats?.warningsSent || 0}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase">{t("Expired Points Reset")}</div>
                  <div className="text-base font-black text-rose-600 mt-0.5">{auditResult.stats?.expiredResetCount || 0}</div>
                </div>
              </div>

              {/* Actions Detail List */}
              {auditResult.actionsTaken && auditResult.actionsTaken.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  <div className="text-xs font-bold text-text-muted uppercase">{t("Immediate Actions Taken:")}</div>
                  {auditResult.actionsTaken.map((act, aIdx) => (
                    <div key={aIdx} className="bg-background p-2 rounded-xl border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-text-main">{act.name}</span>
                        <span className="text-text-muted text-[11px] ml-1.5">+91 {act.phone}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {act.action === 'WARNING_DISPATCHED' ? (
                          <span className="bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            ⚠️ Alert Sent ({act.daysRemaining}d left)
                          </span>
                        ) : (
                          <span className="bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            🔄 Expired Reset ({act.pointsCleared} pts)
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {t("Close Report")}
              </button>
            </div>
          </div>
        )}

        {/* Expiring / Expired Customers List Modal */}
        {viewExpiryType && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border p-5 max-w-lg w-full shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    viewExpiryType === 'expiring' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {viewExpiryType === 'expiring' ? <Clock size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">
                      {viewExpiryType === 'expiring' ? t("Points Expiring Soon (Next 7 Days)") : t("Inactive / Expired Accounts")}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {viewExpiryType === 'expiring'
                        ? t("Customers nearing expiration who need a gentle reminder")
                        : t("Accounts that have exceeded the inactivity validity window")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewExpiryType(null)}
                  className="p-1 rounded-lg text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {(viewExpiryType === 'expiring' ? expiringSoonList : expiredList).map((c, cIdx) => (
                  <div key={c.id || cIdx} className="bg-background p-2.5 rounded-xl border border-border flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-text-main flex items-center gap-1.5">
                        <span>{c.name}</span>
                        <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-surface border border-border text-primary">
                          {c.tier}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        +{c.phone} • Balance: <strong className="text-emerald-600">₹{c.walletBalance}</strong> ({c.points} pts)
                      </div>
                    </div>
                    <div className="text-right">
                      {viewExpiryType === 'expiring' ? (
                        <div className="text-amber-600 font-bold text-xs">
                          {c.daysRemaining} {t("days left")}
                        </div>
                      ) : (
                        <div className="text-rose-600 font-bold text-xs">
                          {c.daysOverdue} {t("days overdue")}
                        </div>
                      )}
                      <span className="text-[10px] text-text-muted">
                        {c.warningSent ? t("Alert Sent ✓") : t("Pending Alert")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setViewExpiryType(null)}
                  className="flex-1 py-2 rounded-xl border border-border text-xs font-bold text-text-muted hover:bg-surface-hover cursor-pointer"
                >
                  {t("Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewExpiryType(null);
                    handleRunExpiryAudit();
                  }}
                  className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  {t("⚡ Execute Audit Now")}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default LoyaltyProgram;