import React, { useState } from 'react';
import { ArrowLeft, MonitorPlay, Video, Plus, Settings } from 'lucide-react';

const LiveView = ({ onNavigate }) => {
  const [cameras, setCameras] = useState([
    { id: 1, name: 'Kitchen Cam 1', status: 'online', stream: 'mock' },
    { id: 2, name: 'Cash Register', status: 'online', stream: 'mock' },
    { id: 3, name: 'Dining Area', status: 'offline', stream: 'mock' },
  ]);

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MonitorPlay className="text-primary" /> Live View
            </h1>
            <p className="text-sm text-gray-400">Monitor your restaurant floor and kitchen in real-time</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
            <Settings size={20} />
          </button>
          <button className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-dark transition-colors">
            <Plus size={18} /> Add Camera
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
        {cameras.map(cam => (
          <div key={cam.id} className="bg-black border border-gray-800 rounded-xl overflow-hidden flex flex-col h-64 group relative">
            <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Video size={16} className="text-gray-400" />
                <span className="font-bold text-sm text-white drop-shadow-md">{cam.name}</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cam.status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                {cam.status === 'online' && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>}
                {cam.status}
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center bg-gray-900 relative">
              {cam.status === 'online' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <MonitorPlay size={48} className="text-gray-800 mb-2" />
                  <span className="text-gray-700 text-xs font-mono uppercase tracking-widest">Awaiting RTSP Stream</span>
                </div>
              ) : (
                <div className="text-gray-600 text-sm flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                    <Video size={24} className="opacity-50" />
                  </div>
                  Connection Lost
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveView;
