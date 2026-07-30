import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, ArrowLeft, Calendar, Clock, Users, Phone, Check, X, MapPin } from 'lucide-react';

const Reservation = ({ onNavigate }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    customerName: '',
    phoneNumber: '',
    date: new Date().toISOString().split('T')[0],
    time: '19:00',
    guests: 2,
    tableType: 'Any',
    specialRequests: ''
  });

  const fetchReservations = async () => {
    try {
      const response = await axios.get('http://localhost:5002/api/reservations', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setReservations(response.data);
    } catch (error) {
      console.error('Error fetching reservations', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5002/api/reservations', formData, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setIsModalOpen(false);
      setFormData({
        customerName: '', phoneNumber: '', date: new Date().toISOString().split('T')[0], 
        time: '19:00', guests: 2, tableType: 'Any', specialRequests: ''
      });
      fetchReservations();
    } catch (error) {
      console.error('Error creating reservation', error);
      alert('Error creating reservation');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5002/api/reservations/${id}`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Table Reservations</h1>
            <p className="text-sm text-gray-500">Manage upcoming bookings</p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
        >
          <Plus size={20} /> New Reservation
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
              No upcoming reservations.
            </div>
          ) : (
            reservations.map(res => (
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
                    ${(res.status === 'cancelled' || res.status === 'no-show') ? 'bg-red-100 text-red-700' : ''}
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
                    <span className="font-medium">{res.guests} Pax</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <MapPin size={16} className="text-gray-400" />
                    <span className="font-medium">{res.tableType}</span>
                  </div>
                </div>

                {res.specialRequests && (
                  <div className="bg-orange-50 text-orange-800 p-3 rounded-lg text-sm mb-4">
                    <span className="font-bold">Note: </span>{res.specialRequests}
                  </div>
                )}

                {(res.status === 'pending' || res.status === 'confirmed') && (
                  <div className="flex gap-2 mt-auto border-t border-gray-100 pt-4">
                    {res.status === 'pending' && (
                      <button 
                        onClick={() => updateStatus(res._id, 'confirmed')}
                        className="flex-1 py-2 text-sm font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                      >
                        Confirm
                      </button>
                    )}
                    {res.status === 'confirmed' && (
                      <button 
                        onClick={() => updateStatus(res._id, 'seated')}
                        className="flex-1 py-2 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 transition-colors"
                      >
                        Mark Seated
                      </button>
                    )}
                    <button 
                      onClick={() => updateStatus(res._id, 'cancelled')}
                      className="flex-1 py-2 text-sm font-medium rounded-lg text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* New Reservation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">New Reservation</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
                  <input 
                    type="text" required
                    value={formData.customerName}
                    onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input 
                    type="tel" required
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                    placeholder="9876543210"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input 
                    type="date" required
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <input 
                    type="time" required
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Guests</label>
                  <input 
                    type="number" required min="1"
                    value={formData.guests}
                    onChange={(e) => setFormData({...formData, guests: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table Preference</label>
                  <select 
                    value={formData.tableType}
                    onChange={(e) => setFormData({...formData, tableType: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none bg-white"
                  >
                    <option value="Any">Any</option>
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests (Optional)</label>
                <textarea 
                  value={formData.specialRequests}
                  onChange={(e) => setFormData({...formData, specialRequests: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
                  rows="2"
                  placeholder="e.g., Birthday celebration, high chair needed"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors">Cancel</button>
                <button type="submit" className="flex-1 py-3 text-white bg-primary hover:bg-primary-hover rounded-xl font-medium shadow-lg shadow-primary/30 transition-all">Book Table</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reservation;
