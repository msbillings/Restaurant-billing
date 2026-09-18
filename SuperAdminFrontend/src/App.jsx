import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Shield, Key, Users, RefreshCw, AlertTriangle, Search, Activity, Power, Edit3, TrendingUp, LogOut, Fingerprint, Globe, MapPin, Radio, Plus, Trash2, CheckCircle, XCircle, Upload, ExternalLink, MessageSquare, Loader2, ChevronLeft, ChevronRight, Calendar, X, Eye, EyeOff, Server } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Login from './Login';
import { startRegistration } from '@simplewebauthn/browser';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

import { getApiBaseUrl, BROADCAST_API_URL } from './config';

// Dynamic API Base URL — works seamlessly on both localhost and Vercel production
const API_BASE_URL = getApiBaseUrl();

// Axios Interceptor for JWT
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('superadmin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

const getClusterBadge = (cluster) => {
  const norm = (cluster || 'cluster0').toLowerCase();
  switch (norm) {
    case 'cluster1': return 'bg-purple-600/30 text-purple-200 border-purple-400/60 shadow-[0_0_8px_rgba(168,85,247,0.25)]';
    case 'cluster2': return 'bg-cyan-600/30 text-cyan-200 border-cyan-400/60 shadow-[0_0_8px_rgba(6,182,212,0.25)]';
    case 'cluster3': return 'bg-emerald-600/30 text-emerald-200 border-emerald-400/60 shadow-[0_0_8px_rgba(16,185,129,0.25)]';
    case 'cluster4': return 'bg-amber-600/30 text-amber-200 border-amber-400/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]';
    case 'cluster5': return 'bg-rose-600/30 text-rose-200 border-rose-400/60 shadow-[0_0_8px_rgba(244,63,94,0.25)]';
    case 'cluster6': return 'bg-pink-600/30 text-pink-200 border-pink-400/60 shadow-[0_0_8px_rgba(236,72,153,0.25)]';
    case 'cluster7': return 'bg-teal-600/30 text-teal-200 border-teal-400/60 shadow-[0_0_8px_rgba(20,184,166,0.25)]';
    case 'cluster8': return 'bg-orange-600/30 text-orange-200 border-orange-400/60 shadow-[0_0_8px_rgba(249,115,22,0.25)]';
    case 'cluster9': return 'bg-indigo-600/30 text-indigo-200 border-indigo-400/60 shadow-[0_0_8px_rgba(99,102,241,0.25)]';
    default: return 'bg-blue-600/30 text-blue-200 border-blue-400/60 shadow-[0_0_8px_rgba(59,130,246,0.25)]';
  }
};

const CLUSTERS = [
  { 
    id: 'cluster0', 
    label: 'Cluster 0 (Primary - AWS Mumbai)', 
    short: 'Cluster 0', 
    db: 'Primary',
    badgeBg: 'bg-blue-500/25 text-blue-200 border-blue-400/70',
    glow: 'shadow-[0_0_10px_rgba(59,130,246,0.3)]',
    barColor: 'from-blue-500 to-indigo-500'
  },
  { 
    id: 'cluster1', 
    label: 'Cluster 1 (msbillings_2 - AWS Mumbai)', 
    short: 'Cluster 1', 
    db: 'msbillings_2',
    badgeBg: 'bg-purple-500/25 text-purple-200 border-purple-400/70',
    glow: 'shadow-[0_0_10px_rgba(168,85,247,0.3)]',
    barColor: 'from-purple-500 to-pink-500'
  },
  { 
    id: 'cluster2', 
    label: 'Cluster 2 (msbillings_3 - AWS Mumbai)', 
    short: 'Cluster 2', 
    db: 'msbillings_3',
    badgeBg: 'bg-cyan-500/25 text-cyan-200 border-cyan-400/70',
    glow: 'shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    barColor: 'from-cyan-400 to-teal-500'
  },
  { 
    id: 'cluster3', 
    label: 'Cluster 3 (msbillings_4 - AWS Mumbai)', 
    short: 'Cluster 3', 
    db: 'msbillings_4',
    badgeBg: 'bg-emerald-500/25 text-emerald-200 border-emerald-400/70',
    glow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]',
    barColor: 'from-emerald-400 to-green-500'
  },
  { 
    id: 'cluster4', 
    label: 'Cluster 4 (msbillings_5 - AWS Mumbai)', 
    short: 'Cluster 4', 
    db: 'msbillings_5',
    badgeBg: 'bg-amber-500/25 text-amber-200 border-amber-400/70',
    glow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]',
    barColor: 'from-amber-400 to-yellow-500'
  },
  { 
    id: 'cluster5', 
    label: 'Cluster 5 (msbillings_6 - AWS Mumbai)', 
    short: 'Cluster 5', 
    db: 'msbillings_6',
    badgeBg: 'bg-rose-500/25 text-rose-200 border-rose-400/70',
    glow: 'shadow-[0_0_10px_rgba(244,63,94,0.3)]',
    barColor: 'from-rose-500 to-red-500'
  },
  { 
    id: 'cluster6', 
    label: 'Cluster 6 (msbillings_7 - AWS Mumbai)', 
    short: 'Cluster 6', 
    db: 'msbillings_7',
    badgeBg: 'bg-pink-500/25 text-pink-200 border-pink-400/70',
    glow: 'shadow-[0_0_10px_rgba(236,72,153,0.3)]',
    barColor: 'from-pink-500 to-rose-400'
  },
  { 
    id: 'cluster7', 
    label: 'Cluster 7 (msbillings_8 - AWS Mumbai)', 
    short: 'Cluster 7', 
    db: 'msbillings_8',
    badgeBg: 'bg-teal-500/25 text-teal-200 border-teal-400/70',
    glow: 'shadow-[0_0_10px_rgba(20,184,166,0.3)]',
    barColor: 'from-teal-400 to-cyan-500'
  },
  { 
    id: 'cluster8', 
    label: 'Cluster 8 (msbillings_9 - AWS Mumbai)', 
    short: 'Cluster 8', 
    db: 'msbillings_9',
    badgeBg: 'bg-orange-500/25 text-orange-200 border-orange-400/70',
    glow: 'shadow-[0_0_10px_rgba(249,115,22,0.3)]',
    barColor: 'from-orange-500 to-amber-500'
  },
  { 
    id: 'cluster9', 
    label: 'Cluster 9 (msbillings_10 - AWS Mumbai)', 
    short: 'Cluster 9', 
    db: 'msbillings_10',
    badgeBg: 'bg-indigo-500/25 text-indigo-200 border-indigo-400/70',
    glow: 'shadow-[0_0_10px_rgba(99,102,241,0.3)]',
    barColor: 'from-indigo-400 to-blue-500'
  },
];

const CLUSTER_MAX_CAPACITY = 10;

