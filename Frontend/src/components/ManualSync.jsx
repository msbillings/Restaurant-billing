import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, RefreshCw, CheckCircle, Clock, Database, Cloud, AlertCircle, Server } from 'lucide-react';

const ManualSync = ({ onNavigate }) => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5002/api/sync/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
      const response = await axios.post('http://localhost:5002/api/sync/trigger', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cloud Data Sync</h1>
            <p className="text-sm text-gray-500">Push your offline/local data to the cloud database</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Database className="text-primary" size={20} /> System Status
            </h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Network Status */}
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                <div className={`p-4 rounded-full mb-3 ${syncStatus?.isOnline ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {syncStatus?.isOnline ? <Cloud size={32} /> : <AlertCircle size={32} />}
                </div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Internet</h3>
                <p className={`font-bold text-lg ${syncStatus?.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                  {syncStatus?.isOnline ? 'Connected' : 'Offline'}
                </p>
              </div>

              {/* Pending Changes */}
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                <div className="p-4 rounded-full mb-3 bg-blue-100 text-blue-600">
                  <Server size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Pending Sync</h3>
                <p className="font-bold text-lg text-gray-800">
                  {syncStatus?.pendingChanges || 0} Records
                </p>
              </div>

              {/* Last Sync */}
              <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-xl border border-gray-100 text-center">
                <div className="p-4 rounded-full mb-3 bg-purple-100 text-purple-600">
                  <Clock size={32} />
                </div>
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">Last Synced</h3>
                <p className="font-bold text-md text-gray-800 break-words w-full">
                  {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Never'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {syncStatus?.lastSyncedAt ? new Date(syncStatus.lastSyncedAt).toLocaleDateString() : ''}
                </p>
              </div>

            </div>
          </div>
        </div>

        {/* Sync Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden text-center p-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Ready to Sync?</h2>
          <p className="text-gray-500 mb-8 max-w-lg mx-auto">
            Pushing local transactions, bills, and KOTs to the cloud database ensures your dashboard is up to date and your data is securely backed up.
          </p>

          <button 
            onClick={handleSync}
            disabled={isSyncing || !syncStatus?.isOnline || syncStatus?.pendingChanges === 0}
            className={`
              relative flex items-center justify-center gap-3 mx-auto text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-md
              ${isSyncing 
                ? 'bg-primary/80 cursor-not-allowed' 
                : !syncStatus?.isOnline || syncStatus?.pendingChanges === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' 
                  : 'bg-primary hover:bg-primary-hover hover:-translate-y-1 hover:shadow-lg'}
            `}
          >
            {isSyncing ? (
              <>
                <RefreshCw size={24} className="animate-spin" />
                Syncing to Cloud...
              </>
            ) : (
              <>
                <RefreshCw size={24} />
                Push to Cloud Now
              </>
            )}
          </button>

          {syncResult && (
            <div className={`mt-8 p-4 rounded-lg inline-flex items-center gap-3 text-left ${syncResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              {syncResult.success ? <CheckCircle className="text-green-500" size={24} /> : <AlertCircle className="text-red-500" size={24} />}
              <div>
                <p className="font-bold">{syncResult.success ? 'Sync Successful' : 'Sync Failed'}</p>
                <p className="text-sm">{syncResult.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManualSync;
