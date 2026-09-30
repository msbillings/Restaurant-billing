import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, AreaChart, Area
} from 'recharts';
import { Activity, Database, Server, Zap, ArrowUpRight, Clock, AlertTriangle, Wifi, Timer, IndianRupee, Printer, CheckCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function RealtimeAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]); // For real-time timeline chart
  const [activeTab, setActiveTab] = useState('network'); // 'network' or 'business'

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/analytics/realtime`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
        });
        if (!isMounted) return;
        
        setData(res.data);
        
        // Update history for timeline
        setHistory(prev => {
          const newPoint = {
            time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }),
            rpm: res.data.totalRPM,
            dataTransfer: res.data.totalDataTransfer / 1024 // in KB
          };
          const newHistory = [...prev, newPoint];
          if (newHistory.length > 20) newHistory.shift(); // keep last 20 points
          return newHistory;
        });
      } catch (err) {
        console.error('Failed to fetch realtime analytics:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && !data) {
    return <div className="flex justify-center items-center h-64 text-primary"><Activity className="animate-spin mr-2" /> Loading Real-time Streams...</div>;
  }

  if (!data) return <div className="text-red-500">Failed to load real-time data.</div>;

  const topRestaurantsByRPM = data.restaurants.slice(0, 5);

  return (
    <div className="space-y-4 text-gray-100 pb-6">
      
      <div className="flex justify-between items-center bg-gray-800 p-2 md:p-3 rounded-xl shadow-lg border border-gray-700/50 mb-2">
        <div className="flex items-center gap-3">
          <h2 className="text-base md:text-lg font-bold flex items-center bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">
            <Zap className="mr-1.5 text-emerald-400 animate-pulse" size={16} /> Live Pulse Metrics
          </h2>
          <p className="text-[10px] text-gray-400 hidden sm:block border-l border-gray-700 pl-3">SaaS telemetry updating every 5s</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-mono text-sm font-semibold tracking-wider">LIVE</span>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-gray-700/50 pb-2 mb-4">
        <button 
          onClick={() => setActiveTab('network')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeTab === 'network' ? 'bg-gray-800 text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
        >
          Network & Infrastructure
        </button>
        <button 
          onClick={() => setActiveTab('business')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeTab === 'business' ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
        >
          Business & Deep Metrics
        </button>
        <button 
          onClick={() => setActiveTab('printQueue')}
          className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeTab === 'printQueue' ? 'bg-gray-800 text-amber-400 border-b-2 border-amber-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
        >
          Print Queues & Background Jobs
        </button>
      </div>

      {activeTab === 'network' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 font-medium">Global RPM</p>
              <h3 className="text-3xl font-bold text-white mt-1 font-mono">{data.totalRPM.toLocaleString()}</h3>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
              <Activity size={24} />
            </div>
          </div>
          <p className="text-xs text-green-400 mt-3 flex items-center"><ArrowUpRight size={14} className="mr-1"/> Network requests / min</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 font-medium">Avg Latency</p>
              <h3 className="text-3xl font-bold text-white mt-1 font-mono">{(data.avgSystemLatency || 0).toFixed(0)} ms</h3>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400">
              <Timer size={24} />
            </div>
          </div>
          <p className="text-xs text-emerald-400 mt-3 flex items-center"><Clock size={14} className="mr-1"/> Server response time</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 font-medium">API Errors</p>
              <h3 className="text-3xl font-bold text-white mt-1 font-mono">{data.totalErrors || 0}</h3>
            </div>
            <div className="p-3 rounded-lg bg-red-500/20 text-red-400">
              <AlertTriangle size={24} />
            </div>
          </div>
          <p className="text-xs text-red-400 mt-3 flex items-center">HTTP 4xx/5xx last minute</p>
        </div>

        <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-400 font-medium">Live Connections</p>
              <h3 className="text-3xl font-bold text-white mt-1 font-mono">{(data.activeWebSockets || 0).toLocaleString()}</h3>
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/20 text-yellow-400">
              <Wifi size={24} />
            </div>
          </div>
          <p className="text-xs text-yellow-400 mt-3 flex items-center">Active WebSocket sessions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Real-time Timeline */}
        <div className="bg-gray-800 rounded-xl p-3 md:p-4 shadow border border-gray-700/50">
          <h3 className="text-md font-bold mb-2 flex items-center"><Activity className="mr-2 text-primary" size={18}/> Network Traffic (RPM)</h3>
          <div className="h-48 md:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorRpm" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis dataKey="time" stroke="#9ca3af" fontSize={12} tickMargin={10} />
                <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(val) => Math.floor(val)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Area type="monotone" dataKey="rpm" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRpm)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Tenants by RPM */}
        <div className="bg-gray-800 rounded-xl p-3 md:p-4 shadow border border-gray-700/50">
          <h3 className="text-md font-bold mb-2 flex items-center"><Server className="mr-2 text-purple-400" size={18}/> Top Active Restaurants (RPM)</h3>
          <div className="h-48 md:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topRestaurantsByRPM} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" stroke="#9ca3af" fontSize={12} />
                <YAxis dataKey="restaurantName" type="category" stroke="#9ca3af" fontSize={12} width={120} tick={{fill: '#e5e7eb'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', borderRadius: '8px', color: '#fff' }}
                  cursor={{fill: '#374151'}}
                />
                <Bar dataKey="rpm" fill="#a855f7" radius={[0, 4, 4, 0]} isAnimationActive={true}>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-gray-800 rounded-xl shadow border border-gray-700/50 overflow-hidden">
        <div className="p-3 md:p-4 border-b border-gray-700/50 flex justify-between items-center bg-gray-800/80">
          <h3 className="text-md font-bold flex items-center"><Database className="mr-2 text-emerald-400" size={18}/> Tenant Live Matrix</h3>
          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-semibold">Total: {data.restaurants.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs text-gray-400 uppercase bg-gray-900/50">
              <tr className="whitespace-nowrap">
                <th className="px-6 py-4 font-semibold">Restaurant / Instance</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Cluster</th>
                <th className="px-6 py-4 font-semibold">RPM</th>
                <th className="px-6 py-4 font-semibold">Data Tx/Rx (Daily)</th>
                <th className="px-6 py-4 font-semibold">DB Storage Size</th>
                <th className="px-6 py-4 font-semibold">Last Ping</th>
              </tr>
            </thead>
            <tbody>
              {data.restaurants.map((restaurant) => (
                <tr key={restaurant._id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors whitespace-nowrap">
                  <td className="px-6 py-4 font-medium text-white flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 ${restaurant.isCurrentlyActive ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`}></div>
                    {restaurant.restaurantName}
                  </td>
                  <td className="px-6 py-4">
                    {restaurant.isCurrentlyActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active Now
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                        Idle
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-gray-700 text-gray-300 text-xs font-mono border border-gray-600">{restaurant.cluster}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-blue-400">{restaurant.rpm}</td>
                  <td className="px-6 py-4 font-mono text-purple-400">{formatBytes(restaurant.dataTransferDaily)}</td>
                  <td className="px-6 py-4 font-mono text-yellow-400">{formatBytes(restaurant.dbStorageSize)}</td>
                  <td className="px-6 py-4 text-xs text-gray-500">
                    {new Date(restaurant.lastActive).getTime() === 0 ? 'Never' : new Date(restaurant.lastActive).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {activeTab === 'business' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-400 font-medium">Active Now</p>
                  <h3 className="text-3xl font-bold text-white mt-1 font-mono">{data.activeRestaurants} / {data.restaurants.length}</h3>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Server size={24} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3 flex items-center"><Clock size={14} className="mr-1"/> Restaurants running sales</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-400 font-medium">Daily Transfer</p>
                  <h3 className="text-3xl font-bold text-white mt-1 font-mono">{formatBytes(data.totalDataTransfer)}</h3>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                  <ArrowUpRight size={24} />
                </div>
              </div>
              <p className="text-xs text-purple-400 mt-3 flex items-center">Payload size (In/Out)</p>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 transform hover:scale-105 transition-transform duration-300">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-400 font-medium">Total DB Storage</p>
                  <h3 className="text-xl md:text-2xl font-bold text-white mt-1 font-mono">
                    {formatBytes(data.totalStorageSize)} <span className="text-gray-500 text-lg">/ 5 GB</span>
                  </h3>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
                  <Database size={24} />
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1.5">
                  <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((data.totalStorageSize / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }}></div>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>Occupied: {formatBytes(data.totalStorageSize)}</span>
                  <span>Remaining: {formatBytes(Math.max(0, (5 * 1024 * 1024 * 1024) - data.totalStorageSize))}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 md:p-5 shadow border border-gray-700/50 border-green-500/50 transform hover:scale-105 transition-transform duration-300 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-900/10 z-0"></div>
              <div className="relative z-10 flex justify-between items-start">
                <div>
                  <p className="text-sm text-green-300 font-medium">Live Revenue Velocity</p>
                  <h3 className="text-3xl font-bold text-green-400 mt-1 font-mono flex items-center">
                    ₹{(data.liveRevenue || 0).toLocaleString('en-IN')}
                  </h3>
                </div>
                <div className="p-3 rounded-lg bg-green-500/20 text-green-400 animate-pulse">
                  <IndianRupee size={24} />
                </div>
              </div>
              <p className="text-xs text-green-400 mt-3 flex items-center relative z-10 font-mono">
                <Clock size={14} className="mr-1"/> 
                {new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
              </p>
            </div>
          </div>
        </>
      )}

      {activeTab === 'printQueue' && (
        <>
          {/* Top Cards for Print Queue */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4">
            <div className="bg-gray-800 rounded-xl p-3 shadow border border-gray-700/50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Global KOTs/Bills Queued</p>
                  <h3 className="text-2xl font-bold text-white mt-1 font-mono">{data.globalPrintJobs || 0}</h3>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400"><Printer size={20} /></div>
              </div>
            </div>
            
            <div className={"bg-gray-800 rounded-xl p-3 shadow border "}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Failed Print Jobs</p>
                  <h3 className={"text-2xl font-bold mt-1 font-mono "}>{data.globalFailedPrints || 0}</h3>
                </div>
                <div className={"p-2 rounded-lg "}>
                  {(data.globalFailedPrints > 0) ? <AlertTriangle size={20} className="animate-pulse" /> : <CheckCircle size={20} />}
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-3 shadow border border-gray-700/50">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Active Print Nodes</p>
                  <h3 className="text-2xl font-bold text-white mt-1 font-mono">{data.globalActivePrintNodes || 0}</h3>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400"><Server size={20} /></div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700/50 p-4">
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center"><Printer className="w-4 h-4 mr-2 text-gray-400"/> Live Restaurant Print Radar</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-900/50 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3">Restaurant</th>
                    <th className="px-4 py-3">Queued KOTs/Bills</th>
                    <th className="px-4 py-3">Failed Prints</th>
                    <th className="px-4 py-3">Nodes Online</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.restaurants && data.restaurants.length > 0 ? (
                    data.restaurants.map(r => {
                      const queued = r.printQueue ? (r.printQueue.queuedKOTs + r.printQueue.queuedBills) : 0;
                      const failed = r.printQueue ? r.printQueue.failedPrints : 0;
                      const nodes = r.printQueue ? r.printQueue.printNodesOnline : 0;
                      let status = 'Healthy';
                      let statusColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
                      if (failed > 0) {
                        status = 'Offline / Errored';
                        statusColor = 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse';
                      } else if (queued > 5) {
                        status = 'High Queue / Backlogged';
                        statusColor = 'bg-amber-500/20 text-amber-400 border-amber-500/50';
                      }

                      return (
                        <tr key={r._id} className="border-b border-gray-700/50 hover:bg-gray-750 transition-colors">
                          <td className="px-4 py-3 font-medium text-white">{r.restaurantName}</td>
                          <td className="px-4 py-3 font-mono">{queued}</td>
                          <td className={`px-4 py-3 font-mono ${failed > 0 ? 'text-red-400 font-bold' : ''}`}>{failed}</td>
                          <td className="px-4 py-3 font-mono">{nodes}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-[10px] font-bold uppercase rounded border ${statusColor}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No active restaurants found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

