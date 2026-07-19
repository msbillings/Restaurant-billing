import React, { useState } from 'react';
import { X, BookOpen, Layers, Users, Zap, FileText, ChevronRight, BarChart3, Settings } from 'lucide-react';

const UserManualModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('getting-started');

  if (!isOpen) return null;

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: <Zap size={18} /> },
    { id: 'billing', label: 'Billing & Orders', icon: <FileText size={18} /> },
    { id: 'floor', label: 'Floor Management', icon: <Layers size={18} /> },
    { id: 'staff', label: 'Staff & Attendance', icon: <Users size={18} /> },
    { id: 'reports', label: 'Reports & Analytics', icon: <BarChart3 size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-6xl h-full max-h-[85vh] rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up flex flex-col relative"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shrink-0 flex items-center justify-between relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-xl backdrop-blur-md">
              <BookOpen size={28} className="text-white drop-shadow-md" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">MS Billing Documentation</h2>
              <p className="text-blue-100 text-sm font-medium">Comprehensive guide to managing your restaurant</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="relative z-10 p-2 text-white/80 hover:text-white hover:bg-black/20 rounded-full transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-slate-50 dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-800 overflow-y-auto shrink-0 p-4">
            <div className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {activeTab === tab.id && <ChevronRight size={16} className="ml-auto opacity-70" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content Pane */}
          <div className="flex-1 overflow-y-auto p-8 lg:p-12 bg-white dark:bg-slate-900 custom-scrollbar">
            {activeTab === 'getting-started' && (
              <div className="max-w-3xl animate-fade-in">
                <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Welcome to MS Billing</h1>
                <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                  MS Billing is a next-generation Restaurant Management POS designed for speed, accuracy, and ease of use. Whether you are running a small cafe or a multi-floor fine dining restaurant, this guide will help you get the most out of your terminal.
                </p>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6 mb-10">
                  <h3 className="font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2 mb-2">
                    <Zap size={20} className="text-blue-600 dark:text-blue-400" /> Quick Setup
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300">
                    <li>Create your spaces (Tables, Cabins, Sofas) in Floor Management.</li>
                    <li>Add your categories and food items in the Menu Management.</li>
                    <li>Register your staff members with Face AI for seamless attendance.</li>
                    <li>You are ready to start taking orders!</li>
                  </ol>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 border-b border-slate-200 dark:border-slate-800 pb-2">Keyboard Shortcuts</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">Zoom In</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">Ctrl + =</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">Zoom Out</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">Ctrl + -</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">Reset Zoom</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">Ctrl + 0</kbd>
                  </div>
                  <div className="p-4 border border-slate-200 dark:border-slate-800 rounded-xl flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
                    <span className="text-slate-700 dark:text-slate-300">Full Screen</span>
                    <kbd className="px-3 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono shadow-sm">F11</kbd>
                  </div>
                </div>
              </div>
            )}

            {activeTab !== 'getting-started' && (
              <div className="max-w-3xl animate-fade-in flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 mb-6">
                  {tabs.find(t => t.id === activeTab)?.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                  This section of the documentation is currently being updated by the MS Tech Hive team to include the latest features of version 6.0.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>
    </div>
  );
};

export default UserManualModal;
