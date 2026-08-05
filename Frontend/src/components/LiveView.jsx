import { useLanguage } from "../context/LanguageContext";
import React, { useState, useEffect, useRef } from 'react';
import BackButton from './common/BackButton';
import axios from '../api/axios';
import { ArrowLeft, MonitorPlay, Video, Plus, Settings, X, Trash2 } from 'lucide-react';

const LiveView = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamera, setNewCamera] = useState({ name: '', rtspUrl: '', location: 'Main' });
  const [adding, setAdding] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [gridSize, setGridSize] = useState('auto');
  const [streamQuality, setStreamQuality] = useState('auto');

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await axios.get('/cameras');
      setCameras(response.data);
    } catch (error) {
      console.error('Error fetching cameras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCamera = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      const response = await axios.post('/cameras', newCamera);
      setCameras([response.data, ...cameras]);
      setShowAddModal(false);
      setNewCamera({ name: '', rtspUrl: '', location: 'Main' });
    } catch (error) {
      console.error('Error adding camera:', error);
      alert('Failed to add camera: ' + (error.response?.data?.message || error.message));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteCamera = async (id) => {
    if (!window.confirm(t('Are you sure you want to delete this camera?'))) return;
    
    try {
      await axios.delete(`/cameras/${id}`);
      setCameras(cameras.filter(c => c._id !== id));
    } catch (error) {
      console.error('Error deleting camera:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-gray-100 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <MonitorPlay className="text-primary" />{t("Live View")}
            </h1>
            <p className="text-sm text-gray-400">{t("Monitor your restaurant floor and kitchen in real-time")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors">
            <Settings size={20} />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-primary-dark transition-colors">
            <Plus size={18} />{t("Add Camera")}
          </button>
        </div>
      </div>

      <div className={`flex-1 grid gap-4 overflow-y-auto pb-4 ${
        gridSize === 'auto' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' :
        gridSize === '2x2' ? 'grid-cols-2' :
        gridSize === '3x3' ? 'grid-cols-3' : 'grid-cols-1'
      }`}>
        {loading ? (
          <div className="col-span-full flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : cameras.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center text-gray-500 h-64 bg-gray-800/50 rounded-xl border border-gray-800 border-dashed">
            <Video size={48} className="mb-4 opacity-50" />
            <p>{t("No cameras connected.")}</p>
            <button onClick={() => setShowAddModal(true)} className="mt-4 text-primary font-bold">
              {t("Add your first camera")}
            </button>
          </div>
        ) : (
          cameras.map((cam) => (
            <CameraStream key={cam._id} camera={cam} onDelete={() => handleDeleteCamera(cam._id)} />
          ))
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{t("Add IP Camera")}</h2>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleAddCamera} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("Camera Name")}</label>
                <input
                  type="text"
                  required
                  value={newCamera.name}
                  onChange={(e) => setNewCamera({ ...newCamera, name: e.target.value })}
                  placeholder="e.g. Kitchen Cam 1"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">{t("RTSP URL")}</label>
                <input
                  type="text"
                  required
                  value={newCamera.rtspUrl}
                  onChange={(e) => setNewCamera({ ...newCamera, rtspUrl: e.target.value })}
                  placeholder="rtsp://admin:pass@192.168.1.100:554/stream"
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-primary font-mono text-sm"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-600"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark disabled:opacity-50"
                >
                  {adding ? t("Adding...") : t("Add Camera")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden border border-gray-700">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">{t("Live View Settings")}</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t("Grid Layout")}</label>
                <div className="flex gap-2">
                  {['auto', '2x2', '3x3'].map(size => (
                    <button
                      key={size}
                      onClick={() => setGridSize(size)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors ${
                        gridSize === size 
                        ? 'bg-primary/20 border-primary text-primary' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {size === 'auto' ? t('Auto') : size}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t("Stream Quality")}</label>
                <div className="flex gap-2">
                  {['auto', 'hd', 'sd'].map(quality => (
                    <button
                      key={quality}
                      onClick={() => setStreamQuality(quality)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-colors uppercase ${
                        streamQuality === quality 
                        ? 'bg-primary/20 border-primary text-primary' 
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t(quality)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">{t("Changing quality may require restarting streams.")}</p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
                >
                  {t("Done")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component to handle individual camera websocket stream
const CameraStream = ({ camera, onDelete }) => {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [player, setPlayer] = useState(null);
  const [streamStatus, setStreamStatus] = useState('connecting'); // connecting, playing, error

  useEffect(() => {
    let jsmpegPlayer = null;

    const startStream = async () => {
      try {
        setStreamStatus('connecting');
        const response = await axios.get(`/cameras/${camera._id}/stream`);
        
        const { wsPort } = response.data;
        const wsUrl = `ws://localhost:${wsPort}`;

        if (window.JSMpeg && canvasRef.current) {
          jsmpegPlayer = new window.JSMpeg.Player(wsUrl, {
            canvas: canvasRef.current,
            autoplay: true,
            audio: false,
            onPlay: () => setStreamStatus('playing'),
            onStalled: () => setStreamStatus('error'),
          });
          setPlayer(jsmpegPlayer);
        }
      } catch (error) {
        console.error('Failed to start stream', error);
        setStreamStatus('error');
      }
    };

    startStream();

    return () => {
      if (jsmpegPlayer) {
        jsmpegPlayer.destroy();
      }
    };
  }, [camera._id]);

  return (
    <div className="bg-black border border-gray-800 rounded-xl overflow-hidden flex flex-col h-64 group relative">
      <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start">
        <div className="flex items-center gap-2">
          <Video size={16} className="text-gray-400" />
          <span className="font-bold text-sm text-white drop-shadow-md">{camera.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onDelete}
            className="p-1 bg-red-500/20 text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/40"
          >
            <Trash2 size={14} />
          </button>
          
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            streamStatus === 'playing' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
            streamStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
            'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            {streamStatus === 'playing' && <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>}
            {t(streamStatus === 'playing' ? 'ONLINE' : streamStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE')}
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-gray-900 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full object-cover"></canvas>
        
        {streamStatus !== 'playing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 z-10">
            {streamStatus === 'connecting' ? (
              <>
                <div className="animate-spin w-8 h-8 border-4 border-gray-600 border-t-primary rounded-full mb-2"></div>
                <span className="text-gray-400 text-xs font-mono uppercase tracking-widest">{t("Connecting to RTSP Stream")}</span>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-2">
                  <Video size={24} className="opacity-50 text-red-500" />
                </div>
                <span className="text-red-400 text-xs font-mono uppercase tracking-widest">{t("Connection Failed")}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveView;