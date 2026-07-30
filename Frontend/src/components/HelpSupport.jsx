import React from 'react';
import { ArrowLeft, HelpCircle, Phone, Mail, BookOpen, MessageCircle } from 'lucide-react';

const HelpSupport = ({ onNavigate }) => {
  const faqs = [
    { q: 'How do I add a new Cashier?', a: 'Go to Operations > Admin Dashboard and click "Create New User". Make sure to select the Cashier role.' },
    { q: 'Why is an item not showing on the POS?', a: 'Check Operations > Menu Item On/Off to see if the item was accidentally marked as Out of Stock.' },
    { q: 'How do I connect a thermal printer?', a: 'Go to Set Configuration > Bill / KOT Print and enter your printer\'s IP address or USB configuration.' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => onNavigate('operations')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={24} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <HelpCircle className="text-primary" /> Help & Support
            </h1>
            <p className="text-sm text-gray-500">Access guides, FAQs, and contact support</p>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto pb-6">
        
        {/* Support Channels */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Phone size={32} />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">24/7 Phone Support</h3>
            <p className="text-sm text-gray-500 mb-4">Call us anytime for urgent POS issues.</p>
            <div className="text-xl font-black text-primary">+91 9701800140</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle size={32} />
            </div>
            <h3 className="font-bold text-gray-800 mb-1">WhatsApp Chat</h3>
            <p className="text-sm text-gray-500 mb-4">Chat directly with a support agent.</p>
            <a 
              href="https://wa.me/919701800140?text=Hello%20msbillings%20support%2C%20I%20need%20help%20with%20my%20POS%20system." 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors inline-block"
            >
              Start Chat
            </a>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4 cursor-pointer hover:border-primary transition-colors">
            <Mail className="text-gray-400" size={24} />
            <div>
              <div className="font-bold text-gray-800">Email Support</div>
              <div className="text-sm text-gray-500">support@billingpos.com</div>
            </div>
          </div>
        </div>

        {/* FAQs and Guides */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <BookOpen className="text-primary" size={20} /> Video Tutorials
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-gray-200 hover:border-primary cursor-pointer transition-colors">
                <MonitorPlay size={32} className="mb-2" />
                <span className="text-sm font-bold">Billing Basics</span>
              </div>
              <div className="aspect-video bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 border border-gray-200 hover:border-primary cursor-pointer transition-colors">
                <MonitorPlay size={32} className="mb-2" />
                <span className="text-sm font-bold">Inventory Setup</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-6">Frequently Asked Questions</h3>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <h4 className="font-bold text-gray-800 mb-2">{faq.q}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

// Needed missing icon for video container
import { MonitorPlay } from 'lucide-react';

export default HelpSupport;
