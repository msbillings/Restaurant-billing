import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, RefreshCw, CheckCircle, Clock, Database, Cloud, AlertCircle, Server } from 'lucide-react';
import { formatTime12 } from '../utils/timeFormat';

const ManualSync = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.get(`${getApiUrl()}/sync/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSyncStatus(response.data);
    } catch (error) {
      console.error('Error fetching sync status', error);
      // Fallback state if backend is completely down
      setSyncStatus({
        lastSyncedAt: new Date(Date.now() - 86400000), // 1 day ago
        pendingChanges: 0,
        isOnline: false,
        cloudDbStatus: 'disconnected'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!syncStatus?.isOnline) {
      alert('Cannot sync while offline. Please check your internet connection.');
      return;
    }

    setIsSyncing(true);
    setSyncResult(null);

    try {
      const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
      const response = await axios.post(`${getApiUrl()}/sync/trigger`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSyncResult({
        success: true,
        message: `Successfully synced ${response.data.recordsSynced} records to the cloud.`,
        timestamp: response.data.lastSyncedAt
      });

      // Update status
      setSyncStatus({
        ...syncStatus,
        lastSyncedAt: response.data.lastSyncedAt,
        pendingChanges: 0
      });

    } catch (error) {
      console.error('Error triggering sync', error);
      setSyncResult({
        success: false,
        message: 'Sync failed. Please try again later or check your network.',
        timestamp: new Date()
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      {/* Responsive Compact Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2.5 sm:mb-3 gap-3 bg-surface p-2.5 sm:p-3 rounded-2xl border border-border shrink-0 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-black text-text-main tracking-tight flex items-center gap-2 truncate">
              <Cloud className="text-primary shrink-0" size={22} />
              <span>{t("Cloud Data Sync")}</span>
            </h1>
            <p className="text-xs text-text-muted truncate">
              {t("Push your offline/local data to the cloud database")}
            </p>
          </div>
        </div>

        {/* Quick Refresh Status Button */}
        <button
          onClick={fetchSyncStatus}
          className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors shrink-0 flex items-center gap-1.5 text-xs font-bold self-start sm:self-auto cursor-pointer"
          title={t("Refresh Status")}
        >
          <RefreshCw size={14} />
          <span>{t("Refresh Status")}</span>
        </button>
      </div>

      <div className="w-full space-y-3 sm:space-y-4 flex-1">
        {/* System Status Card */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border overflow-hidden">
          <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-border bg-surface-hover flex items-center justify-between">
            <h2 className="text-xs sm:text-sm font-bold text-text-main flex items-center gap-2">
              <Database className="text-primary shrink-0" size={16} />
              <span>{t("System Status")}</span>
            </h2>
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full ${syncStatus?.isOnline ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              <span className={`w-2 h-2 rounded-full ${syncStatus?.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              {syncStatus?.isOnline ? t('Cloud Connected') : t('Offline Mode')}
            </span>
          </div>
          
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              
              {/* Network Status */}
              <div className="flex items-center sm:flex-col justify-between sm:justify-center p-3.5 sm:p-5 bg-background rounded-xl border border-border text-left sm:text-center gap-3">
                <div className={`p-3 rounded-2xl shrink-0 ${syncStatus?.isOnline ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                  {syncStatus?.isOnline ? <Cloud size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">{t("Internet Connection")}</h3>
                  <p className={`font-black text-sm sm:text-lg ${syncStatus?.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                    {syncStatus?.isOnline ? t('Connected') : t('Offline')}
                  </p>
                </div>
              </div>

              {/* Pending Changes */}
              <div className="flex items-center sm:flex-col justify-between sm:justify-center p-3.5 sm:p-5 bg-background rounded-xl border border-border text-left sm:text-center gap-3">
                <div className="p-3 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 shrink-0">
                  <Server size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">{t("Pending Sync")}</h3>
                  <p className="font-black text-sm sm:text-lg text-text-main">
                    {syncStatus?.pendingChanges || 0} <span className="text-xs sm:text-sm font-normal text-text-muted">{t("Records")}</span>
                  </p>
                </div>
              </div>

              {/* Last Sync */}
              <div className="flex items-center sm:flex-col justify-between sm:justify-center p-3.5 sm:p-5 bg-background rounded-xl border border-border text-left sm:text-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 shrink-0">
                  <Clock size={24} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5">{t("Last Synced")}</h3>
                  <p className="font-black text-sm sm:text-lg text-text-main font-mono">
                    {syncStatus?.lastSyncedAt ? formatTime12(syncStatus.lastSyncedAt) : t('Never')}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Sync Actions Card */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border overflow-hidden text-center p-5 sm:p-8">
          <div className="max-w-xl mx-auto">
            <h2 className="text-base sm:text-xl font-bold text-text-main mb-1.5">{t("Ready to Sync?")}</h2>
            <p className="text-xs sm:text-sm text-text-muted mb-5 sm:mb-6 leading-relaxed">
              {t("Pushing local transactions, bills, and KOTs to the cloud database ensures your dashboard is up to date and your data is securely backed up.")}
            </p>

            <button
              onClick={handleSync}
              disabled={isSyncing || !syncStatus?.isOnline || syncStatus?.pendingChanges === 0}
              className={`
                inline-flex items-center justify-center gap-2 text-white px-6 sm:px-8 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-base transition-all shadow-md cursor-pointer
                ${isSyncing ?
                  'bg-primary/80 cursor-not-allowed' :
                  !syncStatus?.isOnline || syncStatus?.pendingChanges === 0 ?
                  'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed shadow-none' :
                  'bg-primary hover:bg-primary-hover hover:-translate-y-0.5 hover:shadow-primary/30'}
              `}>
              
              {isSyncing ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  <span>{t("Syncing to Cloud...")}</span>
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  <span>{t("Push to Cloud Now")}</span>
                </>
              )}
            </button>

            {syncResult && (
              <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl flex items-center gap-2.5 text-left text-xs sm:text-sm ${syncResult.success ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
                {syncResult.success ? <CheckCircle className="text-green-500 shrink-0" size={20} /> : <AlertCircle className="text-red-500 shrink-0" size={20} />}
                <div>
                  <p className="font-bold">{syncResult.success ? t('Sync Successful') : t('Sync Failed')}</p>
                  <p className="text-text-muted mt-0.5">{syncResult.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informational Benefits Grid across full width */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
          <div className="bg-surface p-3.5 rounded-xl border border-border shadow-2xs">
            <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
              <CheckCircle size={14} className="text-green-500" />
              {t("Offline-First Billing")}
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {t("Continue creating bills, KOTs, and orders without interruptions even when internet is unavailable.")}
            </p>
          </div>

          <div className="bg-surface p-3.5 rounded-xl border border-border shadow-2xs">
            <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
              <CheckCircle size={14} className="text-blue-500" />
              {t("Cloud Backup & Security")}
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {t("Encrypted sync transfers all local database changes directly to your secure cloud database.")}
            </p>
          </div>

          <div className="bg-surface p-3.5 rounded-xl border border-border shadow-2xs">
            <h3 className="text-xs font-bold text-text-main flex items-center gap-1.5 mb-1">
              <CheckCircle size={14} className="text-purple-500" />
              {t("Live Multi-Terminal Sync")}
            </h3>
            <p className="text-[11px] text-text-muted leading-relaxed">
              {t("Synced records are instantly available across all connected owner, manager, and captain terminals.")}
            </p>
          </div>
        </div>
      </div>
    </div>);

};

export default ManualSync;