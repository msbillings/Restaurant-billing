import React, { useEffect, useState, useRef } from 'react';
import axios from '../api/axios';
import { Bell, Droplets, CreditCard, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ServiceRequestAlert = () => {
  const [requests, setRequests] = useState([]);
  const [playingAudio, setPlayingAudio] = useState(false);
  const audioRef = useRef(null);
  
  // Track previous request IDs to know if we got a new one
  const prevRequestIds = useRef(new Set());

  useEffect(() => {
    // Create an audio element for the chime (ding sound)
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // A nice pleasant bell
    
    const fetchRequests = async () => {
      try {
        const response = await axios.get('/service-requests');
        const activeRequests = response.data;
        setRequests(activeRequests);
        
        // Check for new requests
        let hasNew = false;
        const currentIds = new Set(activeRequests.map(r => r._id));
        
        for (let id of currentIds) {
          if (!prevRequestIds.current.has(id)) {
            hasNew = true;
            break;
          }
        }
        
        if (hasNew) {
          playChime();
        }
        
        prevRequestIds.current = currentIds;
      } catch (err) {
        console.error("Failed to fetch service requests", err);
      }
    };

    fetchRequests();
    const interval = setInterval(fetchRequests, 5000); // Poll every 5s

    return () => clearInterval(interval);
  }, []);

  const playChime = () => {
    if (audioRef.current && !playingAudio) {
      setPlayingAudio(true);
      audioRef.current.play().catch(e => console.error("Audio play failed (maybe require user interaction):", e));
      
      audioRef.current.onended = () => {
        setPlayingAudio(false);
      };
    }
  };

  const handleResolve = async (id) => {
    try {
      await axios.put(`/service-requests/${id}/resolve`);
      setRequests(prev => prev.filter(r => r._id !== id));
      prevRequestIds.current.delete(id);
    } catch (err) {
      console.error("Failed to resolve request", err);
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'Need Water': return <Droplets className="text-blue-500" />;
      case 'Pay the Bill': return <CreditCard className="text-green-500" />;
      default: return <Bell className="text-orange-500" />;
    }
  };

  return (
    <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {requests.map(request => (
          <motion.div
            key={request._id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, x: 50 }}
            className="bg-white border-l-4 border-orange-500 shadow-2xl rounded-xl p-4 pointer-events-auto flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              {getIcon(request.requestType)}
            </div>
            <div className="flex-1">
              <h4 className="font-black text-slate-800 text-lg">Table {request.tableNumber}</h4>
              <p className="text-sm font-bold text-slate-500">{request.requestType}</p>
              <p className="text-xs text-slate-400">{new Date(request.createdAt).toLocaleTimeString()}</p>
            </div>
            <button 
              onClick={() => handleResolve(request._id)}
              className="bg-green-100 text-green-700 hover:bg-green-500 hover:text-white p-3 rounded-xl transition-colors shadow-sm"
              title="Mark as Done"
            >
              <Check size={20} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ServiceRequestAlert;
