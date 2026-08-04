import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import { X, BookOpen, Layers, Users, Zap, FileText, ChevronRight, BarChart3, Settings } from 'lucide-react';

const UserManualModal = ({ isOpen, onClose }) => {const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('getting-started');

  if (!isOpen) return null;

  const tabs = [
  { id: 'getting-started', label: 'Getting Started', icon: <Zap size={18} /> },
  { id: 'billing', label: 'Billing & Orders', icon: <FileText size={18} /> },
  { id: 'floor', label: 'Floor Management', icon: <Layers size={18} /> },
  { id: 'staff', label: 'Staff & Attendance', icon: <Users size={18} /> },
  { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={18} /> }];


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up flex flex-col relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0 flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <BookOpen size={28} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{t("MS Billing Documentation")}</h2>
              <p className="text-blue-100 text-sm font-medium">{t("Comprehensive guide to managing your restaurant")}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative z-10 p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full transition-all">
            
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 overflow-y-auto shrink-0 p-4">
            <div className="space-y-1">
              {tabs.map((tab) =>
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ?
                'bg-blue-600 text-white shadow-md' :
                'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`
                }>
                
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight size={16} className="ml-auto opacity-70" />}
                </button>
              )}
            </div>
          </div>

          {/* Main Content Pane */}
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-white dark:bg-slate-900 custom-scrollbar">
            {activeTab === 'getting-started' &&
            <div className="max-w-3xl animate-fade-in">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4">{t("Welcome to MS Billing")}</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">{t("MS Billing is a next-generation Restaurant Management POS designed for speed, accuracy, and ease of use. Whether you are running a small cafe or a multi-floor fine dining restaurant, this guide will help you get the most out of your terminal.")}

              </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-10">
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
                    <Zap size={20} className="text-blue-600 dark:text-blue-400" />{t("Quick Setup")}
                </h3>
                  <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300">
                    <li>{t("Create your spaces (Tables, Cabins, Sofas) in Floor Management.")}</li>
                    <li>{t("Add your categories and food items in the Menu Management.")}</li>
                    <li>{t("Register your staff members with Face AI for seamless attendance.")}</li>
                    <li>{t("You are ready to start taking orders!")}</li>
                  </ol>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">{t("Keyboard Shortcuts")}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">{t("Zoom In")}</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">{t("Ctrl + =")}</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">{t("Zoom Out")}</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">{t("Ctrl + -")}</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">{t("Reset Zoom")}</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">{t("Ctrl + 0")}</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">{t("Full Screen")}</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">{t("F11")}</kbd>
                  </div>
                </div>
              </div>
            }

            {activeTab === 'billing' &&
            <div className="max-w-3xl animate-fade-in">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">{t("Billing & Orders")}</h2>
                
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-3">{t("Taking an Order")}</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">{t("To take a new order, navigate to the")}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("New Order")}</span>{t("tab.\n                      Select the items from the menu, adjust quantities using the + and - buttons, and click")}
                    <span className="font-semibold text-orange-500">{t("Save KOT")}</span>{t("to send it to the kitchen.")}
                  </p>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-500 dark:text-slate-400">
                      <li>{t("Use the Search Bar to quickly find items by name.")}</li>
                      <li>{t("Filter items by clicking on the category tabs on the left.")}</li>
                      <li>{t("Click on a cart item to add special instructions (e.g., \"Less spicy\").")}</li>
                    </ul>
                  </div>

                  <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mb-3">{t("Settling a Bill")}</h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{t("Go to the")}
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{t("Active Orders")}</span>{t("tab to see all unpaid tables.\n                      Click on a table, review the KOTs, apply any discounts, select the Payment Method (Cash, Card, UPI), and click")}
                    <span className="font-semibold text-emerald-500">{t("Settle Bill")}</span>.
                    </p>
                  </div>
                </div>
              </div>
            }

            {activeTab === 'floor' &&
            <div className="max-w-3xl animate-fade-in">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">{t("Floor Management")}</h2>
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 mb-6">
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{t("The Floor Management screen is your bird's-eye view of the restaurant. Colors indicate table status:")}

                </p>
                  <div className="flex flex-wrap gap-4 mt-6">
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-emerald-500"></div><span className="text-sm font-medium">{t("Available")}</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-500"></div><span className="text-sm font-medium">{t("Occupied")}</span></div>
                    <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500"></div><span className="text-sm font-medium">{t("Bill Printed")}</span></div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-3">{t("Managing Spaces")}</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-4">{t("As an Admin, you can add new Spaces (like \"AC Section\", \"Rooftop\") and configure how many tables belong to each space from the Settings menu.")}</p>
              </div>
            }

            {activeTab === 'staff' &&
            <div className="max-w-3xl animate-fade-in">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">{t("Staff & AI Attendance")}</h2>
                <div className="bg-white dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <h3 className="text-xl font-bold text-purple-600 dark:text-purple-400 mb-3">{t("Facial Recognition Setup")}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-4">{t("MS Billing features a state-of-the-art AI Face Recognition system for staff clock-ins to prevent buddy-punching.")}

                </p>
                  <ol className="list-decimal list-inside space-y-3 text-slate-700 dark:text-slate-300">
                    <li>{t("Go to")}<span className="font-semibold text-blue-500">{t("Staff HR")}</span>.</li>
                    <li>{t("Click")}<span className="font-semibold text-emerald-500">{t("Add Staff")}</span>{t("and fill in their details (Name, Role, PIN).")}</li>
                    <li>{t("Click the Camera icon next to their profile to capture their facial biometrics.")}</li>
                    <li>{t("They can now use the")}<strong>{t("AI Clock-In")}</strong>{t("button on the login screen to start their shift!")}</li>
                  </ol>
                </div>
              </div>
            }

            {activeTab === 'reports' &&
            <div className="max-w-3xl animate-fade-in">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">{t("Reports & Analytics")}</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6 text-lg">{t("Make data-driven decisions with real-time insights into your business performance.")}

              </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">{t("DayBook")}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t("View daily cash flow, total sales, expenses, and net profit at a glance.")}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/30 p-5 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">{t("Analytics Dashboard")}</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t("Deep dive into Top Selling Items, Revenue by Time, and Payment Methods breakdowns.")}</p>
                  </div>
                </div>
              </div>
            }

            {activeTab === 'settings' &&
            <div className="max-w-3xl animate-fade-in">
                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-6">{t("System Settings")}</h2>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-2xl border border-orange-200 dark:border-orange-800/50">
                  <h3 className="text-xl font-bold text-orange-700 dark:text-orange-400 mb-3">{t("Admin Only Access")}</h3>
                  <p className="text-slate-700 dark:text-slate-300 mb-4">{t("The Settings panel controls the core configuration of your restaurant. From here you can:")}

                </p>
                  <ul className="list-disc list-inside space-y-2 text-slate-600 dark:text-slate-400">
                    <li>{t("Change the Restaurant Name, Address, and FSSAI number for Bill Printing.")}</li>
                    <li>{t("Configure Tax Rates (GST, CGST, SGST).")}</li>
                    <li>{t("Add/Remove Printers for KOTs and Bills.")}</li>
                    <li>{t("Manage License and Cloud Sync Status.")}</li>
                  </ul>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>);

};

export default UserManualModal;