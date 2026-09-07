/**
 * Timezone utilities for Indian Standard Time (IST - UTC+05:30)
 * Ensures 100% accurate date and time boundaries across aggregations and reports.
 */

export const IST_TIMEZONE = '+05:30';
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms

/**
 * Returns UTC Date objects for start and end of an IST day.
 * @param {string|Date} [input] - 'YYYY-MM-DD' string, Date object, or undefined for today
 * @returns {{ startDate: Date, endDate: Date }}
 */
export const getISTDayRange = (input) => {
  let y, m, d;
  if (!input) {
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    y = nowIST.getUTCFullYear();
    m = nowIST.getUTCMonth();
    d = nowIST.getUTCDate();
  } else if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    const parts = input.trim().split('-').map(Number);
    y = parts[0];
    m = parts[1] - 1;
    d = parts[2];
  } else {
    const dateObj = new Date(input);
    if (isNaN(dateObj.getTime())) {
      const nowIST = new Date(Date.now() + IST_OFFSET_MS);
      y = nowIST.getUTCFullYear();
      m = nowIST.getUTCMonth();
      d = nowIST.getUTCDate();
    } else {
      const dateIST = new Date(dateObj.getTime() + IST_OFFSET_MS);
      y = dateIST.getUTCFullYear();
      m = dateIST.getUTCMonth();
      d = dateIST.getUTCDate();
    }
  }

  const startDate = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MS);
  const endDate = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MS);
  return { startDate, endDate };
};

/**
 * Returns UTC Date objects for start and end of an IST month.
 * @param {number} year - e.g. 2026
 * @param {number} month - 1-12
 * @returns {{ startDate: Date, endDate: Date }}
 */
export const getISTMonthRange = (year, month) => {
  const y = parseInt(year);
  const m = parseInt(month) - 1;
  const startDate = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
  const lastDay = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  const endDate = new Date(lastDay.getTime() - IST_OFFSET_MS);
  return { startDate, endDate };
};
