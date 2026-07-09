import React, { useState } from 'react';
import axios from 'axios';
import { Shield, CheckCircle, CreditCard, UtensilsCrossed } from 'lucide-react';

const Checkout = () => {
  const [formData, setFormData] = useState({ restaurantName: '', email: '' });
  const [planType, setPlanType] = useState('Yearly');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const plans = {
    Monthly: { price: 2000, desc: 'Perfect for getting started' },
    Yearly: { price: 20000, desc: 'Best value for restaurants' },
    Lifetime: { price: 100000, desc: 'Pay once, use forever' }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!formData.restaurantName || !formData.email) return alert("Please fill all details");

    setLoading(true);
    const res = await loadRazorpayScript();

    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setLoading(false);
      return;
    }

    try {
      const amount = plans[planType].price;
      // Create Order on Backend
      const orderRes = await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/payment/create-order', {
        amount,
        restaurantName: formData.restaurantName,
        email: formData.email,
        planType
      });

      const options = {
        key: 'YOUR_RAZORPAY_KEY_ID', // Replaced dynamically or from env in real prod
        amount: orderRes.data.amount,
        currency: orderRes.data.currency,
        name: 'mstechhive',
        description: `msbilling - ${planType} License`,
        image: 'https://mstechhive.com/logo.png', // Replace with actual logo
        order_id: orderRes.data.id,
        handler: async function (response) {
          try {
            // Verify Payment on Backend
            const verifyRes = await axios.post('https://restaurant-superadmin-api-maheer.vercel.app/api/payment/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              restaurantName: formData.restaurantName,
              email: formData.email,
              amount,
              planType
            });

            if (verifyRes.data.success) {
              setSuccess(true);
            }
          } catch (error) {
            alert('Payment verification failed!');
          }
        },
        prefill: {
          name: formData.restaurantName,
          email: formData.email,
        },
        theme: {
          color: '#ff5c35'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error(error);
      alert('Error initiating payment');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center text-white">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-gray-300 mb-6">
            Your license key and invoice have been emailed to <strong>{formData.email}</strong>.
          </p>
          <p className="text-sm text-gray-500">
            Please check your spam folder if you don't see it within 5 minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans selection:bg-primary/30 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="mb-8 text-center">
        <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(255,92,53,0.3)] mx-auto mb-4">
          <UtensilsCrossed className="text-primary w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tight mb-2">Get msbilling for your Restaurant</h1>
        <p className="text-gray-400">Streamline your operations with our enterprise-grade billing system.</p>
      </div>

      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Plan Selection */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold mb-4">Select your plan</h3>
          {Object.entries(plans).map(([type, details]) => (
            <div 
              key={type}
              onClick={() => setPlanType(type)}
              className={`p-6 rounded-2xl border-2 cursor-pointer transition-all ${planType === type ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-surface hover:border-gray-500'}`}
            >
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-xl font-bold">{type} Plan</h4>
                <span className="text-2xl font-black">₹{details.price.toLocaleString()}</span>
              </div>
              <p className="text-gray-400 text-sm">{details.desc}</p>
            </div>
          ))}

          <div className="mt-8 bg-surface p-6 rounded-2xl border border-border">
            <h4 className="font-bold mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-green-500"/> What's included?</h4>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex items-center gap-2">✓ Unlimited Menu Items</li>
              <li className="flex items-center gap-2">✓ KOT Printing Support</li>
              <li className="flex items-center gap-2">✓ Analytics & Reports</li>
              <li className="flex items-center gap-2">✓ Hardware Locked License for Security</li>
            </ul>
          </div>
        </div>

        {/* Right: Checkout Form */}
        <div className="bg-surface p-8 rounded-2xl border border-border h-fit sticky top-8">
          <h3 className="text-xl font-bold mb-6">Payment Details</h3>
          <form onSubmit={handlePayment} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Restaurant Name</label>
              <input 
                type="text" 
                required
                value={formData.restaurantName}
                onChange={e => setFormData({...formData, restaurantName: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="E.g. The Grand Cafe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email Address (For License Key)</label>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-background border border-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="owner@restaurant.com"
              />
            </div>

            <div className="border-t border-border pt-6 mt-6">
              <div className="flex justify-between items-center mb-4 text-lg">
                <span className="font-medium text-gray-300">Total to pay</span>
                <span className="font-black text-2xl">₹{plans[planType].price.toLocaleString()}</span>
              </div>
              
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Processing...' : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    Pay Securely with Razorpay
                  </>
                )}
              </button>
              <p className="text-center text-xs text-gray-500 mt-4">
                Cards, UPI (GPay, PhonePe), and Netbanking accepted.
              </p>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default Checkout;
