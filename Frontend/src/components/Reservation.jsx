import { getApiUrl } from "../config.js";
import { useLanguage } from "../context/LanguageContext";import React, { useState, useEffect } from 'react';
import BackButton from './common/BackButton';
import axios from 'axios';
import { Plus, ArrowLeft, Calendar, Clock, Users, Phone, Check, X, MapPin } from 'lucide-react';

const Reservation = ({ onNavigate, onGoBack }) => {const { t } = useLanguage();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableSpaces, setAvailableSpaces] = useState([]);

  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    endDate: new Date().toISOString().split('T')[0],
    endTime: '21:00',
    guests: 2,
    tableType: 'Any',
    specialRequests: ''
  });

  const fetchReservations = async () => {
    try {
      const response = await axios.get(`${getApiUrl()}/reservations`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setReservations(response.data);
    } catch (error) {
      console.error('Error fetching reservations', error);
      alert('DEBUG ERROR: ' + error.response?.status + ' - ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();

    // Fetch spaces from local storage
    const saved = localStorage.getItem('msbillings_spaces');
    let parsed = [];
    if (saved) {
      parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        parsed = [{
          id: 'f-default',
          name: 'Ground Floor',
          tables: parsed.tables || [],
          cabins: parsed.cabins || [],
          sofas: parsed.sofas || []
        }];
      }
    } else {
      parsed = [{
        id: 'f-1',
        name: 'Ground Floor',
        tables: [{ id: 't1', name: 'Table 1', type: 'table' }, { id: 't2', name: 'Table 2', type: 'table' }, { id: 't3', name: 'Table 3', type: 'table' }],
        cabins: [{ id: 'c1', name: 'Cabin 1', type: 'cabin' }, { id: 'c2', name: 'Cabin 2', type: 'cabin' }],
        sofas: [{ id: 's1', name: 'Sofa-01', type: 'sofa' }]
      }];
    }

    const formattedFloors = [];
    parsed.forEach((floor) => {
      const hasTables = floor.tables && floor.tables.length > 0;
      const hasCabins = floor.cabins && floor.cabins.length > 0;
      const hasSofas = floor.sofas && floor.sofas.length > 0;

      const spaces = [];
      ['tables', 'cabins', 'sofas', 'spaces'].forEach((category) => {
        if (floor[category]) {
          floor[category].forEach((space) => {
            if (space.name) {
              spaces.push({ name: space.name, value: `${floor.name} - ${space.name}` });
            }
          });
        }
      });

      formattedFloors.push({
        name: floor.name,
        hasTables,
        hasCabins,
        hasSofas,
        spaces
      });
    });
    setAvailableSpaces(formattedFloors);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${getApiUrl()}/reservations`, formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setIsModalOpen(false);
      setFormData({
        customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0],
        time: '19:00', endDate: new Date().toISOString().split('T')[0], endTime: '21:00', guests: 2, tableType: 'Any', specialRequests: ''
      });
      fetchReservations();
    } catch (error) {
      console.error('Error creating reservation', error);
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      if (error.response?.status === 401 || error.response?.status === 403 || errorMessage.toLowerCase().includes('token')) {
        alert('Your session has expired or is invalid: ' + errorMessage);
      } else {
        alert('Error creating reservation: ' + errorMessage);
      }
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${getApiUrl()}/reservations/${id}`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      fetchReservations();
    } catch (error) {
      console.error('Error updating status', error);
      alert('Error updating status');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Table Reservations")}</h1>
            <p className="text-sm text-gray-500">{t("Manage upcoming bookings")}</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm">
          
          <Plus size={20} />{t("New Reservation")}
        </button>
      </div>

      {loading ?
      <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div> :

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.length === 0 ?
        <div className="col-span-full text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">{t("No upcoming reservations.")}

        </div> :

        reservations.map((res) =>
        <div key={res._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{res.customerName}</h3>
                    <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
                      <Phone size={14} /> {res.phoneNumber}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider
                    ${res.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                    ${res.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : ''}
                    ${res.status === 'seated' ? 'bg-green-100 text-green-700' : ''}
                    ${res.status === 'completed' ? 'bg-gray-100 text-gray-700' : ''}
                    ${res.status === 'cancelled' || res.status === 'no-show' ? 'bg-red-100 text-red-700' : ''}
                  `}>
                    {res.status}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-y-3 mb-4 flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="font-medium">{new Date(res.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Clock size={16} className="text-gray-400" />
                    <span className="font-medium">{res.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Users size={16} className="text-gray-400" />
                    <span className="font-medium">{res.guests}{t("Pax")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={16} className="text-gray-400" />
                    <span className="font-medium">{res.tableType}</span>
                  </div>
                </div>

                {res.specialRequests &&
          <div className="bg-orange-50 text-orange-800 p-3 rounded-lg text-sm mb-4">
                    <span className="font-bold">{t("Note:")}</span>{res.specialRequests}
                  </div>
          }

                {(res.status === 'pending' || res.status === 'confirmed' || res.status === 'seated') &&
          <div className="flex gap-2 mt-auto border-t border-gray-100 pt-4">
                    {res.status === 'pending' &&
            <button
              onClick={() => updateStatus(res._id, 'confirmed')}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">{t("Confirm")}


            </button>
            }
                    {res.status === 'confirmed' &&
            <button
              onClick={() => updateStatus(res._id, 'seated')}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors">{t("Mark Seated")}


            </button>
            }
                    {res.status === 'seated' &&
            <button
              onClick={() => updateStatus(res._id, 'completed')}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors">{t("Finish")}


            </button>
            }
                    <button
              onClick={() => updateStatus(res._id, 'cancelled')}
              className="flex-1 py-2 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors">{t("Cancel")}


            </button>
                  </div>
          }
              </div>
        )
        }
        </div>
      }

      {/* New Reservation Modal */}
      {isModalOpen &&
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">{t("New Reservation")}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Customer Name")}</label>
                  <input
                  type="text" required
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder={t("John Doe")} />

                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Phone Number")}</label>
                  <input
                  type="tel" required
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') })}
                  pattern="[0-9]{10}"
                  maxLength="10" title={t("Please enter a valid 10-digit mobile number")}

                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  placeholder="9876543210" />
                
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Start Date")}</label>
                  <input
                  type="date" required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Start Time")}</label>
                  <input
                  type="time" required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("End Date")}</label>
                  <input
                  type="date" required
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("End Time")}</label>
                  <input
                  type="time" required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Number of Guests")}</label>
                  <input
                  type="number" required min="1"
                  value={formData.guests}
                  onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t("Table Preference")}</label>
                  <select
                  value={formData.tableType}
                  onChange={(e) => setFormData({ ...formData, tableType: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white">
                  
                    <option value="Any Space">{t("Any Space")}</option>
                    {availableSpaces.map((floor) =>
                  <optgroup key={floor.name} label={`--- ${floor.name} ---`}>
                        <option value={`Entire ${floor.name}`}>{t("Entire Floor")}</option>
                        {floor.hasTables && <option value={`All Tables - ${floor.name}`}>{t("All Tables")}</option>}
                        {floor.hasCabins && <option value={`All Cabins - ${floor.name}`}>{t("All Cabins")}</option>}
                        {floor.hasSofas && <option value={`All Sofas - ${floor.name}`}>{t("All Sofas")}</option>}
                        {floor.spaces.map((s) =>
                    <option key={s.value} value={s.value}>{s.name}</option>
                    )}
                      </optgroup>
                  )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("Special Requests (Optional)")}</label>
                <textarea
                value={formData.specialRequests}
                onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                rows="2" placeholder={t("e.g., Birthday celebration, high chair needed")} />

              
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">{t("Cancel")}</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">{t("Book Table")}</button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>);

};

export default Reservation;