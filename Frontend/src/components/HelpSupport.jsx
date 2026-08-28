import React from 'react';
import { useLanguage } from "../context/LanguageContext";
import BackButton from './common/BackButton';
import { ArrowLeft, HelpCircle, Phone, Mail, BookOpen, MessageCircle, MonitorPlay, ExternalLink } from 'lucide-react';

const HelpSupport = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const faqs = [
    { q: 'How do I add a new Cashier?', a: 'Go to Operations > Admin Dashboard and click "Create New User". Make sure to select the Cashier role.' },
    { q: 'Why is an item not showing on the POS?', a: 'Check Operations > Menu Item On/Off to see if the item was accidentally marked as Out of Stock.' },
    { q: 'How do I connect a thermal printer?', a: 'Go to Set Configuration > Bill / KOT Print and enter your printer\'s IP address or USB configuration.' }
  ];

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2 sm:mb-2.5 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div>
            <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight flex items-center gap-1.5">
              <HelpCircle className="text-primary shrink-0" size={20} />
              <span>{t("Help & Support")}</span>
            </h1>
            <p className="text-[11px] sm:text-xs text-text-muted">{t("Access guides, FAQs, and contact support")}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6 pb-6">
        
        {/* Support Channels */}
        <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5 sm:gap-4">
          {/* Phone Support */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-5 flex lg:flex-col items-center justify-between lg:justify-center text-left lg:text-center gap-3">
            <div className="flex items-center lg:flex-col gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text-main text-xs sm:text-sm">{t("24/7 Phone Support")}</h3>
                <p className="text-[11px] sm:text-xs text-text-muted">{t("Call us anytime for urgent POS issues.")}</p>
              </div>
            </div>
            <a
              href="tel:+919701800140"
              className="text-xs sm:text-sm font-black text-primary font-mono whitespace-nowrap hover:underline shrink-0">
              +91 9701800140
            </a>
          </div>

          {/* WhatsApp Chat */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-5 flex lg:flex-col items-center justify-between lg:justify-center text-left lg:text-center gap-3">
            <div className="flex items-center lg:flex-col gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-50 dark:bg-green-900/20 text-green-600 rounded-xl flex items-center justify-center shrink-0">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-text-main text-xs sm:text-sm">{t("WhatsApp Chat")}</h3>
                <p className="text-[11px] sm:text-xs text-text-muted">{t("Chat directly with a support agent.")}</p>
              </div>
            </div>
            <a
              href="https://wa.me/919701800140?text=Hello%20msbillings%20support%2C%20I%20need%20help%20with%20my%20POS%20system."
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 sm:py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xs inline-flex items-center gap-1.5 shrink-0">
              <span>{t("Start Chat")}</span>
              <ExternalLink size={13} />
            </a>
          </div>
          
          {/* Email Support */}
          <a
            href="mailto:support@billingpos.com"
            className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-5 flex items-center gap-3 hover:border-primary transition-all">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-50 dark:bg-purple-900/20 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Mail size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-text-main text-xs sm:text-sm">{t("Email Support")}</div>
              <div className="text-[11px] sm:text-xs text-text-muted truncate">support@billingpos.com</div>
            </div>
          </a>
        </div>

        {/* FAQs and Guides */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-6">
          {/* Video Tutorials */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-6">
            <h3 className="text-xs sm:text-base font-bold text-text-main mb-3 sm:mb-4 flex items-center gap-2">
              <BookOpen className="text-primary shrink-0" size={17} />
              <span>{t("Video Tutorials")}</span>
            </h3>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
              <div className="aspect-video bg-background rounded-xl flex flex-col items-center justify-center text-text-muted border border-border hover:border-primary hover:text-primary cursor-pointer transition-all p-2 text-center">
                <MonitorPlay size={24} className="mb-1 sm:mb-2 text-primary/70" />
                <span className="text-[11px] sm:text-xs font-bold text-text-main">{t("Billing Basics")}</span>
              </div>
              <div className="aspect-video bg-background rounded-xl flex flex-col items-center justify-center text-text-muted border border-border hover:border-primary hover:text-primary cursor-pointer transition-all p-2 text-center">
                <MonitorPlay size={24} className="mb-1 sm:mb-2 text-primary/70" />
                <span className="text-[11px] sm:text-xs font-bold text-text-main">{t("Inventory Setup")}</span>
              </div>
            </div>
          </div>

          {/* FAQs */}
          <div className="bg-surface rounded-2xl shadow-xs border border-border p-3.5 sm:p-6">
            <h3 className="text-xs sm:text-base font-bold text-text-main mb-3 sm:mb-4">{t("Frequently Asked Questions")}</h3>
            <div className="space-y-2.5 sm:space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-border pb-2.5 sm:pb-3.5 last:border-0 last:pb-0">
                  <h4 className="font-bold text-text-main text-xs sm:text-sm mb-1">{faq.q}</h4>
                  <p className="text-[11px] sm:text-xs text-text-muted leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default HelpSupport;