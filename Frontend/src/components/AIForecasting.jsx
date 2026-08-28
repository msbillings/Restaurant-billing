import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { ArrowLeft, LineChart as LineChartIcon, TrendingUp, Calendar, AlertTriangle, ChevronRight, BarChart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const SalesForecasting = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [loading, setLoading] = useState(true);

  const [forecastData, setForecastData] = useState([]);
  const [prepSuggestions, setPrepSuggestions] = useState([]);
  const [expectedSales, setExpectedSales] = useState(0);
  const [growthPercentage, setGrowthPercentage] = useState("+0%");
  
  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
        const response = await axios.get(`${getApiUrl()}/analytics/forecast`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.data) {
          setForecastData(response.data.forecastData);
          setPrepSuggestions(response.data.prepSuggestions);
          setExpectedSales(response.data.expectedSales);
          setGrowthPercentage(response.data.growthPercentage);
        }
      } catch (err) {
        console.error('Failed to fetch AI forecast:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchForecast();
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50 p-1.5 sm:p-2.5 md:p-3 overflow-y-auto w-full">
      <div className="flex items-center justify-between mb-2 sm:mb-2.5 shrink-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
              <LineChartIcon className="text-primary shrink-0" size={22} />
              <span>{t("Sales Forecasting")}</span>
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">{t("Predictive analytics for sales and kitchen prep")}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        {loading ?
        <div className="h-full flex flex-col items-center justify-center text-primary">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mb-4"></div>
            <h2 className="text-xl font-bold text-gray-800">{t("Analyzing Historical Data...")}</h2>
            <p className="text-gray-500 mt-2 text-sm">{t("Generating predictive models for this weekend")}</p>
          </div> :

        <div className="max-w-5xl mx-auto w-full space-y-6">
            
            {/* Summary Banner */}
            <div className="bg-linear-to-r from-blue-900 to-indigo-900 rounded-xl p-6 text-white shadow-lg flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-200 text-sm font-bold uppercase tracking-wider mb-2">
                  <Calendar size={16} />{t("Forecast for Tomorrow")}
              </div>
                <h2 className="text-3xl font-black mb-1">{t("₹")}{expectedSales.toLocaleString()} {t("Expected Sales")}</h2>
                <p className="text-blue-200 text-sm">{t("This is")} <span className="text-green-400 font-bold">{growthPercentage}</span> {t("than your average based on historical data.")}</p>
              </div>
              <div className="hidden md:flex items-center justify-center w-24 h-24 bg-white/10 rounded-full">
                 <BarChart size={48} className="text-white opacity-80" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <TrendingUp className="text-primary" size={20} />{t("Revenue Forecast (7 Days)")}
              </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Area type="monotone" dataKey="predicted" stroke="#8b5cf6" strokeWidth={3} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorPredicted)" name="Predicted" />
                      <Line type="monotone" dataKey="actual" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="Actual Sales" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Prep Suggestions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={20} />{t("Smart Kitchen Prep")}
              </h3>
                <p className="text-sm text-gray-500 mb-4">{t("Based on tomorrow's predicted demand, prepare the following items tonight:")}</p>
                
                <div className="space-y-4">
                  {prepSuggestions.map((prep, idx) =>
                <div key={idx} className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-gray-800">{prep.item}</span>
                        <span className="text-sm font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded">{prep.amount}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-snug">{prep.reason}</p>
                    </div>
                )}
                </div>
                
                <button className="w-full mt-6 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-lg transition-colors">{t("Send to KDS")}
                <ChevronRight size={16} />
                </button>
              </div>

            </div>
          </div>
        }
      </div>
    </div>);

};

export default SalesForecasting;