import React from 'react';
import { ArrowLeft, Clock, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react';

const ServiceRenewal = ({ onNavigate }) => {
  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="text-primary" /> Service Renewal
            </h1>
            <p className="text-sm text-gray-500">Manage your POS software subscription</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full space-y-6">
        
        {/* Current Plan Status */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-lg border border-gray-700 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-bold uppercase tracking-wider">
                  Active Subscription
                </span>
              </div>
              <h2 className="text-3xl font-black mb-1">Enterprise POS License</h2>
              <p className="text-gray-400">Includes Multi-outlet support, KDS, and Cloud Sync</p>
            </div>
            <div className="text-left md:text-right">
              <div className="text-sm text-gray-400 uppercase font-bold tracking-widest mb-1">Expires In</div>
              <div className="text-4xl font-black text-amber-400">342 Days</div>
              <div className="text-sm text-gray-500 mt-1">July 7, 2027</div>
            </div>
          </div>
        </div>

        {/* Upgrade / Renew Options */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-6">Subscription Actions</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <CreditCard size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-primary transition-colors">Renew License</div>
                  <div className="text-sm text-gray-500">Pay for another year to avoid interruption</div>
                </div>
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-primary transition-colors" />
            </button>

            <button className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all group text-left">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <div className="font-bold text-gray-800 group-hover:text-primary transition-colors">Buy Add-ons</div>
                  <div className="text-sm text-gray-500">Add Captain App, Delivery API, or Loyalty</div>
                </div>
              </div>
              <ChevronRight className="text-gray-400 group-hover:text-primary transition-colors" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ServiceRenewal;
