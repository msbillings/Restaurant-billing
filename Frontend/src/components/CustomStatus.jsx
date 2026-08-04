import { useLanguage } from "../context/LanguageContext";import React, { useState } from 'react';
import BackButton from './common/BackButton';
import { ArrowLeft, Save, Plus, Trash2, GripVertical } from 'lucide-react';

const CustomStatus = ({ onNavigate }) => {const { t } = useLanguage();
  const [statuses, setStatuses] = useState([
  { id: 1, name: 'Pending', color: 'bg-yellow-500', isDeletable: false },
  { id: 2, name: 'Preparing', color: 'bg-orange-500', isDeletable: false },
  { id: 3, name: 'Ready', color: 'bg-green-500', isDeletable: false }]
  );

  const [newStatus, setNewStatus] = useState('');
  const [selectedColor, setSelectedColor] = useState('bg-blue-500');

  const colorOptions = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'];


  const addStatus = () => {
    if (newStatus.trim() && statuses.length < 6) {
      setStatuses([...statuses, { id: Date.now(), name: newStatus.trim(), color: selectedColor, isDeletable: true }]);
      setNewStatus('');
    }
  };

  const removeStatus = (id) => {
    setStatuses(statuses.filter((s) => s.id !== id));
  };

  const handleSave = () => {
    // In a real app, this would save to the Setting collection in DB and update the KDS logic.
    alert('Workflow statuses saved successfully! KDS screens will now use this workflow.');
    onNavigate('operations');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div className="flex items-center gap-4">
          <BackButton onClick={onGoBack} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{t("Custom Order Status (KDS Workflow)")}</h1>
            <p className="text-sm text-gray-500">{t("Define the exact stages a kitchen order goes through")}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-primary-dark transition-colors shadow-sm">
          
          <Save size={18} />{t("Save Workflow")}
        </button>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        
        <div className="mb-8">
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">{t("Add Custom Stage")}</h2>
          <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex-1">
              <input
                type="text" placeholder={t("e.g. Plating, Quality Check")}

                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-primary"
                maxLength={20} />
              
            </div>
            <div className="flex gap-2">
              {colorOptions.map((color) =>
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-8 h-8 rounded-full ${color} ${selectedColor === color ? 'ring-2 ring-offset-2 ring-gray-800' : ''}`} />

              )}
            </div>
            <button
              onClick={addStatus}
              disabled={!newStatus.trim() || statuses.length >= 6}
              className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
              
              <Plus size={20} />
            </button>
          </div>
          {statuses.length >= 6 && <p className="text-xs text-red-500 mt-2">{t("Maximum 6 stages allowed in KDS view.")}</p>}
        </div>

        <div>
          <h2 className="text-sm font-bold text-gray-700 uppercase mb-4">{t("Current Workflow pipeline")}</h2>
          <div className="space-y-3">
            {statuses.map((status, index) =>
            <div key={status.id} className="flex items-center gap-4 bg-white border border-gray-200 p-3 rounded-lg shadow-sm">
                <GripVertical size={20} className="text-gray-400 cursor-move" />
                <div className="flex items-center gap-3 w-16">
                  <span className="text-sm font-bold text-gray-400">{t("Step")}{index + 1}</span>
                </div>
                <div className={`w-3 h-3 rounded-full ${status.color}`}></div>
                <div className="flex-1 font-bold text-gray-800">{status.name}</div>
                {status.isDeletable ?
              <button onClick={() => removeStatus(status.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button> :

              <span className="text-xs font-bold text-gray-400 px-3 py-1 bg-gray-100 rounded uppercase">{t("Core Stage")}</span>
              }
              </div>
            )}
          </div>
        </div>

      </div>
    </div>);

};

export default CustomStatus;