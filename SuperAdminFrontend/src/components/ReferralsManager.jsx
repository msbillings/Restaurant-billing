import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Save, RefreshCw, Users, Calendar, AlertTriangle } from 'lucide-react';
import { getApiBaseUrl } from '../config';

const API_BASE_URL = getApiBaseUrl();

const ReferralsManager = () => {
  const [logs, setLogs] = useState([]);
  const [referrerRewardDays, setReferrerRewardDays] = useState(7);
  const [refereeRewardDays, setRefereeRewardDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const [logsRes, settingsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/referrals`),
          axios.get(`${API_BASE_URL}/referrals/settings`)
        ]);
        if (isMounted) {
          setLogs(logsRes.data.data);
          setReferrerRewardDays(settingsRes.data.referrerRewardDays || 7);
          setRefereeRewardDays(settingsRes.data.refereeRewardDays || 7);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching referrals data:', err);
        if (isMounted) setError('Failed to fetch referrals data.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchInitialData();
    
    return () => { isMounted = false; };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/referrals`),
        axios.get(`${API_BASE_URL}/referrals/settings`)
      ]);
      setLogs(logsRes.data.data);
      setReferrerRewardDays(settingsRes.data.referrerRewardDays || 7);
      setRefereeRewardDays(settingsRes.data.refereeRewardDays || 7);
      setError(null);
    } catch (err) {
      console.error('Error fetching referrals data:', err);
      setError('Failed to fetch referrals data.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await axios.post(`${API_BASE_URL}/referrals/settings`, { 
        referrerRewardDays: Number(referrerRewardDays),
        refereeRewardDays: Number(refereeRewardDays)
      });
      alert('Reward configuration saved successfully!');
    } catch (err) {
      alert('Failed to save settings: ' + (err.response?.data?.message || err.message));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] gap-3 overflow-hidden text-sm">
      
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-2 shrink-0">
        <div>
          <h2 className="text-base md:text-lg font-bold flex items-center gap-2">
            <Gift className="text-primary w-4 h-4 md:w-5 md:h-5" /> 
            Global Referral Rewards
          </h2>
          <p className="text-[10px] md:text-xs text-gray-400 mt-0.5">Configure default rewards and monitor all successful referrals across your platform.</p>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="flex items-center justify-center gap-1.5 bg-background hover:bg-gray-800 border border-border px-3 py-1.5 rounded-lg text-xs md:text-sm transition-colors w-full md:w-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> 
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      )}

      {/* Configuration Section */}
      <div className="bg-surface border border-border rounded-xl p-3 md:p-4 shadow-sm shrink-0">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5 text-white">
          <Calendar className="text-green-500 w-4 h-4" /> Default Reward Settings
        </h3>
        <div className="bg-background border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-end gap-3 max-w-full">
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Referrer Reward (Sender)</label>
              <input 
                type="number" 
                min="1"
                value={referrerRewardDays}
                onChange={(e) => setReferrerRewardDays(e.target.value)}
                className="w-full bg-surface border border-border rounded-md p-2 text-white focus:outline-none focus:border-emerald-500 font-bold text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-1">Referee Reward (New User)</label>
              <input 
                type="number" 
                min="1"
                value={refereeRewardDays}
                onChange={(e) => setRefereeRewardDays(e.target.value)}
                className="w-full bg-surface border border-border rounded-md p-2 text-white focus:outline-none focus:border-blue-500 font-bold text-sm"
              />
            </div>
            <p className="col-span-2 text-[9px] md:text-[10px] text-gray-500 leading-tight">When a new restaurant registers, how many free days are given to the person who shared the link, and the new person joining?</p>
          </div>
          <button 
            onClick={handleSaveSettings}
            disabled={savingSettings || loading}
            className="flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md font-bold transition shadow-sm text-xs shrink-0 w-full sm:w-auto"
          >
            <Save className="w-3.5 h-3.5" />
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Global Logs Section */}
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-border flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <Users className="text-blue-400 w-4 h-4" />
            <h3 className="text-sm font-bold text-white">Global Referral Log</h3>
          </div>
          <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-500/30">
            {logs.length} Successes
          </span>
        </div>
        
        <div className="overflow-y-auto flex-1 min-h-0">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="bg-background/80 backdrop-blur-sm text-gray-400 text-[9px] md:text-[10px] uppercase tracking-wider font-bold">
                <th className="p-2 md:p-3 border-b border-border">Date</th>
                <th className="p-2 md:p-3 border-b border-border text-emerald-400">Referrer</th>
                <th className="p-2 md:p-3 border-b border-border text-blue-400">Referee</th>
                <th className="p-2 md:p-3 border-b border-border text-center">Reward</th>
                <th className="p-2 md:p-3 border-b border-border text-right">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-500">
                    <Gift className="w-10 h-10 mx-auto mb-3 text-gray-600 opacity-50" />
                    <p>No successful referrals have been logged yet.</p>
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log._id} className="hover:bg-background/50 transition-colors border-b border-border/40 last:border-0">
                    <td className="p-2 md:p-3 text-gray-400 font-mono text-[9px] md:text-[10px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString()}<br/>
                      {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="p-2 md:p-3">
                      <p className="font-bold text-white text-[10px] md:text-xs truncate max-w-[80px] md:max-w-[120px]">{log.referrerId?.restaurantName || 'Unknown'}</p>
                      <p className="text-[9px] md:text-[10px] text-gray-500 truncate max-w-[80px] md:max-w-[120px]">{log.referrerId?.email || 'N/A'}</p>
                    </td>
                    <td className="p-2 md:p-3">
                      <p className="font-bold text-white text-[10px] md:text-xs truncate max-w-[80px] md:max-w-[120px]">{log.refereeId?.restaurantName || 'Unknown'}</p>
                      <p className="text-[9px] md:text-[10px] text-gray-500 truncate max-w-[80px] md:max-w-[120px]">{log.refereeId?.email || 'N/A'}</p>
                    </td>
                    <td className="p-2 md:p-3 text-center flex flex-col items-center gap-1">
                      <span className="bg-emerald-500/10 text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[9px] md:text-[10px] border border-emerald-500/20 whitespace-nowrap">
                        +{log.referrerRewardDays} Days (Sender)
                      </span>
                      <span className="bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded text-[9px] md:text-[10px] border border-blue-500/20 whitespace-nowrap">
                        +{log.refereeRewardDays} Days (New)
                      </span>
                    </td>
                    <td className="p-2 md:p-3 text-right">
                      <span className="bg-green-500/10 text-green-400 font-bold px-2 py-0.5 rounded-full text-[9px] md:text-[10px] border border-green-500/20 whitespace-nowrap">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

// Also define Loader2 if it's missing from import, or just use RefreshCw for loading.
const Loader2 = ({ className }) => <RefreshCw className={className} />;

export default ReferralsManager;
