import React from 'react';
import { ArrowRight, Download, Server, CheckCircle2 } from 'lucide-react';

const UpdateModal = ({ isOpen, onInstall }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-slide-up relative"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="bg-blue-100 dark:bg-blue-500/20 p-3 rounded-lg text-blue-600 dark:text-blue-400">
            <Download size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Software Update Available
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              A new version of MS Billing is ready to install
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 bg-white dark:bg-slate-900">
          <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed text-sm">
            We have downloaded the latest version of MS Billing in the background. To apply these updates and ensure optimal performance, the application needs to restart.
          </p>
          
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Performance and stability improvements</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Enhanced security protocols</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Latest features and bug fixes</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={onInstall}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2"
            >
              Restart and Install Update
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="text-right mt-3">
             <p className="text-xs text-slate-400">The restart will take approximately 10 seconds.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateModal;
