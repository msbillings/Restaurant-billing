import api from './axios';

export const getAnalytics = async (month = null, year = null, days = null, date = null, customStart = null, customEnd = null) => {
  let url = '/analytics?';
  if (customStart && customEnd) {
    url += `customStart=${customStart}&customEnd=${customEnd}`;
  } else if (date) {
    url += `date=${date}`;
  } else if (month && year) {
    url += `month=${month}&year=${year}`;
  } else if (days) {
    url += `days=${days}`;
  }
  const response = await api.get(url);
  return response.data;
};

export const getDayBook = async (date = null) => {
  let url = '/analytics/daybook';
  if (date) {
    url += `?date=${date}`;
  }
  const response = await api.get(url);
  return response.data;
};

export const downloadDayBookExcel = async (date, restaurantName) => {
  let url = `/analytics/daybook/export?date=${date}&restaurantName=${encodeURIComponent(restaurantName || 'RESTAURANT')}`;
  
  const response = await api.get(url, {
    responseType: 'blob'
  });

  const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = urlBlob;
  link.setAttribute('download', `DayBook-${date}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(urlBlob);
};

export const downloadDailyReportCSV = async (month = null, year = null, days = null) => {
  let url = '/analytics/download/daily/csv?';
  if (month && year) {
    url += `month=${month}&year=${year}`;
  } else if (days) {
    url += `days=${days}`;
  }

  const response = await api.get(url, {
    responseType: 'blob'
  });

  const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = urlBlob;
  link.setAttribute('download', `daily-report-${month || days || 'current'}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(urlBlob);
};

export const downloadMonthlyReportExcel = async (month = null, year = null, days = null, date = null, customStart = null, customEnd = null, restaurantName = null) => {
  let url = '/analytics/download/monthly/excel?';
  const params = [];
  if (restaurantName) params.push(`restaurantName=${encodeURIComponent(restaurantName)}`);
  if (customStart && customEnd) {
    params.push(`customStart=${customStart}&customEnd=${customEnd}`);
  } else if (date) {
    params.push(`date=${date}`);
  } else if (month && year) {
    params.push(`month=${month}&year=${year}`);
  } else if (days) {
    params.push(`days=${days}`);
  }
  url += params.join('&');

  const response = await api.get(url, {
    responseType: 'blob'
  });

  const fileSuffix = date || (month && year ? `${month}-${year}` : days ? `${days}days` : (customStart && customEnd ? `${customStart}-to-${customEnd}` : 'report'));
  const urlBlob = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = urlBlob;
  link.setAttribute('download', `Analytics-Report-${fileSuffix}.xlsx`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(urlBlob);
};

