import React, { useState, useEffect } from 'react';
import { useLanguage } from "../context/LanguageContext";
import { Users, Plus, Edit2, Trash2, Clock, CheckCircle, X, Camera, Image as ImageIcon } from 'lucide-react';
import { getStaff, addStaff, updateStaff, deleteStaff } from '../api/staff';
import Toast from './Toast';
import FaceRegistration from './FaceRegistration';
import BackButton from './common/BackButton';
import { formatTime12 } from '../utils/timeFormat';

const StaffManagement = ({ onNavigate, onGoBack }) => {
  const { t } = useLanguage();

  // Instant Synchronous Cache Peek (0ms paint)
  const [staff, setStaff] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_staff_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_staff_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return false;
        }
      }
    } catch (e) {}
    return true;
  });

  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [registeringFace, setRegisteringFace] = useState(null);
  const [viewingLog, setViewingLog] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    role: 'Waiter',
    phone: '',
    pin: '',
    baseSalary: '',
    salaryType: 'Monthly'
  });

  const fetchStaff = async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const data = await getStaff();
      const safeData = Array.isArray(data) ? data : [];
      setStaff(safeData);
      try {
        localStorage.setItem('cached_staff_data', JSON.stringify(safeData));
      } catch (e) {}
    } catch (err) {
      console.error('Failed to load staff:', err);
      setToast({ message: 'Failed to load staff', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // If cached data is present, do a background refresh with dynamic top loader; otherwise show skeleton
    const hasCache = staff && staff.length > 0;
    fetchStaff(hasCache);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Check if the pin is already assigned to another staff member
    const targetPin = formData.pin?.trim();
    if (targetPin) {
      const isPinDuplicate = staff.some(s => s.pin === targetPin && s._id !== editingStaff?._id);
      if (isPinDuplicate) {
        setToast({ message: 'This PIN is already assigned to another staff member. Please use a unique PIN.', type: 'error' });
        return;
      }
    }

    try {
      if (editingStaff) {
        await updateStaff(editingStaff._id, formData);
        setToast({ message: 'Staff updated', type: 'success' });
      } else {
        await addStaff(formData);
        setToast({ message: 'Staff added', type: 'success' });
      }
      setIsModalOpen(false);
      fetchStaff(true);
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to save staff';
      setToast({ message: errMsg, type: 'error' });
    }
  };

  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({ name: '', role: 'Waiter', phone: '', pin: '', baseSalary: '', salaryType: 'Monthly' });
    setIsModalOpen(true);
  };

  const openEditModal = (s) => {
    setEditingStaff(s);
    setFormData({
      name: s.name,
      role: s.role,
      phone: s.phone || '',
      pin: s.pin,
      baseSalary: s.baseSalary || '',
      salaryType: s.salaryType
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await deleteStaff(id);
      setToast({ message: 'Staff deleted', type: 'success' });
      fetchStaff(true);
    } catch (err) {
      setToast({ message: 'Failed to delete staff', type: 'error' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-background p-1.5 sm:p-2.5 md:p-3 overflow-hidden">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2.5 sm:mb-3 gap-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <BackButton onClick={onGoBack} className="shrink-0" />
          <h1 className="text-lg sm:text-2xl font-black text-text-main flex items-center gap-2">
            <Users className="text-primary" />{t("STAFF MANAGEMENT")}
          </h1>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-opacity text-sm sm:text-base w-full sm:w-auto justify-center">
          <Plus size={18} />{t("Add Staff")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 md:space-y-0">
        {/* Desktop Table */}
        <div className="hidden md:block bg-surface border border-border rounded-xl shadow-sm h-full overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-background sticky top-0 z-10 shadow-xs border-b border-border">
              <tr>
                <th className="p-4 font-bold text-text-muted border-b border-border">
                  <div className="flex items-center gap-2">
                    {t("Name")}
                    {refreshing && (
                      <span className="relative flex h-2 w-2" title={t("Syncing staff details...")}>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                      </span>
                    )}
                  </div>
                </th>
                <th className="p-4 font-bold text-text-muted border-b border-border">{t("Role")}</th>
                <th className="p-4 font-bold text-text-muted border-b border-border">{t("PIN")}</th>
                <th className="p-4 font-bold text-text-muted border-b border-border">{t("Today's Status")}</th>
                <th className="p-4 font-bold text-text-muted border-b border-border text-center">{t("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {/* Dynamic Top UI Loading Section when background syncing */}
              {refreshing && (
                <tr className="bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border-b-2 border-orange-300/70 dark:border-orange-700/40 animate-pulse">
                  <td colSpan={5} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600"></span>
                        </span>
                        <span className="text-xs font-bold text-orange-800 dark:text-orange-300 font-mono tracking-tight flex items-center gap-1.5">
                          {t("Syncing staff details...")}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 w-16 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
                        <div className="h-2.5 w-32 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {loading && staff.length === 0 ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="p-4">
                      <div className="h-4 bg-text-muted/15 rounded-md w-32"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-text-muted/15 rounded-md w-20"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 bg-text-muted/15 rounded-md w-16"></div>
                    </td>
                    <td className="p-4">
                      <div className="h-6 bg-text-muted/15 rounded-md w-24"></div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <div className="w-8 h-8 bg-text-muted/15 rounded-lg"></div>
                        <div className="w-8 h-8 bg-text-muted/15 rounded-lg"></div>
                        <div className="w-8 h-8 bg-text-muted/15 rounded-lg"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : staff.length === 0 && !refreshing ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-muted">
                    <p className="font-medium text-base">{t("No staff members found")}</p>
                    <p className="text-xs mt-1">{t("Click \"Add Staff\" to create your first staff member.")}</p>
                  </td>
                </tr>
              ) : (
                staff.map((s) => {
                  const today = new Date().setHours(0, 0, 0, 0);
                  const todayAttendance = s.attendance?.find((a) => new Date(a.date).getTime() === today);
                  return (
                    <tr key={s._id} className="border-b border-border hover:bg-surface-hover transition-colors">
                      <td className="p-4 font-medium text-text-main">{s.name}</td>
                      <td className="p-4 text-text-muted">{s.role}</td>
                      <td className="p-4 font-mono tracking-widest text-primary font-bold">{s.pin}</td>
                      <td className="p-4">
                        {todayAttendance ?
                        todayAttendance.clockOut ?
                        <button onClick={() => setViewingLog({ staff: s, log: todayAttendance })} className="text-xs bg-gray-500/10 text-gray-500 px-2.5 py-1 rounded-md hover:bg-gray-500/20 flex items-center gap-1 transition-colors"><ImageIcon size={12} />{t("Clocked Out")}</button> :
                        <button onClick={() => setViewingLog({ staff: s, log: todayAttendance })} className="text-xs bg-success/10 text-success px-2.5 py-1 rounded-md hover:bg-success/20 flex items-center gap-1 transition-colors"><ImageIcon size={12} />{t("Clocked In")}</button> :
                        <span className="text-xs bg-danger/10 text-danger px-2.5 py-1 rounded-md font-medium">{t("Not Clocked In")}</span>
                        }
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => setRegisteringFace(s)} className={`p-2 rounded-lg transition-colors ${s.faceDescriptor && s.faceDescriptor.length > 0 ? 'text-success bg-success/10 hover:bg-success/20' : 'text-orange-500 bg-orange-500/10 hover:bg-orange-500/20'}`} title={s.faceDescriptor?.length > 0 ? t('Update Face') : t('Register Face')}><Camera size={16} /></button>
                          <button onClick={() => openEditModal(s)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors" title={t("Edit")}><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(s._id)} className="p-2 text-danger hover:bg-danger/10 rounded-lg transition-colors" title={t("Delete")}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Staff Cards */}
        {loading && staff.length === 0 ? (
          <div className="md:hidden space-y-3 p-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-border p-4 animate-pulse space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 bg-text-muted/15 rounded-md w-28"></div>
                    <div className="h-3 bg-text-muted/15 rounded-md w-20"></div>
                    <div className="h-3 bg-text-muted/15 rounded-md w-16"></div>
                  </div>
                  <div className="h-6 w-20 bg-text-muted/15 rounded-md"></div>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  <div className="flex-1 h-8 bg-text-muted/15 rounded-xl"></div>
                  <div className="flex-1 h-8 bg-text-muted/15 rounded-xl"></div>
                  <div className="flex-1 h-8 bg-text-muted/15 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="md:hidden space-y-3">
            {refreshing && (
              <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/60 to-orange-50/80 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border-2 border-dashed border-orange-400/50 dark:border-orange-500/30 rounded-xl p-2.5 flex items-center justify-between animate-pulse mb-3">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
                  </span>
                  <span className="text-xs font-bold text-orange-800 dark:text-orange-300 font-mono">
                    {t("Syncing staff details...")}
                  </span>
                </div>
                <div className="h-2.5 w-20 bg-orange-200/70 dark:bg-orange-800/40 rounded-full animate-pulse"></div>
              </div>
            )}
            {staff.length === 0 && !refreshing ? (
              <div className="p-8 text-center text-text-muted bg-surface rounded-2xl border border-border">
                <p className="font-medium">{t("No staff members found")}</p>
                <p className="text-xs mt-1">{t("Click \"Add Staff\" to create your first staff member.")}</p>
              </div>
            ) : (
              staff.map((s) => {
                const today = new Date().setHours(0, 0, 0, 0);
                const todayAttendance = s.attendance?.find((a) => new Date(a.date).getTime() === today);
                return (
                  <div key={s._id} className="bg-surface rounded-2xl border border-border p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-text-main">{s.name}</p>
                        <p className="text-sm text-text-muted">{s.role}</p>
                        <p className="text-xs font-mono text-primary font-bold mt-0.5">PIN: {s.pin}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {todayAttendance ?
                        todayAttendance.clockOut ?
                        <button onClick={() => setViewingLog({ staff: s, log: todayAttendance })} className="text-[11px] bg-gray-500/10 text-gray-500 px-2 py-1 rounded-md flex items-center gap-1"><ImageIcon size={10} />{t("Clocked Out")}</button> :
                        <button onClick={() => setViewingLog({ staff: s, log: todayAttendance })} className="text-[11px] bg-success/10 text-success px-2 py-1 rounded-md flex items-center gap-1"><ImageIcon size={10} />{t("Clocked In")}</button> :
                        <span className="text-[11px] bg-danger/10 text-danger px-2 py-1 rounded-md font-medium">{t("Not In")}</span>
                        }
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <button onClick={() => setRegisteringFace(s)} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 ${s.faceDescriptor && s.faceDescriptor.length > 0 ? 'text-success bg-success/10' : 'text-orange-500 bg-orange-500/10'}`}>
                        <Camera size={14} />{s.faceDescriptor?.length > 0 ? 'Face ✓' : 'Register Face'}
                      </button>
                      <button onClick={() => openEditModal(s)} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-blue-500 bg-blue-500/10"><Edit2 size={14} />Edit</button>
                      <button onClick={() => handleDelete(s._id)} className="flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 text-danger bg-danger/10"><Trash2 size={14} />Delete</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {isModalOpen &&
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-border">
            <h2 className="text-xl font-bold mb-4">{editingStaff ? 'Edit Staff' : 'Add Staff'}</h2>
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-text-muted mb-1 block">{t("Name")}</label>
                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-background border border-border rounded-xl p-2 text-text-main" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{t("Role")}</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full bg-background border border-border rounded-xl p-2 text-text-main">
                    <option>{t("Waiter")}</option>
                    <option>{t("Chef")}</option>
                    <option>{t("Manager")}</option>
                    <option>{t("Cleaner")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{t("PIN (4 digits)")}</label>
                  <input required type="text" maxLength="4" value={formData.pin} onChange={(e) => setFormData({ ...formData, pin: e.target.value })} className="w-full bg-background border border-border rounded-xl p-2 text-text-main font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-border rounded-xl">{t("Cancel")}</button>
                <button type="submit" className="px-4 py-2 bg-primary text-white rounded-xl font-bold">{t("Save")}</button>
              </div>
            </form>
          </div>
        </div>
      }

      {registeringFace &&
      <FaceRegistration
        staff={registeringFace}
        onClose={() => setRegisteringFace(null)}
        onSave={async (descriptors) => {
          try {
            await updateStaff(registeringFace._id, { faceDescriptors: descriptors });
            setToast({ message: 'Face mapped successfully!', type: 'success' });
            setRegisteringFace(null);
            fetchStaff();
          } catch (e) {
            setToast({ message: 'Error saving face data', type: 'error' });
          }
        }} />

      }

      {viewingLog &&
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-border shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{t("Attendance Log")}</h2>
              <button onClick={() => setViewingLog(null)} className="p-2 text-text-muted hover:bg-background rounded-full"><X size={20} /></button>
            </div>
            <p className="font-bold text-text-main mb-4">{viewingLog.staff.name}</p>
            
            <div className="space-y-4">
              {viewingLog.log.clockIn &&
            <div className="bg-background p-4 rounded-xl border border-border">
                  <p className="text-sm font-bold text-success mb-2">{t("Clocked In:")} {formatTime12(viewingLog.log.clockIn)}</p>
                  {viewingLog.log.clockInPhoto ?
              <img src={viewingLog.log.clockInPhoto} alt="Clock In" className="w-full rounded-lg shadow-sm" /> :

              <p className="text-xs text-text-muted italic">{t("No photo captured (PIN used without camera)")}</p>
              }
                </div>
            }
              {viewingLog.log.clockOut &&
            <div className="bg-background p-4 rounded-xl border border-border">
                  <p className="text-sm font-bold text-gray-500 mb-2">{t("Clocked Out:")} {formatTime12(viewingLog.log.clockOut)}</p>
                  {viewingLog.log.clockOutPhoto ?
              <img src={viewingLog.log.clockOutPhoto} alt="Clock Out" className="w-full rounded-lg shadow-sm" /> :

              <p className="text-xs text-text-muted italic">{t("No photo captured")}</p>
              }
                </div>
            }
            </div>
          </div>
        </div>
      }

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>);

};

export default StaffManagement;