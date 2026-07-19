import React from 'react';
import { X, Phone, Mail, Globe, MessageSquare, HeadphonesIcon } from 'lucide-react';

const ContactSupportModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative"
      >
        {/* Header Background */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-8 text-white relative overflow-hidden">
          {/* Decorative shapes */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-black/10 blur-2xl"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full transition-all"
          >
            <X size={24} />
          </button>
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-md border border-white/30 shadow-lg">
              <HeadphonesIcon size={40} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight drop-shadow-md">Support Center</h2>
              <p className="text-orange-50 font-medium mt-1 drop-shadow-sm">We're here to help you 24/7</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <p className="text-slate-600 dark:text-slate-400 mb-8 font-medium">
            Having trouble with your MS Billing Terminal? Reach out to our dedicated support team using any of the channels below. We ensure a response time of under 30 minutes.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Phone Card 1 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:shadow-lg hover:border-orange-500/30 transition-all group">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 text-orange-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Phone size={24} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">Primary Helpline</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">Available 24/7 for critical issues</p>
              <a href="tel:+919701800140" className="text-lg font-black text-orange-500 hover:text-orange-600 transition-colors">
                +91 9701800140
              </a>
            </div>

            {/* Phone Card 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:shadow-lg hover:border-orange-500/30 transition-all group">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/20 text-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <MessageSquare size={24} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">Secondary / WhatsApp</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">For general queries and updates</p>
              <a href="tel:+919032223352" className="text-lg font-black text-blue-500 hover:text-blue-600 transition-colors">
                +91 9032223352
              </a>
            </div>

            {/* Email Card */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700/50 hover:shadow-lg hover:border-orange-500/30 transition-all group md:col-span-2">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-500/20 text-green-500 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <Mail size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1">Email Support</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Send us detailed logs or feature requests</p>
                  <a href="mailto:support@msbillings.com" className="text-lg font-black text-green-500 hover:text-green-600 transition-colors">
                    support@msbillings.com
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-sm font-medium text-slate-400 flex items-center justify-center gap-2">
              <Globe size={16} /> MS Tech Hive - Transforming Restaurant Management
            </p>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
};

export default ContactSupportModal;
