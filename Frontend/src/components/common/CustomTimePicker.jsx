import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

const CustomTimePicker = ({ value, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [clockMode, setClockMode] = useState('hour'); // 'hour' | 'minute'
  const dropdownRef = useRef(null);

  // Parse 24h "HH:MM" → { hour, minute, ampm }
  const parse24h = (str) => {
    if (!str) return { hour: '10', minute: '30', ampm: 'PM' };
    const [hRaw, mRaw] = str.split(':');
    let h = parseInt(hRaw, 10) || 0;
    const m = mRaw ? mRaw.padStart(2, '0') : '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return { hour: String(h).padStart(2, '0'), minute: m, ampm };
  };

  const [time, setTime] = useState(() => parse24h(value));

  useEffect(() => { setTime(parse24h(value)); }, [value]);

  // Click outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setClockMode('hour');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const emit = (t) => {
    let h = parseInt(t.hour, 10);
    if (t.ampm === 'PM' && h !== 12) h += 12;
    if (t.ampm === 'AM' && h === 12) h = 0;
    onChange(`${String(h).padStart(2, '0')}:${t.minute}`);
  };

  const update = (newT) => { setTime(newT); emit(newT); };

  // ── Dial geometry ──
  const CENTER = 100;
  const HAND_R = 68;
  const NUM_R  = 78;
  const isHour = clockMode === 'hour';
  const hourNum = parseInt(time.hour);
  const minNum  = parseInt(time.minute);
  const hourAngle = ((hourNum % 12) / 12) * 360 - 90;
  const minAngle  = (minNum / 60) * 360 - 90;
  const ang = isHour ? hourAngle : minAngle;
  const hx = CENTER + HAND_R * Math.cos((ang * Math.PI) / 180);
  const hy = CENTER + HAND_R * Math.sin((ang * Math.PI) / 180);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setIsOpen(o => !o); setClockMode('hour'); }}
        className="flex items-center gap-2 px-3 py-1.5 border border-[#25D366]/40 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300 rounded-xl text-sm font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors focus:outline-none shadow-sm"
      >
        <Clock size={13} className="text-[#25D366]" />
        <span>{`${time.hour}:${time.minute} ${time.ampm}`}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-[200] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 w-64 animate-in fade-in slide-in-from-top-2">
          {/* Header label */}
          {label && <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">{label}</p>}

          {/* Time display + AM/PM */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-3 py-1.5 border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setClockMode('hour')}
                className={`text-xl font-black tabular-nums px-1 rounded-lg transition-all cursor-pointer ${clockMode === 'hour' ? 'text-[#25D366]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                {time.hour}
              </button>
              <span className="text-xl font-black text-gray-400 select-none">:</span>
              <button
                type="button"
                onClick={() => setClockMode('minute')}
                className={`text-xl font-black tabular-nums px-1 rounded-lg transition-all cursor-pointer ${clockMode === 'minute' ? 'text-[#25D366]' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                {time.minute}
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {['AM', 'PM'].map(p => (
                <button key={p} type="button"
                  onClick={() => update({ ...time, ampm: p })}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${time.ampm === p ? 'bg-[#25D366] text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Dial */}
          <div className="flex justify-center">
            <svg viewBox="0 0 200 200" width="200" height="200">
              {/* Outer ring */}
              <circle cx={CENTER} cy={CENTER} r="96" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1.5"/>
              {/* Ticks */}
              {Array.from({ length: 60 }, (_, i) => {
                const a = (i / 60) * 360 - 90;
                const r = (a * Math.PI) / 180;
                const major = i % 5 === 0;
                const r1 = major ? 84 : 88;
                return (
                  <line key={i}
                    x1={CENTER + r1 * Math.cos(r)} y1={CENTER + r1 * Math.sin(r)}
                    x2={CENTER + 92 * Math.cos(r)} y2={CENTER + 92 * Math.sin(r)}
                    stroke={major ? '#9ca3af' : '#e5e7eb'}
                    strokeWidth={major ? 1.5 : 0.8}
                  />
                );
              })}
              {/* Hand */}
              <line x1={CENTER} y1={CENTER} x2={hx} y2={hy} stroke="#25D366" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx={hx} cy={hy} r="5" fill="#25D366"/>
              <circle cx={CENTER} cy={CENTER} r="4" fill="#25D366"/>
              {/* Hour numbers */}
              {isHour && Array.from({ length: 12 }, (_, i) => {
                const h = i + 1;
                const a = (h / 12) * 360 - 90;
                const r = (a * Math.PI) / 180;
                const x = CENTER + NUM_R * Math.cos(r);
                const y = CENTER + NUM_R * Math.sin(r);
                const active = h === hourNum;
                return (
                  <g key={h} onClick={() => { update({ ...time, hour: String(h).padStart(2,'0') }); setClockMode('minute'); }} style={{ cursor: 'pointer' }}>
                    {active && <circle cx={x} cy={y} r="13" fill="#25D366"/>}
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                      fontSize="13" fontWeight="700" fill={active ? '#fff' : '#374151'} fontFamily="inherit">
                      {h}
                    </text>
                  </g>
                );
              })}
              {/* Minute markers */}
              {!isHour && Array.from({ length: 12 }, (_, i) => {
                const m = i * 5;
                const a = (m / 60) * 360 - 90;
                const r = (a * Math.PI) / 180;
                const x = CENTER + NUM_R * Math.cos(r);
                const y = CENTER + NUM_R * Math.sin(r);
                const active = minNum === m;
                return (
                  <g key={m} onClick={() => update({ ...time, minute: String(m).padStart(2,'0') })} style={{ cursor: 'pointer' }}>
                    {active && <circle cx={x} cy={y} r="13" fill="#25D366"/>}
                    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                      fontSize="11" fontWeight="700" fill={active ? '#fff' : '#374151'} fontFamily="inherit">
                      {String(m).padStart(2,'0')}
                    </text>
                  </g>
                );
              })}
              <text x={CENTER} y={CENTER} textAnchor="middle" dominantBaseline="central"
                fontSize="9" fontWeight="600" fill="#9ca3af" fontFamily="inherit">
                {isHour ? 'HR' : 'MIN'}
              </text>
            </svg>
          </div>

          <button
            type="button"
            onClick={() => { setIsOpen(false); setClockMode('hour'); }}
            className="mt-2 w-full py-1.5 rounded-xl text-xs font-bold bg-[#25D366] text-white hover:bg-[#20bd5a] transition-colors cursor-pointer">
            Done
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomTimePicker;
