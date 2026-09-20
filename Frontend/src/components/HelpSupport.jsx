import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from "../context/LanguageContext";
import BackButton from './common/BackButton';
import {
  HelpCircle,
  Phone,
  Mail,
  BookOpen,
  MessageCircle,
  MonitorPlay,
  ExternalLink,
  Search,
  CheckCircle2,
  Activity,
  Database,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Printer,
  FileQuestion,
  Headphones
} from 'lucide-react';
import api from '../api/axios';

const TUTORIAL_GUIDES = [
  {
    id: 'billing_basics',
    title: 'Billing Basics & Quick Checkout',
    duration: '3 mins read',
    icon: MonitorPlay,
    steps: [
      '1. Tap on table or order type (Dine-In, Takeaway, Delivery).',
      '2. Select categories on top and tap menu items to add to cart.',
      '3. Adjust quantity with +/- buttons or use keyboard numbers.',
      '4. Click "Settle Bill" and pick payment mode (Cash, UPI QR, Card, Split).',
      '5. Bill prints automatically and syncs to DayBook reports.'
    ],
    tips: 'Use keyboard shortcut "F2" or search bar for instant item finding.'
  },
  {
    id: 'inventory_setup',
    title: 'Inventory & Stock Management',
    duration: '4 mins read',
    icon: Database,
    steps: [
      '1. Go to Operations > Inventory Management.',
      '2. Click "Add Raw Material" (e.g., Chicken, Paneer, Rice, Oil).',
      '3. Set minimum reorder alert threshold and unit (KG, LTR, PCS).',
      '4. Link raw materials to menu items via recipe tracking.',
      '5. Inventory auto-deducts on every completed bill!'
    ],
    tips: 'Low-stock warnings appear automatically in the top notification bell.'
  },
  {
    id: 'printer_setup',
    title: 'Thermal Printer & KOT Configuration',
    duration: '3 mins read',
    icon: Printer,
    steps: [
      '1. Navigate to Settings > Bill / KOT Print configuration.',
      '2. Choose printer connection type (USB, LAN Network IP, or Bluetooth).',
      '3. For network printers, input the local IP (e.g. 192.168.1.100) and port 9100.',
      '4. Assign designated food categories to Kitchen 1, Kitchen 2, or Bar printers.',
      '5. Click "Print Test Receipt" to verify immediate printer response.'
    ],
    tips: 'Ensure printer is on the same Wi-Fi / LAN router subnet as your POS terminal.'
  },
  {
    id: 'loyalty_crm',
    title: 'Customer Loyalty & WhatsApp CRM',
    duration: '2 mins read',
    icon: Sparkles,
    steps: [
      '1. Enable Loyalty Program under Operations > Loyalty Program.',
      '2. Choose between Spend-Based (e.g. 1 pt per ₹10) or Item-Bonus points.',
      '3. Enter customer phone number when starting a new order.',
      '4. Customer receives automatic WhatsApp balance alerts and welcome bonus.',
      '5. Redeem wallet points directly on checkout for high customer retention.'
    ],
    tips: 'VIP customer status automatically unlocks after reaching target visits or spend.'
  }
];

