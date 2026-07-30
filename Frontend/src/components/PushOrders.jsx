import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, ExternalLink, Clock, Package, CheckCircle, Truck, PlayCircle } from 'lucide-react';

const PushOrders = ({ onNavigate }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const response = await axios.get('http://localhost:5002/api/push-orders', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setOrders(response.data);
    } catch (error) {
      console.error('Error fetching push orders', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // In a real app, you would set up a Socket.io listener here to auto-refresh when new orders arrive
    const interval = setInterval(fetchOrders, 15000); // Polling as a fallback for now
    return () => clearInterval(interval);
  }, []);

  const simulateOrder = async () => {
    const platforms = ['Zomato', 'Swiggy', 'UberEats'];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];
    const mockOrder = {
      platform: randomPlatform,
      platformOrderId: `${randomPlatform.substring(0, 3).toUpperCase()}-${Math.floor(Math.random() * 1000000)}`,
      customerDetails: {
        name: 'Mock Customer',
        phone: '9999999999',
        address: '123 Fake Street, City'
      },
      items: [
        { name: 'Paneer Butter Masala', quantity: 2, price: 250 },
        { name: 'Garlic Naan', quantity: 4, price: 40 }
      ],
      totalAmount: 660,
      paymentStatus: 'paid_online'
    };

    try {
      await axios.post('http://localhost:5002/api/push-orders', mockOrder);
      fetchOrders();
    } catch (error) {
      console.error('Error simulating order', error);
      alert('Error creating mock order');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`http://localhost:5002/api/push-orders/${id}/status`, { status }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchOrders();
    } catch (error) {
      console.error('Error updating status', error);
      alert('Error updating status');
    }
  };

  const getPlatformColor = (platform) => {
    switch(platform) {
      case 'Zomato': return 'bg-red-100 text-red-700 border-red-200';
      case 'Swiggy': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'UberEats': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'new': return <span className="flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider animate-pulse"><Clock size={14}/> New Request</span>;
      case 'accepted': return <span className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><CheckCircle size={14}/> Accepted</span>;
      case 'preparing': return <span className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Package size={14}/> Preparing</span>;
      case 'ready': return <span className="flex items-center gap-1 bg-orange-100 text-orange-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Package size={14}/> Ready for Pickup</span>;
      case 'dispatched': return <span className="flex items-center gap-1 bg-green-100 text-green-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"><Truck size={14}/> Dispatched</span>;
      case 'delivered': return <span className="flex items-center gap-1 bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Delivered</span>;
      case 'cancelled': return <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">Cancelled</span>;
      default: return null;
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
            <h1 className="text-2xl font-bold text-gray-800">Aggregator Push Orders</h1>
            <p className="text-sm text-gray-500">Manage incoming orders from Zomato, Swiggy, etc.</p>
          </div>
        </div>
        
        <button 
          onClick={simulateOrder}
          className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg transition-colors font-medium shadow-sm"
        >
          <PlayCircle size={20} className="text-blue-500" /> Simulate Incoming Order
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-full text-center py-10 text-gray-500 bg-white rounded-xl border border-gray-100">
              Waiting for incoming orders...
            </div>
          ) : (
            orders.map(order => (
              <div key={order._id} className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className={`p-4 border-b flex justify-between items-center ${getPlatformColor(order.platform)} bg-opacity-20`}>
                  <div className="font-black text-lg tracking-wide uppercase">
                    {order.platform}
                  </div>
                  <div className="text-xs font-bold bg-white bg-opacity-50 px-2 py-1 rounded">
                    ID: {order.platformOrderId}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-800">{order.customerDetails?.name || 'Customer'}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Ordered at: {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-4 border border-gray-100 flex-1">
                    <div className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider border-b border-gray-200 pb-1">Order Items</div>
                    <ul className="space-y-2">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-800"><span className="font-bold text-gray-600 mr-1">{item.quantity}x</span> {item.name}</span>
                          <span className="font-medium text-gray-600">₹{item.price * item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-between items-center mb-5">
                    <span className="text-xs font-bold text-gray-500 uppercase">Total Amount</span>
                    <span className="text-xl font-black text-gray-800">₹{order.totalAmount}</span>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    {order.status === 'new' && (
                      <>
                        <button onClick={() => updateStatus(order._id, 'cancelled')} className="py-2.5 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-100">Reject</button>
                        <button onClick={() => updateStatus(order._id, 'accepted')} className="py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm">Accept Order</button>
                      </>
                    )}
                    {order.status === 'accepted' && (
                      <button onClick={() => updateStatus(order._id, 'preparing')} className="col-span-2 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm">Start Preparing</button>
                    )}
                    {order.status === 'preparing' && (
                      <button onClick={() => updateStatus(order._id, 'ready')} className="col-span-2 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors shadow-sm">Mark Ready (Food is Cooked)</button>
                    )}
                    {order.status === 'ready' && (
                      <button onClick={() => updateStatus(order._id, 'dispatched')} className="col-span-2 py-2.5 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors shadow-sm">Handover to Rider</button>
                    )}
                    {(order.status === 'dispatched' || order.status === 'delivered' || order.status === 'cancelled') && (
                      <div className="col-span-2 py-2.5 text-sm font-bold text-gray-400 text-center bg-gray-50 rounded-lg border border-gray-100">
                        No further action needed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PushOrders;