function App() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCluster, setFilterCluster] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [signupsFilter, setSignupsFilter] = useState('7days');
  const [clientPage, setClientPage] = useState(1);
  const CLIENTS_PER_PAGE = 10;
  const [currentTab, setCurrentTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    const validTabs = ['Dashboard', 'Insights', 'Broadcasts'];
    const tabMatch = validTabs.find(t => t.toLowerCase() === hash.toLowerCase());
    return tabMatch || 'Dashboard';
  });

  useEffect(() => {
    window.location.hash = currentTab.toLowerCase();
  }, [currentTab]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validTabs = ['Dashboard', 'Insights', 'Broadcasts'];
      const tabMatch = validTabs.find(t => t.toLowerCase() === hash.toLowerCase());
      if (tabMatch && tabMatch !== currentTab) {
        setCurrentTab(tabMatch);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentTab]);

  const [token, setToken] = useState(localStorage.getItem('superadmin_token'));
  const [adminUser, setAdminUser] = useState(JSON.parse(localStorage.getItem('superadmin_user') || 'null'));
  
  // Global Analytics State
  const [globalStats, setGlobalStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Modal State
  const [licenseModal, setLicenseModal] = useState({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false, mapsUrl: '', cluster: 'cluster0' });
  const [createClientModal, setCreateClientModal] = useState({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', cluster: 'cluster0', staffAccounts: [] });
  const [featuresModal, setFeaturesModal] = useState({ isOpen: false, clientId: null, features: {} });
  const [viewStaffModal, setViewStaffModal] = useState({ isOpen: false, clientId: null, staffAccounts: [], restaurantName: '' });
  const [staffFormModal, setStaffFormModal] = useState({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' });
  const [showStaffPassword, setShowStaffPassword] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [mapModal, setMapModal] = useState({ isOpen: false, locationName: '', clients: [] });

  // Broadcast State
  const [broadcasts, setBroadcasts] = useState([]);
  const [loadingBroadcasts, setLoadingBroadcasts] = useState(false);
  const [isSubmittingBroadcast, setIsSubmittingBroadcast] = useState(false);
  const [replies, setReplies] = useState([]);
  const [editingBroadcastId, setEditingBroadcastId] = useState(null);
  const [broadcastStartDate, setBroadcastStartDate] = useState('');
  const [broadcastEndDate, setBroadcastEndDate] = useState('');
  const [broadcastPage, setBroadcastPage] = useState(1);
  const BROADCASTS_PER_PAGE = 4;

  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter(b => {
      if (!b.createdAt) return true;
      const bDate = new Date(b.createdAt);
      if (broadcastStartDate) {
        const start = new Date(broadcastStartDate);
        start.setHours(0, 0, 0, 0);
        if (bDate < start) return false;
      }
      if (broadcastEndDate) {
        const end = new Date(broadcastEndDate);
        end.setHours(23, 59, 59, 999);
        if (bDate > end) return false;
      }
      return true;
    });
  }, [broadcasts, broadcastStartDate, broadcastEndDate]);

  const totalBroadcastPages = Math.ceil(filteredBroadcasts.length / BROADCASTS_PER_PAGE) || 1;
  const paginatedBroadcasts = useMemo(() => {
    const start = (broadcastPage - 1) * BROADCASTS_PER_PAGE;
    return filteredBroadcasts.slice(start, start + BROADCASTS_PER_PAGE);
  }, [filteredBroadcasts, broadcastPage]);
  
  // Persist broadcast form in localStorage
  const getInitialBroadcastState = () => {
    const saved = localStorage.getItem('superadmin_draft_broadcast');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure file is always null on reload since we can't serialize Files
        return { ...parsed, file: null };
      } catch (e) {
        console.error('Error parsing draft broadcast', e);
      }
    }
    return { 
      title: '', 
      message: '', 
      imageUrl: '',
      targetClients: [],
      targetRoles: [],
      file: null,
      allowReplies: true
    };
  };

  const [newBroadcast, setNewBroadcast] = useState(getInitialBroadcastState);

  // Save to local storage whenever it changes
  useEffect(() => {
    // We can't stringify File objects, so we omit 'file'
    const serializableState = { ...newBroadcast };
    delete serializableState.file;
    localStorage.setItem('superadmin_draft_broadcast', JSON.stringify(serializableState));
  }, [newBroadcast]);

  const fetchBroadcasts = async () => {
    setLoadingBroadcasts(true);
    try {
      const response = await axios.get(`${BROADCAST_API_URL}/broadcasts`);
      setBroadcasts(response.data);
      try {
        const repResponse = await axios.get(`${BROADCAST_API_URL}/broadcasts/replies`);
        setReplies(repResponse.data);
      } catch {
        setReplies([]);
      }
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
    } finally {
      setLoadingBroadcasts(false);
    }
  };

  const fetchClients = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGlobalStats = async () => {
    setLoadingStats(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/analytics/global`);
      setGlobalStats(response.data);
    } catch (error) {
      console.error('Error fetching global stats:', error);
      alert('Failed to calculate global stats.');
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    if (token) {
      const loadInitialData = async () => {
        try {
          const [clientsRes, broadcastsRes] = await Promise.allSettled([
            axios.get(`${API_BASE_URL}/clients`),
            axios.get(`${BROADCAST_API_URL}/broadcasts`)
          ]);
          if (clientsRes.status === 'fulfilled') setClients(clientsRes.value.data);
          if (broadcastsRes.status === 'fulfilled') {
            setBroadcasts(broadcastsRes.value.data);
            try {
              const repResponse = await axios.get(`${BROADCAST_API_URL}/broadcasts/replies`);
              setReplies(repResponse.data);
            } catch {
              setReplies([]);
            }
          }
        } catch (error) {
          console.error('Initial data load error:', error);
        } finally {
          setLoading(false);
          setLoadingBroadcasts(false);
        }
      };
      loadInitialData();
    }
  }, [token]);

  const handleLogout = () => {
    localStorage.removeItem('superadmin_token');
    localStorage.removeItem('superadmin_user');
    setToken(null);
    setAdminUser(null);
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);  const handleRegisterFingerprint = async () => {
    try {
      // 1. Get registration options
      const resp = await axios.get(`${API_BASE_URL}/auth/webauthn/register/generate`);
      const options = resp.data;

      // 2. Start biometric prompt
      const attResp = await startRegistration(options);

      // 3. Verify registration
      const verificationResp = await axios.post(`${API_BASE_URL}/auth/webauthn/register/verify`, attResp);

      if (verificationResp.data.verified) {
        alert('🎉 Fingerprint registered successfully! You can now use TouchID to login.');
      } else {
        alert('Failed to register fingerprint.');
      }
    } catch (err) {
      console.error(err);
      const backendErr = err.response?.data?.details || err.message;
      alert(`Error registering fingerprint: ${backendErr}`);
    }
  };

  const handleOverridePassword = async (id, name) => {
    const newPassword = prompt(`Enter new password for ${name}:`);
    if (!newPassword) return;

    try {
      await axios.put(`${API_BASE_URL}/clients/${id}/password`, { newPassword });
      fetchClients();
      alert('Password overridden successfully!');
    } catch (error) {
      console.error('Failed to override password:', error);
      alert('Failed to override password.');
    }
  };

  const openLicenseModal = (client) => {
    setLicenseModal({
      isOpen: true,
      clientId: client._id,
      licenseKey: client.licenseKey || '',
      validUntil: client.validUntil ? new Date(client.validUntil).toISOString().split('T')[0] : '',
      resetHardware: false,
      mapsUrl: client.location?.mapsUrl || '',
      cluster: client.cluster || 'cluster0',
      currentCluster: client.cluster || 'cluster0'
    });
  };

  const handleSaveLicense = async () => {
    const newCluster = (licenseModal.cluster || 'cluster0').toLowerCase().trim();
    const currentCluster = (licenseModal.currentCluster || '').toLowerCase().trim();
    if (newCluster !== currentCluster) {
      const targetCount = clients.filter(c => (c.cluster || 'cluster0').toLowerCase() === newCluster).length;
      if (targetCount >= CLUSTER_MAX_CAPACITY) {
        alert(`Cannot move to ${newCluster.toUpperCase()}: This cluster has reached its maximum capacity of ${CLUSTER_MAX_CAPACITY} restaurants.`);
        return;
      }
    }
    try {
      await axios.put(`${API_BASE_URL}/clients/${licenseModal.clientId}/license`, {
        licenseKey: licenseModal.licenseKey,
        validUntil: licenseModal.validUntil,
        resetHardware: licenseModal.resetHardware,
        mapsUrl: licenseModal.mapsUrl,
        cluster: licenseModal.cluster
      });
      alert('License and Cluster updated successfully!');
      setLicenseModal({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false, mapsUrl: '', cluster: 'cluster0', currentCluster: 'cluster0' });
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update license.');
      console.error(error);
    }
  };

  const openFeaturesModal = (client) => {
    setFeaturesModal({
      isOpen: true,
      clientId: client._id,
      features: client.features || {
        kds: true, inventory: true, crm: true, staff: true, 
        analytics: true, daybook: true, qrcode: true, delivery: true, expenses: true
      }
    });
  };

  const handleSaveFeatures = async () => {
    try {
      await axios.put(`${API_BASE_URL}/clients/${featuresModal.clientId}/features`, {
        features: featuresModal.features
      });
      alert('Features updated successfully!');
      setFeaturesModal({ isOpen: false, clientId: null, features: {} });
      fetchClients();
    } catch (error) {
      alert('Failed to update features.');
      console.error(error);
    }
  };

  const handleOpenAddStaff = () => {
    setStaffFormModal({
      isOpen: true,
      isEdit: false,
      staffId: null,
      oldUsername: '',
      username: '',
      password: '',
      role: 'Cashier'
    });
    setShowStaffPassword(false);
  };

  const handleOpenEditStaff = (staff, index) => {
    setStaffFormModal({
      isOpen: true,
      isEdit: true,
      staffId: staff._id || index,
      oldUsername: staff.username,
      username: staff.username,
      password: staff.plainTextPassword || '',
      role: staff.role || 'Cashier'
    });
    setShowStaffPassword(false);
  };

  const handleSaveStaffAccount = async (e) => {
    e.preventDefault();
    if (!staffFormModal.username.trim() || !staffFormModal.password.trim()) {
      alert('Please enter both username and password.');
      return;
    }

    setStaffLoading(true);
    try {
      if (staffFormModal.isEdit) {
        const res = await axios.put(`${API_BASE_URL}/clients/${viewStaffModal.clientId}/staff/${staffFormModal.staffId}`, {
          username: staffFormModal.username.trim(),
          role: staffFormModal.role,
          plainTextPassword: staffFormModal.password.trim(),
          oldUsername: staffFormModal.oldUsername
        });
        const updatedStaff = res.data.staffAccounts || [];
        setViewStaffModal(prev => ({ ...prev, staffAccounts: updatedStaff }));
        alert('Staff account updated and synced to database!');
      } else {
        const res = await axios.post(`${API_BASE_URL}/clients/${viewStaffModal.clientId}/staff`, {
          username: staffFormModal.username.trim(),
          role: staffFormModal.role,
          plainTextPassword: staffFormModal.password.trim()
        });
        const updatedStaff = res.data.staffAccounts || [];
        setViewStaffModal(prev => ({ ...prev, staffAccounts: updatedStaff }));
        alert('Staff account created and synced to database!');
      }
      setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' });
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to save staff account.');
      console.error(error);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleDeleteStaffAccount = async (staff, index) => {
    if (!confirm(`Are you sure you want to delete staff account "${staff.username}"? This will also remove their login access.`)) return;

    setStaffLoading(true);
    try {
      const staffId = staff._id || index;
      const res = await axios.delete(`${API_BASE_URL}/clients/${viewStaffModal.clientId}/staff/${staffId}`);
      const updatedStaff = res.data.staffAccounts || [];
      setViewStaffModal(prev => ({ ...prev, staffAccounts: updatedStaff }));
      alert(`Staff account "${staff.username}" deleted successfully!`);
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete staff account.');
      console.error(error);
    } finally {
      setStaffLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Quick validation
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const img = document.createElement('img');
        img.src = reader.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setNewBroadcast({ ...newBroadcast, imageUrl: compressedBase64, file: null });
        };
      };
    } else {
      // For APKs/IPAs
      setNewBroadcast({ ...newBroadcast, file: file, imageUrl: '' });
    }
  };

  const handleClientToggle = (clientId) => {
    setNewBroadcast(prev => {
      const current = prev.targetClients;
      if (current.includes(clientId)) {
        return { ...prev, targetClients: current.filter(id => id !== clientId) };
      } else {
        return { ...prev, targetClients: [...current, clientId] };
      }
    });
  };

  const handleRoleToggle = (role) => {
    setNewBroadcast(prev => {
      const current = prev.targetRoles;
      if (current.includes(role)) {
        return { ...prev, targetRoles: current.filter(r => r !== role) };
      } else {
        return { ...prev, targetRoles: [...current, role] };
      }
    });
  };

  const handleCreateBroadcast = async (e) => {
    e.preventDefault();
    setIsSubmittingBroadcast(true);
    try {
      if (newBroadcast.file) {
        // Multipart upload for APK / IPA / PDF files — let Axios auto-set boundary
        const formData = new FormData();
        formData.append('title', newBroadcast.title);
        formData.append('message', newBroadcast.message);
        formData.append('allowReplies', newBroadcast.allowReplies);
        if (newBroadcast.imageUrl) formData.append('imageUrl', newBroadcast.imageUrl);
        formData.append('file', newBroadcast.file);
        formData.append('targetClients', JSON.stringify(newBroadcast.targetClients));
        formData.append('targetRoles', JSON.stringify(newBroadcast.targetRoles));

        if (editingBroadcastId) {
          await axios.put(`${BROADCAST_API_URL}/broadcasts/${editingBroadcastId}`, formData);
          alert('Broadcast updated successfully!');
        } else {
          await axios.post(`${BROADCAST_API_URL}/broadcasts`, formData);
          alert('Broadcast created successfully!');
        }
      } else {
        // Clean JSON payload for text & image broadcasts
        const payload = {
          title: newBroadcast.title,
          message: newBroadcast.message,
          allowReplies: newBroadcast.allowReplies,
          imageUrl: newBroadcast.imageUrl || '',
          targetClients: newBroadcast.targetClients,
          targetRoles: newBroadcast.targetRoles
        };

        if (editingBroadcastId) {
          await axios.put(`${BROADCAST_API_URL}/broadcasts/${editingBroadcastId}`, payload);
          alert('Broadcast updated successfully!');
        } else {
          await axios.post(`${BROADCAST_API_URL}/broadcasts`, payload);
          alert('Broadcast created successfully!');
        }
      }
      
      setNewBroadcast({ title: '', message: '', imageUrl: '', targetClients: [], targetRoles: [], file: null, allowReplies: true });
      setEditingBroadcastId(null);
      localStorage.removeItem('superadmin_draft_broadcast');
      fetchBroadcasts();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${editingBroadcastId ? 'update' : 'create'} broadcast. ` + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingBroadcast(false);
    }
  };

  const getTargetShopNames = (b) => {
    if (!b.targetClients || b.targetClients.length === 0) {
      return 'All Shops (Global)';
    }
    return b.targetClients.map(c => {
      if (typeof c === 'object' && c.restaurantName) return c.restaurantName;
      const found = clients.find(cl => cl._id === c || cl._id?.toString() === c?.toString());
      return found ? found.restaurantName : 'Unknown Shop';
    }).join(', ');
  };

  const handleEditBroadcast = (b) => {
    const clientIds = (b.targetClients || []).map(c => typeof c === 'object' ? (c._id || c.id) : c);
    setNewBroadcast({
      title: b.title,
      message: b.message,
      imageUrl: b.imageUrl || '',
      targetClients: clientIds,
      targetRoles: b.targetRoles || [],
      file: null,
      allowReplies: b.allowReplies
    });
    setEditingBroadcastId(b._id);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleBroadcast = async (id) => {
    try {
      await axios.put(`${BROADCAST_API_URL}/broadcasts/${id}/toggle`);
      fetchBroadcasts();
    } catch {
      alert('Failed to toggle broadcast');
    }
  };

  const deleteBroadcast = async (id) => {
    if (!window.confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      await axios.delete(`${BROADCAST_API_URL}/broadcasts/${id}`);
      fetchBroadcasts();
    } catch {
      alert('Failed to delete broadcast');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    if (!confirm(`Are you sure you want to change this client's status to ${newStatus}?`)) return;

    try {
      await axios.put(`${API_BASE_URL}/clients/${id}/status`, { status: newStatus });
      fetchClients();
    } catch (error) {
      alert('Failed to update status.');
      console.error(error);
    }
  };

  const handleDeleteClient = async (id) => {
    if (!confirm('Are you sure you want to completely delete this restaurant? This cannot be undone and will remove all their access.')) return;

    try {
      await axios.delete(`${API_BASE_URL}/clients/${id}`);
      fetchClients();
    } catch (error) {
      alert('Failed to delete client.');
      console.error(error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Restaurant Name', 'Email', 'License Key', 'Plan', 'Status', 'Expires At', 'Hardware ID'];
    const csvRows = [headers.join(',')];

    clients.forEach(c => {
      const row = [
        `"${c.restaurantName || ''}"`,
        `"${c.email || ''}"`,
        `"${c.licenseKey || ''}"`,
        `"${c.plan || 'Unknown'}"`,
        `"${c.status || 'Active'}"`,
        `"${c.validUntil ? new Date(c.validUntil).toLocaleDateString() : 'N/A'}"`,
        `"${c.hardwareId || 'Not Activated'}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `msbilling_clients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Calculate restaurant count per cluster
  const clusterCounts = useMemo(() => {
    const counts = {};
    for (let i = 0; i <= 9; i++) {
      counts[`cluster${i}`] = 0;
    }
    clients.forEach(c => {
      const cl = (c.cluster || 'cluster0').toLowerCase().trim();
      if (counts[cl] !== undefined) {
        counts[cl]++;
      } else {
        counts['cluster0']++;
      }
    });
    return counts;
  }, [clients]);

  const getFirstAvailableCluster = () => {
    for (let i = 0; i <= 9; i++) {
      const id = `cluster${i}`;
      if ((clusterCounts[id] || 0) < CLUSTER_MAX_CAPACITY) return id;
    }
    return 'cluster0';
  };

  const handleOpenCreateClientModal = () => {
    const available = getFirstAvailableCluster();
    setCreateClientModal(prev => ({
      ...prev,
      isOpen: true,
      cluster: (clusterCounts[prev.cluster] || 0) < CLUSTER_MAX_CAPACITY ? prev.cluster : available
    }));
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    const targetCluster = (createClientModal.cluster || 'cluster0').toLowerCase().trim();
    const countInCluster = clients.filter(c => (c.cluster || 'cluster0').toLowerCase() === targetCluster).length;
    if (countInCluster >= CLUSTER_MAX_CAPACITY) {
      alert(`Cannot create client: Cluster ${targetCluster.toUpperCase()} has reached the maximum capacity of ${CLUSTER_MAX_CAPACITY} restaurants. Please select an available cluster.`);
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/clients`, createClientModal);
      alert('Client and License generated successfully!');
      const nextCluster = getFirstAvailableCluster();
      setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', cluster: nextCluster, staffAccounts: [] });
      fetchClients();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to create client');
    }
  };

  const handleLocationClick = (geoName) => {
    setClientPage(1);
    if (selectedLocation === geoName) {
      setSelectedLocation('');
    } else {
      setSelectedLocation(geoName);
    }
  };

  const handleClearGeoFilter = () => {
    setClientPage(1);
    setSelectedLocation('');
    if (searchTerm && selectedLocation && selectedLocation.toLowerCase().includes(searchTerm.toLowerCase())) {
      setSearchTerm('');
    }
  };

  const filteredClients = clients.filter(c => {
    const locString = c.location ? `${c.location.city}, ${c.location.country}`.toLowerCase() : 'unknown location';
    const clientCluster = (c.cluster || 'cluster0').toLowerCase();
    const matchesSearch = c.restaurantName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (c.databaseName && c.databaseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          clientCluster.includes(searchTerm.toLowerCase()) ||
                          locString.includes(searchTerm.toLowerCase());
    const matchesPlan = filterPlan === 'All' || c.plan === filterPlan || (filterPlan === 'Custom' && !['Monthly', 'Yearly', 'Lifetime'].includes(c.plan));
    const matchesStatus = filterStatus === 'All' || c.status === filterStatus;
    const matchesCluster = filterCluster === 'All' || clientCluster === filterCluster.toLowerCase();
    
    const matchesLocation = !selectedLocation || (
      selectedLocation === 'Unknown Location'
        ? (!c.location || !c.location.city || !c.location.country || c.location.city.toLowerCase() === 'unknown')
        : (c.location && `${c.location.city}, ${c.location.country}`.toLowerCase() === selectedLocation.toLowerCase())
    );

    // Check expiry for "Expired" status filter if we add it, but currently using DB status which is 'Active' or 'Suspended'
    if (filterStatus === 'Expired') {
      const isExpired = c.validUntil && new Date(c.validUntil) < new Date();
      return matchesSearch && matchesPlan && matchesCluster && matchesLocation && isExpired;
    }
    
    return matchesSearch && matchesPlan && matchesStatus && matchesCluster && matchesLocation;
  });

  const totalClientPages = Math.ceil(filteredClients.length / CLIENTS_PER_PAGE) || 1;
  const activeClientPage = clientPage > totalClientPages ? 1 : clientPage;
  const paginatedClients = useMemo(() => {
    const start = (activeClientPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(start, start + CLIENTS_PER_PAGE);
  }, [filteredClients, activeClientPage]);

  // --- ANALYTICS CALCULATIONS ---
  const { totalRevenue, expiringSoon, planData, monthlyData, geographicData } = useMemo(() => {
    let rev = 0;
    const expiring = [];
    const planCounts = { Monthly: 0, Yearly: 0, Lifetime: 0, Custom: 0 };
    const geoCounts = {};
    
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const mData = [];
    if (signupsFilter === '7days') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const name = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
        mData.push({ name, signups: 0, dateKey: name });
      }
    } else {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        const name = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
        mData.push({ name, signups: 0, _month: d.getMonth(), _year: d.getFullYear() });
      }
    }

    clients.forEach(c => {
      // Revenue (Estimated placeholders: Monthly=500, Yearly=5000, Lifetime=20000)
      if (c.plan === 'Monthly') rev += 500;
      else if (c.plan === 'Yearly') rev += 5000;
      else if (c.plan === 'Lifetime') rev += 20000;
      
      // Plan counts
      if (planCounts[c.plan] !== undefined) planCounts[c.plan]++;
      else planCounts['Custom']++;

      // Expiry alerts
      if (c.validUntil) {
        const expiry = new Date(c.validUntil);
        if (expiry > today && expiry <= thirtyDaysFromNow) {
          expiring.push(c);
        } else if (expiry <= today) {
          expiring.push(c);
        }
      }

      // Signups logic
      const dateString = c.licenseCreatedAt || c.createdAt;
      if (dateString) {
        const date = new Date(dateString);
        if (signupsFilter === '7days') {
          const name = date.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          const item = mData.find(m => m.dateKey === name);
          if (item) item.signups++;
        } else {
          const m = date.getMonth();
          const y = date.getFullYear();
          const item = mData.find(x => x._month === m && x._year === y);
          if (item) item.signups++;
        }
      }

      // Geo Data
      if (c.location && c.location.city && c.location.country) {
        const key = `${c.location.city}, ${c.location.country}`;
        geoCounts[key] = (geoCounts[key] || 0) + 1;
      } else {
        geoCounts['Unknown Location'] = (geoCounts['Unknown Location'] || 0) + 1;
      }
    });

    const pData = [
      { name: 'Monthly', value: planCounts.Monthly, color: '#3b82f6' },
      { name: 'Yearly', value: planCounts.Yearly, color: '#10b981' },
      { name: 'Lifetime', value: planCounts.Lifetime, color: '#f59e0b' },
      { name: 'Custom', value: planCounts.Custom, color: '#8b5cf6' }
    ].filter(d => d.value > 0);

    const gData = Object.keys(geoCounts)
      .map(k => ({ name: k, value: geoCounts[k] }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 5);

    return { totalRevenue: rev, expiringSoon: expiring, planData: pData, monthlyData: mData, geographicData: gData };
  }, [clients, signupsFilter]);

  if (!token) {
    return <Login onLogin={(t) => setToken(t)} />;
  }

  return (
    <div className="min-h-screen bg-background text-white font-sans selection:bg-primary/30">
      
      {/* Top Navbar */}
      <nav className="bg-surface border-b border-border sticky top-0 z-50">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between py-3 min-h-[4rem] gap-y-4">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary/20 rounded-xl flex items-center justify-center border border-primary/30 flex-shrink-0 shadow-[0_0_15px_rgba(255,92,53,0.3)]">
                  <Shield className="text-primary w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="font-black text-lg sm:text-xl tracking-tight whitespace-nowrap">MS<span className="text-primary">BILLING</span> <span className="font-medium text-gray-400 hidden sm:inline">SUPER ADMIN</span></span>
              </div>
              
              <div className="flex sm:hidden items-center gap-2">
                <button onClick={handleRegisterFingerprint} title="Register Fingerprint" className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition">
                  <Fingerprint className="w-4 h-4" />
                </button>
                <button onClick={() => setShowLogoutConfirm(true)} title="Logout" className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <div className="bg-background/50 px-3 py-1.5 rounded-full border border-border flex items-center gap-2 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-xs sm:text-sm font-medium text-gray-300">System Online</span>
              </div>
              <div className="hidden sm:flex items-center gap-3 border-l border-border pl-4">
                <div className="text-right">
                  <p className="text-sm font-bold truncate max-w-[120px]">{adminUser?.name || 'Admin'}</p>
                  <p className="text-xs text-gray-500">{adminUser?.role || 'SuperAdmin'}</p>
                </div>
                <button onClick={handleRegisterFingerprint} title="Register Fingerprint" className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition">
                  <Fingerprint className="w-5 h-5" />
                </button>
                <button onClick={() => setShowLogoutConfirm(true)} title="Logout" className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl transition">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="w-full max-w-[1800px] mx-auto px-2 sm:px-6 lg:px-8 mt-4 md:mt-6 overflow-x-auto">
        <div className="flex gap-2 md:gap-4 border-b border-border min-w-max">
          <button
            onClick={() => setCurrentTab('Dashboard')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Dashboard' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Client Database
          </button>
          <button 
            onClick={() => setCurrentTab('Insights')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Insights' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Global Insights
          </button>
          <button 
            onClick={() => setCurrentTab('Broadcasts')}
            className={`px-4 py-2 font-bold transition-colors ${currentTab === 'Broadcasts' ? 'border-b-2 border-primary text-primary' : 'text-gray-400 hover:text-white'}`}
          >
            Broadcasts (In-App)
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-[1800px] mx-auto px-2 sm:px-6 lg:px-8 py-4 md:py-8">
        
        {currentTab === 'Dashboard' && (
          <>
            {/* Stats Row */}
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-6 mb-4 md:mb-8">
          <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1.5 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Users className="w-6 h-6 md:w-24 md:h-24 text-white" />
            </div>
            <p className="text-gray-400 text-[9px] md:text-sm font-bold uppercase tracking-wider mb-0.5 md:mb-2 leading-tight truncate">Total Clients</p>
            <h3 className="text-lg md:text-4xl font-black">{clients.length}</h3>
          </div>
          <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1.5 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Key className="w-6 h-6 md:w-24 md:h-24 text-white" />
            </div>
            <p className="text-gray-400 text-[9px] md:text-sm font-bold uppercase tracking-wider mb-0.5 md:mb-2 leading-tight truncate">Active Licenses</p>
            <h3 className="text-lg md:text-4xl font-black text-primary">{clients.filter(c => c.status === 'Active').length}</h3>
          </div>
          <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-1.5 md:p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-6 h-6 md:w-24 md:h-24 text-white" />
            </div>
            <p className="text-gray-400 text-[9px] md:text-sm font-bold uppercase tracking-wider mb-0.5 md:mb-2 leading-tight truncate">Est. Revenue</p>
            <h3 className="text-lg md:text-4xl font-black text-green-400">₹{totalRevenue >= 1000 ? (totalRevenue/1000).toFixed(1)+'k' : totalRevenue}</h3>
          </div>
          <div className="bg-surface rounded-xl md:rounded-2xl p-3 md:p-6 border border-border shadow-lg relative overflow-hidden group flex items-center justify-between col-span-3 md:col-span-1">
            <div>
              <p className="text-gray-400 text-[10px] md:text-sm font-bold uppercase tracking-wider mb-1 md:mb-2 leading-tight">Generate New Key</p>
              <button onClick={handleOpenCreateClientModal} className="bg-primary hover:bg-primary-hover text-white font-bold py-1.5 px-4 md:py-2 md:px-6 text-xs md:text-base rounded-lg md:rounded-xl transition-all shadow-lg shadow-primary/20">
                + New Client
              </button>
            </div>
          </div>
        </div>

        {/* MongoDB Clusters Node Capacity Stat Cards */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
              <h3 className="text-base md:text-lg font-black text-white tracking-wide">Cluster Allocations & Capacity</h3>
              <span className="text-[11px] bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 px-2.5 py-0.5 rounded-full font-mono font-bold shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                Max 10 / Cluster
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="bg-[#131c2e] border border-slate-700/90 px-3 py-1.5 rounded-xl text-slate-300 font-medium shadow-sm">
                Total: <strong className="text-cyan-300 font-mono text-sm font-black">{clients.length}</strong> / 100 capacity • <strong className="text-emerald-400 font-mono font-bold">{100 - clients.length} slots available</strong>
              </span>
              {filterCluster !== 'All' && (
                <button 
                  onClick={() => { setFilterCluster('All'); setClientPage(1); }}
                  className="text-xs text-primary hover:text-white font-bold flex items-center gap-1.5 bg-primary/20 hover:bg-primary/40 border border-primary/50 px-3 py-1.5 rounded-xl transition-all shadow-[0_0_10px_rgba(255,92,53,0.3)]"
                >
                  <X className="w-3.5 h-3.5" /> Reset Filter ({filterCluster.toUpperCase()})
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 xl:grid-cols-10 gap-3">
            {CLUSTERS.map(cl => {
              const count = clusterCounts[cl.id] || 0;
              const isFull = count >= CLUSTER_MAX_CAPACITY;
              const isSelected = filterCluster === cl.id;
              const percent = Math.min(100, Math.round((count / CLUSTER_MAX_CAPACITY) * 100));

              return (
                <div
                  key={cl.id}
                  onClick={() => { setFilterCluster(isSelected ? 'All' : cl.id); setClientPage(1); }}
                  className={`relative rounded-xl p-3 border-2 transition-all cursor-pointer group flex flex-col justify-between ${
                    isSelected 
                      ? 'border-primary ring-2 ring-primary/60 bg-gradient-to-b from-[#1a2538] to-primary/20 shadow-[0_0_20px_rgba(255,92,53,0.4)] -translate-y-1' 
                      : isFull 
                        ? 'border-red-500/80 bg-gradient-to-b from-red-950/40 via-[#161c28] to-[#0f1520] hover:border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:-translate-y-1' 
                        : 'border-slate-700/90 hover:border-cyan-400/80 bg-gradient-to-b from-[#151f32] to-[#0d1422] hover:shadow-[0_0_16px_rgba(6,182,212,0.25)] hover:-translate-y-1'
                  }`}
                  title={`Click to filter Client Database by ${cl.short} (${count}/${CLUSTER_MAX_CAPACITY} used)`}
                >
                  {/* Top Bar: Cluster Badge & Status */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`font-mono text-[10px] font-black px-2 py-0.5 rounded-md border ${cl.badgeBg} ${cl.glow}`}>
                      {cl.short.toUpperCase()}
                    </span>
                    {isFull ? (
                      <span className="text-[9px] font-black tracking-wider text-white bg-red-600 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(239,68,68,0.7)] border border-red-400 animate-pulse">
                        FULL
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/50 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        {CLUSTER_MAX_CAPACITY - count} left
                      </span>
                    )}
                  </div>

                  {/* Mid: Count / 10 & Database Pill */}
                  <div className="my-1">
                    <div className="flex items-baseline justify-between">
                      <span className={`text-2xl font-black ${
                        isFull 
                          ? 'text-red-400 drop-shadow-[0_0_10px_rgba(239,68,68,0.7)]' 
                          : count > 0 
                            ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]' 
                            : 'text-slate-300 font-extrabold'
                      }`}>
                        {count}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">/ 10</span>
                    </div>
                    <p className="text-[11px] font-mono font-bold text-cyan-300/90 truncate mt-1.5 bg-[#090e18] px-2 py-0.5 rounded border border-slate-700/80" title={cl.db}>
                      {cl.db}
                    </p>
                  </div>

                  {/* High Visibility Progress Bar */}
                  <div className="w-full bg-slate-900 rounded-full h-2 mt-2 overflow-hidden border border-slate-700/90 p-[1px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        isFull 
                          ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]' 
                          : count >= 8 
                            ? 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' 
                            : count > 0 
                              ? `bg-gradient-to-r ${cl.barColor} shadow-[0_0_10px_rgba(6,182,212,0.8)]` 
                              : 'bg-transparent'
                      }`}
                      style={{ width: `${Math.max(count > 0 ? 10 : 0, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dashboard Charts & Alerts Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Expiry Alerts Panel */}
          <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl flex flex-col max-h-96">
            <h3 className="text-base md:text-lg font-bold flex items-center gap-2 mb-4">
              <AlertTriangle className="text-amber-500 w-5 h-5" /> 
              Expiry Alerts
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {expiringSoon.length === 0 ? (
                <div className="text-gray-500 text-sm text-center py-8">All subscriptions are healthy.</div>
              ) : (
                expiringSoon.map(client => {
                  const isExpired = new Date(client.validUntil) < new Date();
                  return (
                    <div key={client._id} className="bg-background border border-border rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm">{client.restaurantName}</p>
                        <p className={`text-xs font-mono ${isExpired ? 'text-red-400' : 'text-amber-400'}`}>
                          {isExpired ? 'Expired' : 'Expiring'}: {new Date(client.validUntil).toLocaleDateString()}
                        </p>
                      </div>
                      <button onClick={() => openLicenseModal(client)} className="text-xs bg-surface border border-border px-2 py-1 rounded hover:bg-gray-700 transition">Extend</button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Growth Chart */}
          <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl lg:col-span-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base md:text-lg font-bold flex items-center gap-2"><TrendingUp className="text-primary w-5 h-5"/> New Signups</h3>
              <select 
                value={signupsFilter} 
                onChange={e => setSignupsFilter(e.target.value)}
                className="bg-background border border-border rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="7days">Last 7 Days</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{fill: '#374151'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                  <Bar dataKey="signups" fill="#ff5c35" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Plan Distribution */}
          <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl">
            <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2"><Key className="text-green-500 w-5 h-5"/> Plan Distribution</h3>
            <div className="h-64 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={planData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-2xl font-black">{clients.length}</p>
                <p className="text-xs text-gray-400">Clients</p>
              </div>
            </div>
            <div className="flex justify-center gap-4 mt-2">
              {planData.map(plan => (
                <div key={plan.name} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: plan.color }}></div>
                  <span className="text-xs text-gray-300 font-medium">{plan.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Geographic Distribution Row */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Globe className="text-blue-400 w-5 h-5"/>
                <h3 className="text-lg font-bold text-white">Geographic Distribution</h3>
                <span className="text-xs font-normal text-gray-400 ml-1 hidden sm:inline">(Auto-detected via POS IP)</span>
              </div>

              {selectedLocation ? (
                <button 
                  onClick={handleClearGeoFilter}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/50 rounded-lg text-xs font-bold transition-all duration-200 shadow-md shadow-blue-500/20 hover:scale-105 active:scale-95 self-start sm:self-auto"
                  title="Clear geographic filter"
                >
                  <X className="w-4 h-4 text-blue-400" />
                  <span>Clear Filter</span>
                  <span className="max-w-[150px] truncate text-blue-200 bg-blue-500/30 px-2 py-0.5 rounded text-[11px] font-mono">
                    {selectedLocation}
                  </span>
                </button>
              ) : (
                <button 
                  disabled
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-background/50 text-gray-500 border border-border/50 rounded-lg text-xs font-medium cursor-not-allowed opacity-50 self-start sm:self-auto"
                  title="No active geographic filter"
                >
                  <X className="w-4 h-4" />
                  <span>Clear Filter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {geographicData.length === 0 ? (
                 <div className="col-span-full text-center text-gray-500 py-4 text-sm">Waiting for clients to sync locations...</div>
              ) : (
                geographicData.map((geo) => {
                  const isUnknown = geo.name === 'Unknown Location';
                  const isSelected = selectedLocation === geo.name;
                  
                  return (
                    <div 
                      key={geo.name} 
                      onClick={() => handleLocationClick(geo.name)}
                      className={`relative bg-background border rounded-xl p-4 flex flex-col justify-center items-center text-center transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-500/15 shadow-lg shadow-blue-500/20 ring-2 ring-blue-500/50 -translate-y-1' 
                          : 'border-border hover:border-blue-500/60 hover:bg-blue-500/5 shadow-sm hover:shadow-blue-500/10 hover:-translate-y-1'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          <span>Filtered</span>
                        </div>
                      )}

                      {!isUnknown && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const clientsInLoc = clients.filter(c => c.location && c.location.city === geo.name.split(',')[0]);
                            setMapModal({ isOpen: true, locationName: geo.name, clients: clientsInLoc });
                          }}
                          className="absolute top-2 right-2 text-gray-500 hover:text-blue-400 transition-colors p-0.5 rounded hover:bg-white/5"
                          title="View on Interactive Map"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      )}
                      <MapPin className={`w-6 h-6 mb-2 transition-colors ${isSelected ? 'text-blue-300' : 'text-blue-400'}`} />
                      <h4 className="text-white font-bold text-sm mb-1">{geo.name}</h4>
                      <span className={`text-xs font-black px-2 py-1 rounded-full transition-colors ${isSelected ? 'bg-blue-500 text-white shadow-sm' : 'bg-blue-500/20 text-blue-400'}`}>
                        {geo.value} {geo.value === 1 ? 'Client' : 'Clients'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Search Bar & Filters */}
        <div className="bg-surface p-4 rounded-t-2xl border border-border border-b-0 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex items-center justify-between w-full xl:w-auto">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold">Client Database</h2>
              {selectedLocation && (
                <div className="hidden sm:flex items-center gap-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs px-2.5 py-1 rounded-lg">
                  <MapPin className="w-3 h-3 text-blue-400" />
                  <span className="font-semibold">{selectedLocation}</span>
                  <button onClick={handleClearGeoFilter} title="Clear location filter" className="hover:text-white ml-0.5 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
            <button onClick={exportToCSV} className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded transition font-medium flex items-center gap-2 whitespace-nowrap">
              Export CSV
            </button>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex flex-wrap gap-3 w-full sm:w-auto">
              <select 
                value={filterPlan} 
                onChange={e => { setFilterPlan(e.target.value); setClientPage(1); }}
                className="w-full sm:w-auto bg-background border border-border rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="All">All Plans</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
                <option value="Lifetime">Lifetime</option>
                <option value="Custom">Custom</option>
              </select>
              
              <select 
                value={filterStatus} 
                onChange={e => { setFilterStatus(e.target.value); setClientPage(1); }}
                className="w-full sm:w-auto bg-background border border-border rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>

              <select 
                value={filterCluster} 
                onChange={e => { setFilterCluster(e.target.value); setClientPage(1); }}
                className="w-full sm:w-auto bg-background border border-border rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-primary font-medium"
              >
                <option value="All">🌐 All Clusters (0-9) • {clients.length}</option>
                {CLUSTERS.map(cl => (
                  <option key={cl.id} value={cl.id}>
                    {cl.short} ({cl.db}) — {clusterCounts[cl.id] || 0}/10
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-500" />
              </div>
              <input 
                type="text" 
                placeholder="Search restaurant, email, cluster or DB..." 
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setClientPage(1); }}
                className="w-full bg-background border border-border rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface border border-border rounded-b-2xl shadow-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-background/50 text-gray-400 text-xs uppercase tracking-wider font-bold">
                <th className="p-4 border-b border-border">Restaurant</th>
                <th className="p-4 border-b border-border">Cluster & Database</th>
                <th className="p-4 border-b border-border">Username</th>
                <th className="p-4 border-b border-border">Email</th>
                <th className="p-4 border-b border-border">License Key</th>
                <th className="p-4 border-b border-border">Expires</th>
                <th className="p-4 border-b border-border bg-red-900/10 text-red-400">Plain Password</th>
                <th className="p-4 border-b border-border">HWID Binding</th>
                <th className="p-4 border-b border-border text-center">Status</th>
                <th className="p-4 border-b border-border text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-gray-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading database...
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-8 text-center text-gray-500">
                    <p className="mb-2">No clients found matching your filters.</p>
                    {selectedLocation && (
                      <button 
                        onClick={handleClearGeoFilter}
                        className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
                      >
                        Clear geographic filter ({selectedLocation})
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedClients.map(client => (
                  <tr key={client._id} className="hover:bg-background/30 transition-colors">
                    <td className="p-4 font-bold">{client.restaurantName}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border shadow-sm ${getClusterBadge(client.cluster)}`}>
                          {(client.cluster || 'cluster0').toUpperCase()}
                        </span>
                        <span className="font-mono text-xs text-gray-400 max-w-[170px] truncate" title={client.databaseName}>
                          {client.databaseName || 'mscurechain'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-medium text-gray-200">
                      {client.staffAccounts?.length > 0 
                        ? (client.staffAccounts.find(s => s.role === 'Admin')?.username || client.staffAccounts[0].username) 
                        : client.email}
                    </td>
                    <td className="p-4 text-gray-300">{client.email}</td>
                    <td className="p-4">
                      <span className="font-mono bg-background px-2 py-1 rounded text-primary text-xs font-bold border border-primary/20 whitespace-nowrap">
                        {client.licenseKey}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-gray-300 text-xs">
                      {client.validUntil ? new Date(client.validUntil).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="font-mono text-red-400 font-bold bg-red-400/10 px-2 py-1 rounded border border-red-400/20">
                          {client.plainTextPassword}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {client.hardwareId ? (
                        <span className="text-green-400 text-xs font-mono bg-green-400/10 px-2 py-1 rounded border border-green-400/20" title={client.hardwareId}>
                          {client.hardwareId.substring(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-gray-500 text-xs italic">Not Activated Yet</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        client.status === 'Active' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 
                        client.status === 'Suspended' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                        'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex flex-wrap gap-2 justify-end min-w-[200px]">
                        <button 
                          onClick={() => handleToggleStatus(client._id, client.status)}
                          className={`flex items-center gap-1 text-xs font-bold ${client.status === 'Active' ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/30' : 'bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/30'} border px-3 py-1.5 rounded transition-colors`}
                        >
                          <Power className="w-3 h-3" /> {client.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => openLicenseModal(client)}
                          className="flex items-center gap-1 text-xs font-bold bg-primary hover:bg-primary-hover text-white px-3 py-1.5 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" /> Edit
                        </button>
                        <button 
                          onClick={() => openFeaturesModal(client)}
                          className="flex items-center gap-1 text-xs font-bold bg-accent hover:bg-accent/80 text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Features
                        </button>
                        <button 
                          onClick={() => {
                            setViewStaffModal({ isOpen: true, clientId: client._id, staffAccounts: client.staffAccounts || [], restaurantName: client.restaurantName });
                            setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' });
                          }}
                          className="flex items-center gap-1 text-xs font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 px-3 py-1.5 rounded transition-colors"
                        >
                          <Users className="w-3 h-3" /> Staff
                        </button>
                        <button 
                          onClick={() => handleOverridePassword(client._id, client.restaurantName)}
                          className="text-xs font-bold bg-surface border border-border hover:bg-gray-700 hover:text-white px-3 py-1.5 rounded transition-colors"
                        >
                          Reset Pwd
                        </button>
                        <button 
                          onClick={() => handleDeleteClient(client._id)}
                          className="flex items-center gap-1 text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded transition-colors"
                          title="Delete Client"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Table Pagination Footer */}
          <div className="bg-surface px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-300 font-medium">
              Showing <span className="font-bold text-cyan-400">{filteredClients.length === 0 ? 0 : (activeClientPage - 1) * CLIENTS_PER_PAGE + 1}</span> to <span className="font-bold text-cyan-400">{Math.min(activeClientPage * CLIENTS_PER_PAGE, filteredClients.length)}</span> of <span className="font-bold text-white">{filteredClients.length}</span> clients
            </div>

            {totalClientPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setClientPage(p => Math.max(1, p - 1))}
                  disabled={activeClientPage === 1}
                  className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalClientPages }, (_, idx) => idx + 1).map(pageNum => {
                    if (
                      pageNum === 1 || 
                      pageNum === totalClientPages || 
                      (pageNum >= activeClientPage - 1 && pageNum <= activeClientPage + 1)
                    ) {
                      const isActive = pageNum === activeClientPage;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setClientPage(pageNum)}
                          className={`min-w-[32px] h-8 flex items-center justify-center rounded-lg text-xs font-bold font-mono transition-all ${
                            isActive 
                              ? 'bg-primary text-white shadow-md shadow-primary/30 scale-105 ring-1 ring-white/30' 
                              : 'bg-background border border-border text-gray-400 hover:text-white hover:border-gray-500'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    }
                    if (pageNum === activeClientPage - 2 || pageNum === activeClientPage + 2) {
                      return <span key={pageNum} className="text-gray-500 px-1 text-xs">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setClientPage(p => Math.min(totalClientPages, p + 1))}
                  disabled={activeClientPage === totalClientPages}
                  className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border rounded-lg text-xs font-semibold text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next Page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
        </>)}

        {currentTab === 'Insights' && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-surface p-6 rounded-2xl border border-border shadow-xl">
              <div className="w-full xl:w-auto">
                <h2 className="text-2xl font-black mb-2">Global Platform Analytics</h2>
                <p className="text-gray-400 text-sm">Extracts data directly from all isolated tenant databases across the platform.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
                <button 
                  onClick={() => window.open(`${API_BASE_URL}/analytics/customers/export`, '_blank')}
                  className="w-full sm:w-auto bg-surface hover:bg-gray-700 border border-border text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Export All Customers (CSV)
                </button>
                <button 
                  onClick={fetchGlobalStats}
                  disabled={loadingStats}
                  className="w-full sm:w-auto bg-primary hover:bg-primary-hover disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {loadingStats ? <RefreshCw className="w-5 h-5 animate-spin flex-shrink-0" /> : <Activity className="w-5 h-5 flex-shrink-0" />}
                  <span>{loadingStats ? 'Calculating Global Data...' : 'Calculate Global Stats'}</span>
                </button>
              </div>
            </div>

            {globalStats ? (
              <div className="space-y-6">
                <div className="grid grid-cols-4 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-6 mb-4 md:mb-8">
                  <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-[7px] md:text-sm font-bold uppercase tracking-wider mb-0 md:mb-2 leading-tight text-center md:text-left truncate">Total GMV</p>
                    <h3 className="text-sm md:text-4xl font-black text-green-400 text-center md:text-left truncate">₹{globalStats.totalGMV >= 1000 ? (globalStats.totalGMV/1000).toFixed(1)+'k' : globalStats.totalGMV}</h3>
                  </div>
                  <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-[7px] md:text-sm font-bold uppercase tracking-wider mb-0 md:mb-2 leading-tight text-center md:text-left truncate">Total Orders</p>
                    <h3 className="text-sm md:text-4xl font-black text-blue-400 text-center md:text-left truncate">{globalStats.totalOrders >= 1000 ? (globalStats.totalOrders/1000).toFixed(1)+'k' : globalStats.totalOrders}</h3>
                  </div>
                  <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-[7px] md:text-sm font-bold uppercase tracking-wider mb-0 md:mb-2 leading-tight text-center md:text-left truncate">Avg Order Value</p>
                    <h3 className="text-sm md:text-4xl font-black text-amber-400 text-center md:text-left truncate">₹{Math.round(globalStats.aov) >= 1000 ? (Math.round(globalStats.aov)/1000).toFixed(1)+'k' : Math.round(globalStats.aov)}</h3>
                  </div>
                  <div className="bg-surface rounded-xl md:rounded-2xl p-2 md:p-6 border border-border shadow-lg">
                    <p className="text-gray-400 text-[7px] md:text-sm font-bold uppercase tracking-wider mb-0 md:mb-2 leading-tight text-center md:text-left truncate">End Customers</p>
                    <h3 className="text-sm md:text-4xl font-black text-purple-400 text-center md:text-left truncate">{globalStats.totalCustomers >= 1000 ? (globalStats.totalCustomers/1000).toFixed(1)+'k' : globalStats.totalCustomers}</h3>
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl">
                  <h3 className="text-base md:text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                    Most Ordered Items Globally
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={globalStats.topItems} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                        <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} width={100} />
                        <Tooltip cursor={{fill: '#374151'}} contentStyle={{backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff'}} />
                        <Bar dataKey="quantity" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={30} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-2xl p-16 text-center shadow-xl">
                <Activity className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-400">No Analytics Loaded</h3>
                <p className="text-gray-500 mt-2">Click the Calculate button above to query all tenant databases.</p>
              </div>
            )}
          </div>
        )}

        {currentTab === 'Broadcasts' && (
          <div className="space-y-4 md:space-y-8 animate-fade-in">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 md:gap-6 bg-surface p-4 md:p-6 rounded-xl md:rounded-2xl border border-border shadow-xl">
              <div className="w-full xl:w-auto">
                <h2 className="text-xl md:text-2xl font-black mb-1 md:mb-2 flex items-center gap-2"><Radio className="text-primary w-5 h-5 md:w-6 md:h-6"/> Global Broadcast System</h2>
                <p className="text-gray-400 text-sm">Push announcements, greetings, and alerts instantly to every active POS client globally.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8">
              {/* Composer */}
              <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl lg:col-span-1 h-fit">
                <div className="flex justify-between items-center mb-4 md:mb-6">
                  <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                    <Plus className="text-primary w-6 h-6"/> {editingBroadcastId ? 'Edit Broadcast' : 'New Broadcast'}
                  </h3>
                  {editingBroadcastId && (
                    <button 
                      onClick={() => {
                        setEditingBroadcastId(null);
                        setNewBroadcast({ title: '', message: '', imageUrl: '', targetClients: [], targetRoles: [], file: null, allowReplies: true });
                      }}
                      className="text-xs text-gray-400 hover:text-white bg-gray-800 px-2 py-1 rounded"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <form onSubmit={handleCreateBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Title</label>
                    <input 
                      type="text" 
                      required
                      value={newBroadcast.title}
                      onChange={e => setNewBroadcast({...newBroadcast, title: e.target.value})}
                      placeholder="e.g. Happy Ugadi!"
                      className="w-full bg-background border border-border rounded-lg p-3 text-white focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Message</label>
                    <textarea 
                      required
                      value={newBroadcast.message}
                      onChange={e => setNewBroadcast({...newBroadcast, message: e.target.value})}
                      placeholder="e.g. Wishing you and your family a prosperous Ugadi!"
                      className="w-full bg-background border border-border rounded-lg p-3 text-white h-24 resize-none focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Target Shops (Optional)</label>
                    <div className="bg-background border border-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={newBroadcast.targetClients.length === 0}
                          onChange={() => setNewBroadcast({...newBroadcast, targetClients: []})}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-gray-300">All Shops (Global)</span>
                      </div>
                      {clients.map(c => (
                        <div key={c._id} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={newBroadcast.targetClients.includes(c._id)}
                            onChange={() => handleClientToggle(c._id)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{c.restaurantName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Target Roles</label>
                    <div className="flex gap-4">
                      {['Admin', 'Cashier', 'Captain'].map(role => (
                        <div key={role} className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            checked={newBroadcast.targetRoles.includes(role)}
                            onChange={() => handleRoleToggle(role)}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{role}</span>
                        </div>
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">If none selected, it sends to all roles.</span>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1 font-medium">Upload Media/File (Optional)</label>
                    <div className="relative">
                      <input 
                        type="file" 
                        accept="image/*,.apk,.ipa,.pdf"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="broadcast-image-upload"
                      />
                      <label 
                        htmlFor="broadcast-image-upload"
                        className="w-full bg-background border border-border border-dashed rounded-lg p-4 text-gray-400 hover:text-white hover:border-primary transition-colors flex flex-col items-center justify-center cursor-pointer min-h-[100px]"
                      >
                        {newBroadcast.imageUrl ? (
                          <div className="relative w-full h-36 rounded-lg bg-black/50 overflow-hidden flex items-center justify-center group">
                            <img src={newBroadcast.imageUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <span className="text-white text-xs font-semibold flex items-center gap-1.5 bg-gray-800/80 px-2.5 py-1.5 rounded-lg">
                                <Upload className="w-3.5 h-3.5"/> Change
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setNewBroadcast(prev => ({ ...prev, imageUrl: '', file: null }));
                                  const fileInput = document.getElementById('broadcast-image-upload');
                                  if (fileInput) fileInput.value = '';
                                }}
                                className="text-white text-xs font-semibold flex items-center gap-1.5 bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5"/> Remove
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNewBroadcast(prev => ({ ...prev, imageUrl: '', file: null }));
                                const fileInput = document.getElementById('broadcast-image-upload');
                                if (fileInput) fileInput.value = '';
                              }}
                              className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-600 text-white rounded-full transition-all shadow-md cursor-pointer group-hover:opacity-100 opacity-80"
                              title="Remove Image"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : newBroadcast.file ? (
                          <div className="relative w-full flex flex-col items-center justify-center text-primary py-2 group">
                             <ExternalLink className="w-6 h-6 mb-2" />
                             <span className="text-sm font-bold">{newBroadcast.file.name}</span>
                             <span className="text-xs mt-1 text-gray-400">{(newBroadcast.file.size / (1024*1024)).toFixed(2)} MB - Click to change</span>
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 setNewBroadcast(prev => ({ ...prev, file: null, imageUrl: '' }));
                                 const fileInput = document.getElementById('broadcast-image-upload');
                                 if (fileInput) fileInput.value = '';
                               }}
                               className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded border border-red-500/20"
                             >
                               <Trash2 className="w-3 h-3" /> Remove file
                             </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 mb-2" />
                            <span className="text-sm">Click to upload Image / APK / PDF</span>
                            <span className="text-xs opacity-50 mt-1">Max 50MB</span>
                          </>
                        )}
                      </label>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2 pb-2">
                    <input 
                      type="checkbox" 
                      id="allowReplies"
                      checked={newBroadcast.allowReplies}
                      onChange={(e) => setNewBroadcast({...newBroadcast, allowReplies: e.target.checked})}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                    />
                    <label htmlFor="allowReplies" className="text-sm font-medium">Allow shops to reply to this broadcast</label>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmittingBroadcast}
                    className="w-full bg-primary hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmittingBroadcast ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{editingBroadcastId ? 'Updating Broadcast...' : 'Broadcasting Now...'}</span>
                      </>
                    ) : (
                      <>
                        {editingBroadcastId ? <Edit3 className="w-5 h-5" /> : <Radio className="w-5 h-5" />}
                        <span>{editingBroadcastId ? 'Update Broadcast' : 'Broadcast Now'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* History */}
              <div className="bg-surface border border-border rounded-xl md:rounded-2xl p-4 md:p-6 shadow-xl lg:col-span-2">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4 md:mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg md:text-xl font-bold flex items-center gap-2">
                      <Activity className="w-5 h-5 text-blue-400"/> Active & Past Broadcasts
                    </h3>
                    {broadcasts.length > 0 && (
                      <span className="text-xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full border border-primary/20">
                        {filteredBroadcasts.length}{filteredBroadcasts.length !== broadcasts.length ? ` / ${broadcasts.length}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Right Side Controls: Date Filter + Compact Pagination + Refresh */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Date Filters */}
                    <div className="flex items-center gap-1 bg-background border border-border px-2 py-1 rounded-xl shadow-xs text-xs">
                      <Calendar className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <input
                        type="date"
                        value={broadcastStartDate}
                        onChange={(e) => {
                          setBroadcastStartDate(e.target.value);
                          setBroadcastPage(1);
                        }}
                        className="bg-transparent text-gray-200 border-none outline-none text-xs focus:ring-0 cursor-pointer"
                        title="Start Date"
                      />
                      <span className="text-gray-500 font-mono text-xs">to</span>
                      <input
                        type="date"
                        value={broadcastEndDate}
                        onChange={(e) => {
                          setBroadcastEndDate(e.target.value);
                          setBroadcastPage(1);
                        }}
                        className="bg-transparent text-gray-200 border-none outline-none text-xs focus:ring-0 cursor-pointer"
                        title="End Date"
                      />
                      {(broadcastStartDate || broadcastEndDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setBroadcastStartDate('');
                            setBroadcastEndDate('');
                            setBroadcastPage(1);
                          }}
                          className="p-0.5 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors cursor-pointer ml-0.5"
                          title="Clear date filter"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Compact Pagination Component */}
                    {filteredBroadcasts.length > BROADCASTS_PER_PAGE && (
                      <div className="flex items-center gap-1 bg-background border border-border px-2 py-1 rounded-xl shadow-xs text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setBroadcastPage(p => Math.max(1, p - 1))}
                          disabled={broadcastPage === 1 || loadingBroadcasts}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors cursor-pointer"
                          title="Previous Page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-gray-300 font-mono px-1.5 whitespace-nowrap">
                          {broadcastPage} / {totalBroadcastPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setBroadcastPage(p => Math.min(totalBroadcastPages, p + 1))}
                          disabled={broadcastPage === totalBroadcastPages || loadingBroadcasts}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 rounded transition-colors cursor-pointer"
                          title="Next Page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <button 
                      onClick={fetchBroadcasts} 
                      disabled={loadingBroadcasts} 
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                      title="Refresh Broadcasts"
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingBroadcasts ? 'animate-spin text-primary' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {loadingBroadcasts ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-background/50 border border-border rounded-xl">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                      <span className="text-sm font-medium">Fetching active & past broadcasts...</span>
                    </div>
                  ) : filteredBroadcasts.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 bg-background rounded-xl border border-border border-dashed">
                      <Radio className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      {broadcastStartDate || broadcastEndDate 
                        ? 'No broadcasts found for the selected date range.' 
                        : 'No broadcasts found. Create one to notify your clients.'}
                    </div>
                  ) : (
                    paginatedBroadcasts.map(b => (
                      <div key={b._id} className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all ${b.active ? 'bg-primary/5 border-primary/30' : 'bg-background border-border opacity-60'}`}>
                        {b.imageUrl && (
                          <div className="w-full sm:w-32 h-24 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0 flex items-center justify-center relative">
                            <img 
                              src={b.imageUrl} 
                              alt={b.title} 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                            <div className="hidden absolute inset-0 items-center justify-center text-red-400 flex-col gap-1">
                              <AlertTriangle className="w-6 h-6" />
                              <span className="text-[10px] uppercase font-bold tracking-wider">Broken Image</span>
                            </div>
                          </div>
                        )}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-lg">{b.title}</h4>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleBroadcast(b._id)} className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1 transition-colors ${b.active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                                  {b.active ? <CheckCircle className="w-3 h-3"/> : <XCircle className="w-3 h-3"/>}
                                  {b.active ? 'Active' : 'Inactive'}
                                </button>
                                <button onClick={() => deleteBroadcast(b._id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditBroadcast(b)} className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors cursor-pointer" title="Edit">
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <p className="text-gray-400 text-sm mb-2">{b.message}</p>
                            
                            {/* Targeted Shops & Roles Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/25">
                                <Globe className="w-3 h-3 text-blue-400 shrink-0" />
                                <span>Shops: <strong className="text-white font-bold">{getTargetShopNames(b)}</strong></span>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/25">
                                <Users className="w-3 h-3 text-purple-400 shrink-0" />
                                <span>Roles: <strong className="text-white font-bold">{b.targetRoles && b.targetRoles.length > 0 ? b.targetRoles.join(', ') : 'All Roles'}</strong></span>
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-2 font-mono">{new Date(b.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Replies Inbox */}
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-xl mt-8">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-green-400"/> Replies Inbox</h3>
              <div className="space-y-4">
                {replies.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 bg-background rounded-xl border border-border border-dashed">
                    No replies yet from any shops.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {replies.map(reply => (
                      <div key={reply._id} className="bg-background border border-border p-4 rounded-xl shadow">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-md text-white">{reply.clientId?.restaurantName || reply.shopName}</h4>
                            <p className="text-xs text-gray-400">{reply.senderUsername} ({reply.senderRole})</p>
                          </div>
                          <p className="text-xs text-gray-500 font-mono">{new Date(reply.createdAt).toLocaleString()}</p>
                        </div>
                        <p className="text-sm text-gray-300 mt-2 bg-surface/50 p-3 rounded-lg border border-border/50">
                          {reply.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                          <Radio className="w-3 h-3" /> Re: {reply.broadcastId?.title || 'Unknown Broadcast'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* License Edit Modal */}
      {licenseModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl max-w-md w-full my-auto flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-border bg-surface shrink-0">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white"><Key className="text-primary w-5 h-5"/> Edit License</h3>
              <button 
                onClick={() => setLicenseModal({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false, mapsUrl: '' })}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4 p-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">License Key</label>
                <input 
                  type="text" 
                  value={licenseModal.licenseKey}
                  onChange={(e) => setLicenseModal({...licenseModal, licenseKey: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white font-mono text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Expiration Date</label>
                <input 
                  type="date" 
                  value={licenseModal.validUntil}
                  onChange={(e) => setLicenseModal({...licenseModal, validUntil: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Assigned MongoDB Cluster</label>
                  <span className="text-[11px] font-mono text-cyan-400">
                    {clusterCounts[licenseModal.cluster || 'cluster0'] || 0}/10 used
                  </span>
                </div>
                <select 
                  value={licenseModal.cluster || 'cluster0'}
                  onChange={(e) => setLicenseModal({...licenseModal, cluster: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm font-medium focus:outline-none focus:border-primary"
                >
                  {CLUSTERS.map(cl => {
                    const count = clusterCounts[cl.id] || 0;
                    const isCurrent = (licenseModal.currentCluster || '').toLowerCase() === cl.id;
                    const isFull = count >= CLUSTER_MAX_CAPACITY && !isCurrent;
                    return (
                      <option 
                        key={cl.id} 
                        value={cl.id} 
                        disabled={isFull}
                        className={isFull ? 'text-gray-500 bg-gray-900' : 'text-white'}
                      >
                        {cl.label} — {count}/10 {isCurrent ? '(Current)' : isFull ? '⛔ FULL (Max 10)' : `(${CLUSTER_MAX_CAPACITY - count} slots available)`}
                      </option>
                    );
                  })}
                </select>
                {(clusterCounts[licenseModal.cluster || 'cluster0'] || 0) >= CLUSTER_MAX_CAPACITY && (licenseModal.currentCluster || '').toLowerCase() !== (licenseModal.cluster || '').toLowerCase() && (
                  <p className="text-[11px] text-red-400 mt-1 font-bold">⛔ Target cluster has reached the 10 restaurant limit.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Google Maps URL</label>
                <input 
                  type="url" 
                  placeholder="https://maps.google.com/..."
                  value={licenseModal.mapsUrl}
                  onChange={(e) => setLicenseModal({...licenseModal, mapsUrl: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white font-mono text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 bg-background p-3 rounded-lg border border-border">
                <input 
                  type="checkbox" 
                  id="resetHardware"
                  checked={licenseModal.resetHardware}
                  onChange={(e) => setLicenseModal({...licenseModal, resetHardware: e.target.checked})}
                  className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                />
                <label htmlFor="resetHardware" className="text-xs font-medium text-gray-300">Clear Hardware Binding (Allows install on new PC)</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-border bg-surface shrink-0">
              <button 
                onClick={() => setLicenseModal({ isOpen: false, clientId: null, licenseKey: '', validUntil: '', resetHardware: false, mapsUrl: '' })}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-gray-700 transition-colors text-xs font-bold text-white"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveLicense}
                className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg transition-colors text-white text-xs font-bold shadow-lg shadow-primary/20"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Client Modal */}
      {createClientModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-xl my-auto flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface shrink-0">
              <h2 className="text-lg sm:text-xl font-black flex items-center gap-2.5 text-white">
                <Users className="text-primary w-5 h-5" />
                Create New Client
              </h2>
              <button 
                type="button"
                onClick={() => setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', cluster: 'cluster0', staffAccounts: [] })} 
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateClient} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {/* 2-column grid for basic info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Restaurant Name (Used for DB)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Spice Garden"
                      value={createClientModal.restaurantName}
                      onChange={e => setCreateClientModal({...createClientModal, restaurantName: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Owner Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={createClientModal.ownerName}
                      onChange={e => setCreateClientModal({...createClientModal, ownerName: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      required
                      placeholder="owner@restaurant.com"
                      value={createClientModal.email}
                      onChange={e => setCreateClientModal({...createClientModal, email: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Password</label>
                    <input 
                      type="text" 
                      required
                      placeholder="••••••••••••"
                      value={createClientModal.password}
                      onChange={e => setCreateClientModal({...createClientModal, password: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">License Plan</label>
                    <select 
                      value={createClientModal.plan}
                      onChange={e => setCreateClientModal({...createClientModal, plan: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary font-medium transition-colors"
                    >
                      <option value="Monthly">Monthly (Demo - 30 Days)</option>
                      <option value="Yearly">Yearly</option>
                      <option value="Lifetime">Lifetime</option>
                      <option value="Custom">Custom (Specify Days)</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Target MongoDB Cluster</label>
                      <span className="text-[11px] font-mono text-cyan-400">
                        {clusterCounts[createClientModal.cluster || 'cluster0'] || 0}/10 used
                      </span>
                    </div>
                    <select 
                      value={createClientModal.cluster || 'cluster0'}
                      onChange={e => setCreateClientModal({...createClientModal, cluster: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary font-medium transition-colors"
                    >
                      {CLUSTERS.map(cl => {
                        const count = clusterCounts[cl.id] || 0;
                        const isFull = count >= CLUSTER_MAX_CAPACITY;
                        return (
                          <option 
                            key={cl.id} 
                            value={cl.id} 
                            disabled={isFull}
                            className={isFull ? 'text-gray-500 bg-gray-900' : 'text-white'}
                          >
                            {cl.label} — {count}/10 {isFull ? '⛔ FULL (Max 10 reached)' : `(${CLUSTER_MAX_CAPACITY - count} slots available)`}
                          </option>
                        );
                      })}
                    </select>
                    {(clusterCounts[createClientModal.cluster || 'cluster0'] || 0) >= CLUSTER_MAX_CAPACITY ? (
                      <p className="text-[11px] text-red-400 mt-1 font-bold">⛔ This cluster is full (10/10). Please select another cluster.</p>
                    ) : (
                      <p className="text-[11px] text-gray-500 mt-1">
                        Capacity: <span className="text-gray-300 font-semibold">{CLUSTER_MAX_CAPACITY - (clusterCounts[createClientModal.cluster || 'cluster0'] || 0)} slots remaining</span> (Max 10 restaurants per cluster enforced)
                      </p>
                    )}
                  </div>
                </div>

                {createClientModal.plan === 'Custom' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">Custom Days</label>
                    <input 
                      type="number" 
                      min="1" 
                      required
                      placeholder="e.g. 15, 45, 90"
                      value={createClientModal.customDays}
                      onChange={e => setCreateClientModal({...createClientModal, customDays: e.target.value})}
                      className="w-full bg-background border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                )}

                {/* Staff Accounts Dynamic Section */}
                <div className="border border-border p-3.5 rounded-xl bg-background/60">
                  <div className="flex justify-between items-center mb-2.5">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">POS Staff Accounts (Optional)</label>
                      <span className="text-[11px] text-gray-500">Add pre-configured staff logins</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setCreateClientModal({
                        ...createClientModal, 
                        staffAccounts: [...(createClientModal.staffAccounts || []), { role: 'Cashier', username: '', plainTextPassword: '' }]
                      })}
                      className="text-xs bg-primary/20 text-primary hover:bg-primary/30 px-2.5 py-1 rounded-lg font-bold transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Staff
                    </button>
                  </div>
                  {createClientModal.staffAccounts?.map((staff, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center border-b border-border/40 pb-2">
                      <div className="w-28 shrink-0">
                        <select 
                          value={staff.role} 
                          onChange={(e) => {
                            const newStaff = [...createClientModal.staffAccounts];
                            newStaff[index].role = e.target.value;
                            setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                          }}
                          className="w-full bg-surface border border-border rounded-lg p-2 text-xs text-white"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Cashier">Cashier</option>
                          <option value="Captain">Captain</option>
                          <option value="Waiter">Waiter</option>
                          <option value="KDS">KDS</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" placeholder="Username" required value={staff.username}
                          onChange={(e) => {
                            const newStaff = [...createClientModal.staffAccounts];
                            newStaff[index].username = e.target.value;
                            setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                          }}
                          className="w-full bg-surface border border-border rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" placeholder="Password" required value={staff.plainTextPassword}
                          onChange={(e) => {
                            const newStaff = [...createClientModal.staffAccounts];
                            newStaff[index].plainTextPassword = e.target.value;
                            setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                          }}
                          className="w-full bg-surface border border-border rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const newStaff = createClientModal.staffAccounts.filter((_, i) => i !== index);
                          setCreateClientModal({...createClientModal, staffAccounts: newStaff});
                        }}
                        className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove staff account"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {(!createClientModal.staffAccounts || createClientModal.staffAccounts.length === 0) && (
                    <p className="text-[11px] text-gray-500 italic py-1">No additional staff accounts added.</p>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3.5 border-t border-border bg-surface shrink-0 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setCreateClientModal({ isOpen: false, restaurantName: '', ownerName: '', email: '', password: '', plan: 'Yearly', customDays: '', cluster: 'cluster0', staffAccounts: [] })} 
                  className="flex-1 bg-background hover:bg-gray-800 text-white font-bold py-2.5 px-4 rounded-xl transition-all border border-border text-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2"
                >
                  Generate & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Features Toggle Modal */}
      {featuresModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-md w-full m-4">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Power className="text-primary w-5 h-5"/> Manage Features</h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {[
                { key: 'inventory', label: 'Inventory Management' },
                { key: 'kds', label: 'Kitchen Display (KDS)' },
                { key: 'crm', label: 'Customer CRM' },
                { key: 'staff', label: 'Staff HR' },
                { key: 'analytics', label: 'Analytics' },
                { key: 'daybook', label: 'DayBook' },
                { key: 'qrcode', label: 'QR Menu Generator' },
                { key: 'delivery', label: 'Delivery Orders' },
                { key: 'expenses', label: 'Petty Cash & Expenses' }
              ].map(feature => (
                <div key={feature.key} className="flex items-center justify-between bg-background p-3 rounded-lg border border-border">
                  <span className="text-sm font-bold text-gray-300">{feature.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={featuresModal.features[feature.key]}
                      onChange={(e) => setFeaturesModal({
                        ...featuresModal, 
                        features: { ...featuresModal.features, [feature.key]: e.target.checked }
                      })}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setFeaturesModal({ isOpen: false, clientId: null, features: {} })}
                className="px-4 py-2 bg-background border border-border rounded-lg hover:bg-gray-700 transition-colors text-sm font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveFeatures}
                className="px-4 py-2 bg-primary hover:bg-primary-hover rounded-lg transition-colors text-white text-sm font-bold shadow-lg shadow-primary/20"
              >
                Save Features
              </button>
            </div>
          </div>
        </div>
      )}
      {/* View & Manage Staff Modal */}
      {viewStaffModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-4 border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                  <Users className="text-primary w-5 h-5"/> Staff & User Accounts
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  Manage accounts for <span className="text-primary font-semibold">{viewStaffModal.restaurantName}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!staffFormModal.isOpen && (
                  <button
                    onClick={handleOpenAddStaff}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-primary/20"
                  >
                    <Plus size={15} /> Create New User
                  </button>
                )}
                <button
                  onClick={() => {
                    setViewStaffModal({ isOpen: false, clientId: null, staffAccounts: [], restaurantName: '' });
                    setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' });
                  }}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Create / Edit User Inline Form */}
            {staffFormModal.isOpen && (
              <div className="mb-5 bg-background border border-primary/30 p-4 rounded-xl shadow-lg animate-fade-in">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    {staffFormModal.isEdit ? (
                      <><Edit3 size={15} className="text-primary" /> Edit User Account ({staffFormModal.oldUsername})</>
                    ) : (
                      <><Plus size={15} className="text-primary" /> Create New User</>
                    )}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' })}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <form onSubmit={handleSaveStaffAccount} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. cashier1, chef_ramesh or email"
                      value={staffFormModal.username}
                      onChange={e => setStaffFormModal({ ...staffFormModal, username: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={showStaffPassword ? "text" : "password"}
                        required
                        placeholder="Enter password"
                        value={staffFormModal.password}
                        onChange={e => setStaffFormModal({ ...staffFormModal, password: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg p-2.5 pr-10 text-white text-sm focus:outline-none focus:border-primary font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-3 inset-y-0 flex items-center text-gray-400 hover:text-white"
                      >
                        {showStaffPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Role</label>
                    <select
                      value={staffFormModal.role}
                      onChange={e => setStaffFormModal({ ...staffFormModal, role: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-2.5 text-white text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="Cashier">Cashier (Can bill & print)</option>
                      <option value="Captain">Captain (Can take orders via tablet)</option>
                      <option value="Chef">Chef (Kitchen Display System Access Only)</option>
                      <option value="Manager">Manager (Operations, Floor, Analytics)</option>
                      <option value="Admin">Admin (Full Control)</option>
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      disabled={staffLoading}
                      onClick={() => setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' })}
                      className="px-3 py-1.5 bg-surface hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={staffLoading}
                      className="px-4 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-bold transition-colors shadow-md shadow-primary/20 flex items-center gap-1.5"
                    >
                      {staffLoading && <Loader2 size={13} className="animate-spin" />}
                      {staffFormModal.isEdit ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Staff List */}
            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[50vh]">
              {viewStaffModal.staffAccounts.length === 0 ? (
                <div className="text-center py-8 bg-background/50 rounded-xl border border-dashed border-border p-6">
                  <Users className="w-10 h-10 text-gray-500 mx-auto mb-2 opacity-50" />
                  <p className="text-gray-400 font-medium text-sm">No staff accounts configured yet.</p>
                  <p className="text-xs text-gray-500 mt-1">Click "Create New User" above to add cashier, captain, chef or admin accounts.</p>
                </div>
              ) : (
                viewStaffModal.staffAccounts.map((staff, idx) => {
                  const roleColors = {
                    Admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
                    Manager: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
                    Cashier: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
                    Captain: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
                    Chef: 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                  };
                  const badgeClass = roleColors[staff.role] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';

                  return (
                    <div key={idx} className="bg-background border border-border hover:border-gray-600 transition-colors p-3.5 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-white truncate">{staff.username}</span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeClass}`}>
                            {staff.role || 'Staff'}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-gray-400 flex items-center gap-1.5">
                          <Key size={12} className="text-gray-500" />
                          <span>Password:</span>
                          <span className="text-gray-200 font-bold bg-surface px-1.5 py-0.5 rounded border border-border/50 select-all">
                            {staff.plainTextPassword || '******'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleOpenEditStaff(staff, idx)}
                          className="p-1.5 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors"
                          title="Edit User"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteStaffAccount(staff, idx)}
                          className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                          title="Delete User"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center mt-5 pt-3 border-t border-border">
              <span className="text-xs text-gray-400">
                Total: <strong className="text-white">{viewStaffModal.staffAccounts.length}</strong> user accounts
              </span>
              <button 
                onClick={() => {
                  setViewStaffModal({ isOpen: false, clientId: null, staffAccounts: [], restaurantName: '' });
                  setStaffFormModal({ isOpen: false, isEdit: false, staffId: null, oldUsername: '', username: '', password: '', role: 'Cashier' });
                }}
                className="px-4 py-2 bg-surface hover:bg-gray-700 rounded-lg transition-colors text-white text-xs font-bold border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Map Modal */}
      {mapModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2 text-white"><MapPin className="text-blue-400 w-6 h-6"/> Clients in {mapModal.locationName}</h3>
              <button 
                onClick={() => setMapModal({ isOpen: false, locationName: '', clients: [] })}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 rounded-xl overflow-hidden border border-border bg-gray-900 relative">
              {mapModal.clients.length > 0 && mapModal.clients[0].location ? (
                <MapContainer center={[mapModal.clients[0].location.lat, mapModal.clients[0].location.lon]} zoom={12} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapModal.clients.map((client, idx) => {
                    if (!client.location) return null;
                    // Add a tiny deterministic jitter (approx 200m-500m) so pins from the same city IP don't stack perfectly on top of each other
                    const jitterLat = client.location.lat + (idx * 0.002) * (idx % 2 === 0 ? 1 : -1);
                    const jitterLon = client.location.lon + (idx * 0.003) * (idx % 3 === 0 ? 1 : -1);
                    return (
                      <Marker key={client._id} position={[jitterLat, jitterLon]}>
                        <Popup>
                          <div className="text-gray-900 font-sans">
                              <strong className="text-base">{client.restaurantName}</strong><br/>
                              <span className="text-xs text-gray-500">{client.email}</span><br/>
                              <span className={`text-xs font-bold ${client.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{client.status}</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">Location data unavailable for rendering map.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Logout Confirmation Toast Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-10 sm:pt-14 px-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface border border-border rounded-2xl shadow-2xl p-5 sm:p-6 w-full max-w-sm transform transition-all">
            <div className="flex flex-col items-center text-center">
              <p className="text-white font-medium text-base mb-6">
                Are you sure you want to logout <span className="font-bold">{adminUser?.name || 'Admin'}</span>?
              </p>
              <div className="flex w-full gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 px-4 bg-background hover:bg-border text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    handleLogout();
                  }}
                  className="flex-1 py-2.5 px-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