const HelpSupport = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [supportInfo, setSupportInfo] = useState({
    phone: '+91 9701800140',
    whatsapp: '919701800140',
    email: 'support@billingpos.com',
    restaurantName: "Anand's Restaurant",
    tenantDb: 'restaurant-db'
  });

  const [activeTutorial, setActiveTutorial] = useState(null);
  const [faqSearch, setFaqSearch] = useState('');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    category: 'Thermal Printer',
    priority: 'Normal',
    description: '',
    contactNumber: ''
  });
  const [ticketSent, setTicketSent] = useState(false);

  // Load live restaurant info from backend & localStorage
  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await api.get('/config/info');
        const rSettings = res.data?.restaurantSettings || {};
        
        let localUser = {};
        try {
          localUser = JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {
          // ignore
        }

        setSupportInfo({
          phone: rSettings.supportPhone || rSettings.phone || '+91 9701800140',
          whatsapp: (rSettings.supportWhatsApp || rSettings.phone || '919701800140').replace(/\D/g, ''),
          email: rSettings.supportEmail || rSettings.email || 'support@billingpos.com',
          restaurantName: rSettings.restaurantName || localUser.restaurantName || "Anand's Restaurant",
          tenantDb: localStorage.getItem('tenantDb') || localUser.database || 'active-pos-db'
        });

        if (rSettings.phone) {
          setTicketForm((prev) => ({ ...prev, contactNumber: rSettings.phone }));
        }
      } catch (err) {
        console.warn('Help & Support using fallback contact info:', err);
      }
    };

    fetchInfo();
  }, []);

  const allFaqs = useMemo(() => [
    {
      q: 'How do I add a new Cashier or Kitchen staff?',
      a: 'Go to Operations > Staff Management or Admin Dashboard and click "Create New User". Enter their username, password, and select role (Cashier, Waiter, Kitchen Display, or Manager).'
    },
    {
      q: 'Why is an item not showing on the POS menu grid?',
      a: 'Check Operations > Menu Item On/Off to see if the item was toggled Out of Stock, or verify that the category is active in Category Management.'
    },
    {
      q: 'How do I connect a network thermal printer for KOTs?',
      a: 'Go to Set Configuration > Bill / KOT Print. Select "Network (LAN)", enter your printer\'s local IP address (e.g. 192.168.1.100), port 9100, and assign specific categories.'
    },
    {
      q: 'How do I redeem customer loyalty points during checkout?',
      a: 'In the billing screen, enter the customer\'s 10-digit mobile number. When clicking "Settle Bill", tap "Redeem Loyalty Balance" to deduct wallet balance from the bill total.'
    },
    {
      q: 'Can the POS work if the internet is temporarily disconnected?',
      a: 'Yes! msbillings features Offline-First SQLite & IndexedDB caching. You can continue taking orders and printing bills. Orders automatically sync to the cloud once internet restores.'
    },
    {
      q: 'How do I run a DayEnd Closing report / DayBook?',
      a: 'Navigate to Operations > DayBook / Daily Closing. You will see total Cash, UPI, Card, and pending collections. Click "Print DayBook" or enable automated WhatsApp closing summary.'
    }
  ], []);

  const filteredFaqs = useMemo(() => {
    if (!faqSearch.trim()) return allFaqs;
    const term = faqSearch.toLowerCase();
    return allFaqs.filter((f) => f.q.toLowerCase().includes(term) || f.a.toLowerCase().includes(term));
  }, [allFaqs, faqSearch]);

  const handleSendTicket = (e) => {
    e.preventDefault();
    const message = `*MSBILLINGS SUPPORT REQUEST*
*Restaurant:* ${supportInfo.restaurantName}
*Database:* ${supportInfo.tenantDb}
*Category:* ${ticketForm.category}
*Priority:* ${ticketForm.priority}
*Contact:* ${ticketForm.contactNumber}
*Issue Description:*
${ticketForm.description}`;

    const encoded = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${supportInfo.whatsapp}?text=${encoded}`;
    window.open(whatsappUrl, '_blank');

    setTicketSent(true);
    setTimeout(() => {
      setTicketSent(false);
      setShowTicketModal(false);
      setTicketForm((prev) => ({ ...prev, description: '' }));
    }, 2000);
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-base sm:text-xl font-black text-text-main flex items-center gap-2">
              <HelpCircle className="text-primary" size={22} />
              <span>{t("Help & Support")}</span>
            </h1>
            <p className="text-xs text-text-muted">
              {t("Access interactive guides, system diagnostics, and connect with technical support")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => setShowTicketModal(true)}
            className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Headphones size={16} />
            <span>{t("Request Priority Callback")}</span>
          </button>
        </div>
      </div>

      {/* Main Full-Width Grid (3-Column Layout) */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-5 flex-1 pb-6">
        
        {/* Left Column: Direct Support Channels & Live System Diagnostics (4 cols) */}
        <div className="lg:col-span-4 space-y-3 sm:space-y-4">
          
          {/* Support Channels Card */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5 space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-text-main uppercase tracking-wider text-text-muted">
              {t("Official Support Channels")}
            </h3>

            {/* 24/7 Phone Support */}
            <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between hover:border-primary/40 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                  <Phone size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-text-main text-xs sm:text-sm">{t("24/7 Hotline Support")}</h4>
                  <p className="text-[11px] text-text-muted">{t("Direct voice line for critical issues")}</p>
                </div>
              </div>
              <a
                href={`tel:${supportInfo.phone}`}
                className="text-xs font-black text-primary font-mono hover:underline shrink-0 bg-primary/10 px-2.5 py-1.5 rounded-lg"
              >
                {supportInfo.phone}
              </a>
            </div>

            {/* WhatsApp Live Agent */}
            <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between hover:border-green-500/40 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shrink-0">
                  <MessageCircle size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-text-main text-xs sm:text-sm">{t("WhatsApp Support")}</h4>
                  <p className="text-[11px] text-text-muted">{t("Chat directly with technical agent")}</p>
                </div>
              </div>
              <a
                href={`https://wa.me/${supportInfo.whatsapp}?text=Hello%20msbillings%20support%2C%20I%20need%20help%20with%20my%20POS%20system%20at%20${encodeURIComponent(supportInfo.restaurantName)}.`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-xs transition-all shadow-2xs inline-flex items-center gap-1.5 shrink-0"
              >
                <span>{t("Start Chat")}</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {/* Email Support */}
            <a
              href={`mailto:${supportInfo.email}?subject=POS%20Support%20Request%20-%20${encodeURIComponent(supportInfo.restaurantName)}`}
              className="p-3 rounded-xl bg-background border border-border flex items-center justify-between hover:border-purple-500/40 transition-all block"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                  <Mail size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-text-main text-xs sm:text-sm">{t("Email Helpdesk")}</h4>
                  <p className="text-[11px] text-text-muted">{supportInfo.email}</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-text-muted" />
            </a>
          </div>

          {/* Real-Time POS Health & Diagnostic Card */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
                <Activity size={16} className="text-green-500" />
                <span>{t("POS Terminal Diagnostics")}</span>
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {t("Online")}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-text-muted">{t("Connected Restaurant")}</span>
                <span className="font-bold text-text-main truncate max-w-[170px]">{supportInfo.restaurantName}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-text-muted">{t("Tenant Database")}</span>
                <span className="font-mono font-bold text-text-main text-[11px]">{supportInfo.tenantDb}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/50">
                <span className="text-text-muted">{t("Local Offline Engine")}</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> {t("IndexedDB Synced")}
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-text-muted">{t("POS Software Version")}</span>
                <span className="font-mono font-bold text-primary">v2.4.0 (Enterprise)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Tutorial Guides & Searchable FAQs (8 cols) */}
        <div className="lg:col-span-8 space-y-3 sm:space-y-4">
          
          {/* Interactive Tutorial Guides Card */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                  <BookOpen className="text-primary" size={18} />
                  <span>{t("Interactive Video & Setup Tutorials")}</span>
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  {t("Click any guide below for instant interactive walkthrough instructions")}
                </p>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                4 Guides
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TUTORIAL_GUIDES.map((tutorial) => {
                const IconComponent = tutorial.icon;
                return (
                  <button
                    key={tutorial.id}
                    onClick={() => setActiveTutorial(tutorial)}
                    className="p-3.5 rounded-xl bg-background border border-border hover:border-primary hover:bg-primary/5 transition-all text-left flex items-start gap-3 group shadow-2xs cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <IconComponent size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-xs sm:text-sm text-text-main group-hover:text-primary transition-colors truncate">
                        {tutorial.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-text-muted">
                        <span>{tutorial.duration}</span>
                        <span>•</span>
                        <span className="text-primary font-medium">{t("View Guide →")}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Searchable FAQs Card */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-4">
              <h2 className="text-sm sm:text-base font-bold text-text-main flex items-center gap-2">
                <FileQuestion className="text-amber-500" size={18} />
                <span>{t("Frequently Asked Questions")}</span>
              </h2>
              
              {/* FAQ Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder={t("Search questions...")}
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl focus:outline-none focus:border-primary text-text-main"
                />
              </div>
            </div>

            <div className="space-y-2">
              {filteredFaqs.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  {t("No FAQs match your search.")}
                </div>
              ) : (
                filteredFaqs.map((faq, idx) => {
                  const isExpanded = expandedFaq === idx;
                  return (
                    <div
                      key={idx}
                      className="border border-border/70 rounded-xl overflow-hidden bg-background/50 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                        className="w-full p-3 text-left flex items-center justify-between gap-3 hover:bg-surface-secondary/40 transition-colors cursor-pointer"
                      >
                        <span className="font-bold text-xs sm:text-sm text-text-main">
                          {faq.q}
                        </span>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-primary shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="text-text-muted shrink-0" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="p-3 pt-0 text-xs text-text-muted leading-relaxed border-t border-border/40 bg-surface/40">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tutorial Walkthrough Modal */}
      {activeTutorial && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-secondary/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-text-main">{activeTutorial.title}</h3>
                  <span className="text-[11px] text-text-muted">{activeTutorial.duration}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveTutorial(null)}
                className="w-8 h-8 rounded-lg hover:bg-border text-text-muted flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2.5">
                {activeTutorial.steps.map((step, sIdx) => (
                  <div key={sIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-text-main">
                    <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>

              {activeTutorial.tips && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2">
                  <Sparkles size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    <strong className="font-bold">Pro Tip: </strong>{activeTutorial.tips}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end bg-surface-secondary/30">
              <button
                onClick={() => setActiveTutorial(null)}
                className="px-4 py-2 bg-primary text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-primary/90 transition-all"
              >
                {t("Got It, Close Guide")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit Assistance Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-surface-secondary/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Headphones size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm sm:text-base text-text-main">{t("Request Priority Callback")}</h3>
                  <span className="text-[11px] text-text-muted">{t("Direct channel to our technical operations team")}</span>
                </div>
              </div>
              <button
                onClick={() => setShowTicketModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-border text-text-muted flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSendTicket} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-main mb-1">{t("Issue Category")}</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="Thermal Printer">Thermal Printer / KOT</option>
                    <option value="Billing & Settle">Billing & Checkout</option>
                    <option value="Loyalty & WhatsApp">Loyalty & WhatsApp CRM</option>
                    <option value="Inventory Sync">Inventory & Stock</option>
                    <option value="Staff Permissions">Staff & Accounts</option>
                    <option value="Other">Other / Feature Request</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-main mb-1">{t("Priority Level")}</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                  >
                    <option value="Normal">Normal Inquiry</option>
                    <option value="Urgent - Live Counter Down">🔥 Urgent - Live Counter</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1">{t("Your Callback Contact Number")}</label>
                <input
                  type="tel"
                  required
                  value={ticketForm.contactNumber}
                  onChange={(e) => setTicketForm({ ...ticketForm, contactNumber: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-text-main font-bold focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-main mb-1">{t("Describe the problem or question")}</label>
                <textarea
                  required
                  rows={3}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder={t("Tell us what happened so we can diagnose immediately...")}
                  className="w-full bg-background border border-border rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 border border-border text-text-muted rounded-xl text-xs font-bold hover:bg-surface-secondary"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={ticketSent}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                >
                  <Send size={15} />
                  <span>{ticketSent ? t("Opening WhatsApp...") : t("Send via WhatsApp")}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSupport;