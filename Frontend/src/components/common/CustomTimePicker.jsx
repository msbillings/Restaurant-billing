import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

const CustomTimePicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Parse initial 24h value "HH:MM" to 12h components
  const parseTime = (timeStr) => {
    if (!timeStr) return { hour: '10', min: '00', period: 'PM' };
    let [h, m] = timeStr.split(':');
    h = parseInt(h, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return {
      hour: h.toString().padStart(2, '0'),
      min: m.padStart(2, '0'),
      period
    };
  };

  const [time, setTime] = useState(parseTime(value));

  useEffect(() => {
    setTime(parseTime(value));
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateTime = (newTime) => {
    setTime(newTime);
    // Convert back to 24h format for parent
    let h = parseInt(newTime.hour, 10);
    if (newTime.period === 'PM' && h !== 12) h += 12;
    if (newTime.period === 'AM' && h === 12) h = 0;
    const formatted24h = `${h.toString().padStart(2, '0')}:${newTime.min}`;
    onChange(formatted24h);
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  const periods = ['AM', 'PM'];

  return (
    <div className="relative" ref={dropdownRef}>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#25D366]/30 bg-emerald-50 text-emerald-900 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 shadow-sm"
      >
        <span>{`${time.hour}:${time.min} ${time.period}`}</span>
        <Clock size={14} className="text-[#25D366]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-2 flex gap-2 animate-in fade-in slide-in-from-top-2">
          {/* Hours */}
          <div className="h-48 overflow-y-auto hide-scrollbar w-16 border border-gray-100 rounded-lg bg-gray-50 flex flex-col">
            <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-1.5 z-10 shadow-sm rounded-t-lg">Hour</div>
            <div className="p-1 space-y-1">
              {hours.map(h => (
                <button
                  key={`h-${h}`}
                  type="button"
                  onClick={() => updateTime({ ...time, hour: h })}
                  className={`w-full py-1.5 text-sm rounded-md transition-colors ${time.hour === h ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 hover:bg-gray-200'}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div className="h-48 overflow-y-auto hide-scrollbar w-16 border border-gray-100 rounded-lg bg-gray-50 flex flex-col">
            <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-1.5 z-10 shadow-sm rounded-t-lg">Min</div>
            <div className="p-1 space-y-1">
              {minutes.map(m => (
                <button
                  key={`m-${m}`}
                  type="button"
                  onClick={() => updateTime({ ...time, min: m })}
                  className={`w-full py-1.5 text-sm rounded-md transition-colors ${time.min === m ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 hover:bg-gray-200'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Period */}
          <div className="h-48 w-16 border border-gray-100 rounded-lg bg-gray-50 flex flex-col">
            <div className="sticky top-0 bg-blue-600 text-white text-xs font-bold text-center py-1.5 z-10 shadow-sm rounded-t-lg">AM/PM</div>
            <div className="p-1 space-y-1">
              {periods.map(p => (
                <button
                  key={`p-${p}`}
                  type="button"
                  onClick={() => updateTime({ ...time, period: p })}
                  className={`w-full py-2 text-sm rounded-md transition-colors ${time.period === p ? 'bg-blue-600 text-white font-bold' : 'text-gray-700 hover:bg-gray-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
