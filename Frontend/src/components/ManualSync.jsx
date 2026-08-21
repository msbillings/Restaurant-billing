import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, RefreshCw, CheckCircle, Clock, Database, Cloud, AlertCircle, Server } from 'lucide-react';

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
    <div className="h-full flex flex-col bg-background p-2.5 sm:p-6 overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-3 sm:mb-6 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-4">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <div>
            <h1 className="text-base sm:text-2xl font-black text-text-main tracking-tight">{t("Cloud Data Sync")}</h1>
            <p className="text-[11px] sm:text-xs text-text-muted">{t("Push your offline/local data to the cloud database")}</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full space-y-3 sm:space-y-6">
        {/* System Status Card */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border overflow-hidden">
          <div className="px-3.5 py-2.5 sm:px-6 sm:py-4 border-b border-border bg-surface-hover flex items-center justify-between">
            <h2 className="text-xs sm:text-base font-bold text-text-main flex items-center gap-2">
              <Database className="text-primary shrink-0" size={16} />
              <span>{t("System Status")}</span>
            </h2>
          </div>
          
          <div className="p-2.5 sm:p-6">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              
              {/* Network Status */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-4 bg-background rounded-xl border border-border text-center">
                <div className={`p-2 sm:p-3 rounded-full mb-1 sm:mb-2 shrink-0 ${syncStatus?.isOnline ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}>
                  {syncStatus?.isOnline ? <Cloud size={18} className="sm:hidden" /> : <AlertCircle size={18} className="sm:hidden" />}
                  {syncStatus?.isOnline ? <Cloud size={24} className="hidden sm:block" /> : <AlertCircle size={24} className="hidden sm:block" />}
                </div>
                <h3 className="text-[9px] sm:text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5 truncate w-full">{t("Internet")}</h3>
                <p className={`font-black text-xs sm:text-base truncate w-full ${syncStatus?.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {syncStatus?.isOnline ? t('Connected') : t('Offline')}
                </p>
              </div>

              {/* Pending Changes */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-4 bg-background rounded-xl border border-border text-center">
                <div className="p-2 sm:p-3 rounded-full mb-1 sm:mb-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 shrink-0">
                  <Server size={18} className="sm:hidden" />
                  <Server size={24} className="hidden sm:block" />
                </div>
                <h3 className="text-[9px] sm:text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5 truncate w-full">{t("Pending Sync")}</h3>
                <p className="font-black text-xs sm:text-base text-text-main truncate w-full">
                  {syncStatus?.pendingChanges || 0} {t("Records")}
                </p>
              </div>

              {/* Last Sync */}
              <div className="flex flex-col items-center justify-center p-2.5 sm:p-4 bg-background rounded-xl border border-border text-center">
                <div className="p-2 sm:p-3 rounded-full mb-1 sm:mb-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 shrink-0">
                  <Clock size={18} className="sm:hidden" />
                  <Clock size={24} className="hidden sm:block" />
                </div>
                <h3 className="text-[9px] sm:text-xs font-bold text-text-muted uppercase tracking-wider mb-0.5 truncate w-full">{t("Last Synced")}</h3>
                <p className="font-black text-xs sm:text-base text-text-main truncate w-full font-mono">
                  {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('Never')}
                </p>
                <p className="text-[9px] sm:text-xs text-text-muted mt-0.5 truncate w-full">
                  {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Sync Actions Card */}
        <div className="bg-surface rounded-2xl shadow-xs border border-border overflow-hidden text-center p-4 sm:p-8">
          <h2 className="text-base sm:text-xl font-bold text-text-main mb-1 sm:mb-2">{t("Ready to Sync?")}</h2>
          <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-6 max-w-md mx-auto leading-relaxed">
            {t("Pushing local transactions, bills, and KOTs to the cloud database ensures your dashboard is up to date and your data is securely backed up.")}
          </p>

          <button
            onClick={handleSync}
            disabled={isSyncing || !syncStatus?.isOnline || syncStatus?.pendingChanges === 0}
            className={`
              inline-flex items-center justify-center gap-2 mx-auto text-white px-5 sm:px-8 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-base transition-all shadow-md cursor-pointer
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
            <div className={`mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl inline-flex items-center gap-2.5 text-left text-xs sm:text-sm ${syncResult.success ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300'}`}>
              {syncResult.success ? <CheckCircle className="text-green-500 shrink-0" size={20} /> : <AlertCircle className="text-red-500 shrink-0" size={20} />}
              <div>
                <p className="font-bold">{syncResult.success ? t('Sync Successful') : t('Sync Failed')}</p>
                <p className="text-text-muted mt-0.5">{syncResult.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>);

};

export default ManualSync;