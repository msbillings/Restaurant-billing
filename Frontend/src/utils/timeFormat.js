/**
 * Utility functions for 12-hour time formatting across the application.
 * Formats time strictly in 12-hour format with AM/PM (e.g., '12:00 am', '01:00 pm').
 */

export const formatHourSlot12 = (hr) => {
  const h = Number(hr) || 0;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const ampm = h < 12 ? 'am' : 'pm';
  return `${hour12.toString().padStart(2, '0')}:00 ${ampm}`;
};

export const formatTime12 = (input) => {
  if (input === undefined || input === null || input === '') return '';

  // If input is an hour index (0 - 24)
  if (typeof input === 'number' && input >= 0 && input <= 24) {
    return formatHourSlot12(input);
  }

  // If input is a string
  if (typeof input === 'string') {
    const trimmed = input.trim();

    // If it's a date label like "30/08", "01/09", "2026-09-06", DO NOT parse as time!
    if (/^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    // Check if it's already in 12-hour format: e.g. "01:00 pm" or "1:00 PM"
    const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
    if (match12) {
      const h = parseInt(match12[1], 10);
      const m = match12[2];
      const ampm = match12[3].toLowerCase();
      return `${h.toString().padStart(2, '0')}:${m} ${ampm}`;
    }

    // Check if it's a 24-hour time string: e.g. "00:00", "01:00", "13:45"
    const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (match24) {
      const h = parseInt(match24[1], 10);
      const m = match24[2];
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const ampm = h < 12 ? 'am' : 'pm';
      return `${hour12.toString().padStart(2, '0')}:${m} ${ampm}`;
    }

    // If it does not contain time components ('T' or ':'), do NOT parse as time
    if (!trimmed.includes('T') && !trimmed.includes(':')) {
      return trimmed;
    }
  }

  // Try parsing as Date
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return String(input);

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const formattedHours = hours.toString().padStart(2, '0');

  return `${formattedHours}:${minutes} ${ampm}`;
};

export const formatDateTime12 = (input, locale = 'en-IN') => {
  if (!input) return '';
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return '';
  const dateFormatted = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  const timeFormatted = formatTime12(d);
  return `${dateFormatted}, ${timeFormatted}`;
};
