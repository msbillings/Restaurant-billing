import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, CheckCircle2, RefreshCw, Smartphone, LogOut, Send, AlertCircle, ShieldCheck } from 'lucide-react';
import { getWhatsAppStatus, logoutWhatsApp, sendWhatsAppMessage } from '../api/whatsapp';

const WhatsAppConnectModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const [statusData, setStatusData] = useState({ status: 'CONNECTING', connectedNumber: null, qr: null });
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await getWhatsAppStatus();
      setStatusData(res);
      if (res.connectedNumber) {
        let num = String(res.connectedNumber).replace(/[^0-9]/g, '');
        if (num.length === 12 && num.startsWith('91')) {
          num = num.slice(2);
        }
        setTestPhone(prev => (prev ? prev : num));
      }
    } catch (e) {
      console.warn('Could not fetch WhatsApp status:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutWhatsApp();
      setActionMessage({ text: t('Disconnected successfully. Generating fresh QR...'), type: 'info' });
      fetchStatus();
    } catch (e) {
      setActionMessage({ text: t('Failed to disconnect'), type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendTest = async () => {
    let clean = (testPhone || '').replace(/[^0-9]/g, '');
    if (clean.length === 12 && clean.startsWith('91')) {
      clean = clean.slice(2);
    }

    if (!clean || clean.length !== 10) {
      setActionMessage({ text: t('Please enter a valid 10-digit mobile number'), type: 'error' });
      return;
    }

    setSendingTest(true);
    setActionMessage(null);
    try {
      await sendWhatsAppMessage(clean, '🎉 *MS Billings POS Test Message*\nYour automated WhatsApp service is connected and working perfectly!');
      setActionMessage({ text: t('Test message delivered successfully! ✓'), type: 'success' });
    } catch (e) {
      console.error('Test message send error:', e);
      let errDetail = e.response?.data?.error || e.message || t('Failed to send test message');
      if (errDetail.includes('Connection Closed') || errDetail.includes('closed')) {
        errDetail = t('WhatsApp connection was temporarily closed. Auto-reconnecting in background... Please click Test Send again in 2 seconds.');
      }
      setActionMessage({ text: errDetail, type: 'error' });
    } finally {
      setSendingTest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[1100] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-lg shadow-2xl text-white animate-in zoom-in-95 duration-150 relative overflow-hidden">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-60 h-60 bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-[#25D366]">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">{t("WhatsApp Automated Bot")}</h2>
              <p className="text-xs text-gray-400">{t("Direct background e-Bills & DayBook reports")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Status Display Area */}
        <div className="space-y-4 relative z-10">
          {actionMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${actionMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : actionMessage.type === 'error' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
              {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {statusData.status === 'CONNECTED' ? (
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-emerald-500/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
                  <span>{t("Connected & Automated")}</span>
                </div>
                <span className="text-xs font-mono bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
                  +{statusData.connectedNumber || '9701800140'}
                </span>
              </div>

              {/* Linked Devices Section */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    {t("Linked Devices")} ({statusData.totalLinkedDevices || 1})
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400">
                    ● {t("Active Gateway")}
                  </span>
                </div>

                <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">Google Chrome (MS Billings POS)</h4>
                      <p className="text-[11px] text-gray-400">Windows • {t("Last active: Just now")}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    {t("Active")}
                  </span>
                </div>
              </div>

              {/* Test Message Dispatch */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <label className="text-xs font-semibold text-gray-300">{t("Send Test WhatsApp Message:")}</label>
                <div className="flex gap-2">
                  <div className="flex items-center bg-slate-900 border border-white/10 rounded-xl px-3 py-2 flex-1">
                    <span className="text-xs font-bold text-gray-400 mr-2">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      value={testPhone}
                      onChange={(e) => {
                        let val = e.target.value.replace(/[^0-9]/g, '');
                        if (val.length === 12 && val.startsWith('91')) val = val.slice(2);
                        setTestPhone(val);
                      }}
                      placeholder="10-digit mobile number"
                      className="bg-transparent text-white font-mono font-bold text-xs focus:outline-none w-full"
                    />
                  </div>
                  <button
                    onClick={handleSendTest}
                    disabled={sendingTest}
                    className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer">
                    <Send size={14} className={sendingTest ? 'animate-spin' : ''} />
                    <span>{sendingTest ? t("Sending...") : t("Test Send")}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer">
                  <LogOut size={14} />
                  <span>{t("Disconnect / Re-link")}</span>
                </button>
              </div>
            </div>
          ) : statusData.qr ? (
            <div className="bg-slate-800/80 rounded-2xl p-5 border border-amber-500/30 space-y-4 text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm">
                <Smartphone size={16} />
                <span>{t("Scan QR Code with WhatsApp")}</span>
              </div>

              <div className="bg-white p-3 rounded-2xl inline-block shadow-xl mx-auto">
                <img src={statusData.qr} alt="WhatsApp Login QR" className="w-56 h-56 object-contain" />
              </div>

              <div className="text-xs text-gray-300 space-y-1 text-left bg-slate-900/60 p-3 rounded-xl border border-white/5 font-medium">
                <p>1. {t("Open WhatsApp on your mobile phone")}</p>
                <p>2. {t("Tap Menu / Settings ➔ Linked Devices ➔ Link a Device")}</p>
                <p>3. {t("Scan this QR code. It will connect instantly!")}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/80 rounded-2xl p-8 border border-white/10 text-center space-y-3">
              <RefreshCw size={28} className="animate-spin text-[#25D366] mx-auto" />
              <p className="text-sm font-bold text-gray-200">{t("Initializing WhatsApp background service...")}</p>
              <p className="text-xs text-gray-400">{t("Generating pairing QR code...")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnectModal;
