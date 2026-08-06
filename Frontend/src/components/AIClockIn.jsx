import { useLanguage } from "../context/LanguageContext";import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, X, Loader2, CheckCircle2, UserCircle, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { getPublicStaff, clockInOut } from '../api/staff';
import { loadFaceModels, resetFaceModels } from '../services/faceService';

const AIClockIn = ({ onBack }) => {const { t } = useLanguage();
  const videoRef = useRef();
  const streamRef = useRef(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [faceMatcher, setFaceMatcher] = useState(null);

  const [error, setError] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Loading AI...');
  const [recognitionError, setRecognitionError] = useState(null);

  const [matchedStaff, setMatchedStaff] = useState(null);
  const [actionSelection, setActionSelection] = useState(false); // When true, asks Clock In or Clock Out
  const [successMsg, setSuccessMsg] = useState(null);

  const [usePinFallback, setUsePinFallback] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);

  // Clear recognition error on navigation or panel state change
  useEffect(() => {
    if (usePinFallback || actionSelection || successMsg) {
      setRecognitionError(null);
    }
  }, [usePinFallback, actionSelection, successMsg]);

  // 1. Load models and staff on mount
  const initAI = async () => {
    try {
      // Use centralized faceService which handles Capacitor/Electron/Browser path resolution
      await loadFaceModels();

      setIsModelsLoaded(true);
      setStatusMsg('Initializing Camera...');

      // Fetch all staff and their face descriptors (public)
      const tenantDb = localStorage.getItem('resto_db_name');
      const data = await getPublicStaff(tenantDb);
      setStaffList(data);

      // Build FaceMatcher
      const labeledDescriptors = [];
      data.forEach((s) => {
        if (s.faceDescriptors && s.faceDescriptors.length > 0) {
          const descriptors = s.faceDescriptors.map(desc => new Float32Array(desc));
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(s._id, descriptors)
          );
        }
      });

      if (labeledDescriptors.length > 0) {
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.45));
      }

      await startVideo();
    } catch (err) {
      console.error("AI Error:", err);
      if (isMountedRef.current) {
        setError(err.message || "Failed to initialize AI or Camera. Please check permissions and try again.");
      }
    }
  };

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    initAI();
    return () => {
      isMountedRef.current = false;
      stopVideo();
    };
  }, []);

  const startVideo = async () => {
    try {
      const { requestCameraPermissions } = await import('../services/permissionsService.js');
      const hasPermission = await requestCameraPermissions();
      if (!hasPermission) {
        if (isMountedRef.current) {
          setError("Camera permission denied. Please use PIN Fallback.");
        }
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!isMountedRef.current) {
        // Unmounted during getUserMedia resolve - stop camera immediately
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      if (isMountedRef.current) {
        setStatusMsg('Looking for faces...');
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError("Camera permission denied. Please use PIN Fallback.");
      }
    }
  };

  const stopVideo = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Continuous face detection loop
  useEffect(() => {
    if (!isModelsLoaded || !faceMatcher || actionSelection || successMsg || usePinFallback || error) return;

    let interval;
    // We maintain an array of recent detections to ensure recognition across consecutive frames
    const recentRecognitions = [];

    const detect = async () => {
      if (!videoRef.current) return;

      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        const match = faceMatcher.findBestMatch(detection.descriptor);
        if (match.label !== 'unknown' && match.distance < 0.45) {
          recentRecognitions.push(match.label);
          if (recentRecognitions.length > 3) recentRecognitions.shift();
          
          // Require 3 consecutive frames of the same person
          if (recentRecognitions.length === 3 && recentRecognitions.every(l => l === match.label)) {
            const staff = staffList.find((s) => s._id === match.label);
            if (staff) {
              setCapturedImage(capturePhoto());
              setMatchedStaff(staff);
              setActionSelection(true); // Pause detection, show options
              recentRecognitions.length = 0; // Clear
              setRecognitionError(null);
            }
          }
        } else {
          recentRecognitions.length = 0; // Reset if unknown
          setRecognitionError('Face is not registered. Please check.');
        }
      } else {
        recentRecognitions.length = 0;
        setRecognitionError(null);
      }
    };

    const startDetecting = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(detect, 300); // Faster interval for continuous checks
    };

    if (videoRef.current && !videoRef.current.paused) {
      startDetecting();
    }

    videoRef.current?.addEventListener('play', startDetecting);

    return () => {
      clearInterval(interval);
      videoRef.current?.removeEventListener('play', startDetecting);
    };
  }, [isModelsLoaded, faceMatcher, actionSelection, successMsg, usePinFallback, staffList, error]);

  const capturePhoto = () => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleAction = async (action) => {
    try {
      const photo = capturedImage;
      await clockInOut({ staffId: matchedStaff._id, action, photo });

      setSuccessMsg(`Successfully ${action === 'clockIn' ? 'Clocked In' : 'Clocked Out'}!`);
      setActionSelection(false);

      // Reset after 3 seconds
      setTimeout(() => {
        setSuccessMsg(null);
        setMatchedStaff(null);
      }, 3000);

    } catch (err) {
      alert(err.response?.data?.message || 'Error recording attendance');
      setActionSelection(false);
      setMatchedStaff(null);
      setCapturedImage(null);
    }
  };

  const handlePinSubmit = async () => {
    try {
      const photo = capturePhoto();
      // Wait, we need to know if it's clocking in or out via PIN?
      // PIN fallback will also ask for action
      const staff = staffList.find((s) => s.pin === pinInput);
      if (!staff) {
        alert("Invalid PIN");
        setPinInput('');
        return;
      }
      
      setCapturedImage(photo);
      // If PIN is correct, show the Clock In/Out buttons!
      setMatchedStaff(staff);
      setActionSelection(true);
      setPinInput('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col z-[100] text-white">
      {/* Header */}
      <div className="p-6 bg-slate-800 flex justify-between items-center shadow-lg">
        <button onClick={onBack} className="p-3 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-2xl font-black text-center flex-1 tracking-tight">{t("Staff Attendance Kiosk")}</h1>
        <div className="w-12"></div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-900">
        
        {successMsg ?
        <div className="flex flex-col items-center animate-in zoom-in duration-300">
            <div className="w-32 h-32 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(34,197,94,0.4)]">
              <CheckCircle2 size={64} className="text-white" />
            </div>
            <h2 className="text-4xl font-black text-white">{successMsg}</h2>
            <p className="text-slate-400 mt-4 text-xl">{t("Have a great day!")}</p>
          </div> :
        actionSelection && matchedStaff ?
        <div className="bg-slate-800 p-10 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-md animate-in slide-in-from-bottom-8 flex flex-col items-center">
            <div className="w-24 h-24 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-4">
              <UserCircle size={64} />
            </div>
            <h2 className="text-3xl font-black mb-2 text-center text-white">{t("Hi,")}{matchedStaff.name}</h2>
            <p className="text-slate-400 mb-8 text-center text-lg">{matchedStaff.role}</p>
            
            <div className="w-full flex gap-4">
              <button onClick={() => handleAction('clockIn')} className="flex-1 py-4 bg-success text-white rounded-2xl font-black text-xl hover:opacity-90 shadow-[0_0_30px_rgba(34,197,94,0.3)] transition-all">{t("Clock In")}</button>
              <button onClick={() => handleAction('clockOut')} className="flex-1 py-4 bg-gray-500 text-white rounded-2xl font-black text-xl hover:opacity-90 transition-all">{t("Clock Out")}</button>
            </div>
            <button onClick={() => {setActionSelection(false);setMatchedStaff(null);setCapturedImage(null);}} className="mt-8 text-slate-400 hover:text-white transition-colors">{t("Cancel")}</button>
          </div> :
        usePinFallback ?
        <div className="bg-slate-800 p-8 rounded-3xl shadow-2xl border border-slate-700 w-full max-w-sm flex flex-col items-center">
            <KeyRound size={48} className="text-orange-500 mb-6" />
            <h2 className="text-2xl font-black mb-6">{t("Enter PIN")}</h2>
            <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-center text-4xl font-mono p-4 rounded-2xl text-white mb-6 tracking-widest focus:ring-2 focus:ring-orange-500 focus:outline-none"
            maxLength="4"
            autoFocus />
          
            <div className="w-full flex gap-4">
              <button onClick={() => setUsePinFallback(false)} className="flex-1 py-3 bg-slate-700 rounded-xl font-bold">{t("Cancel")}</button>
              <button onClick={handlePinSubmit} className="flex-1 py-3 bg-orange-500 rounded-xl font-bold">{t("Verify")}</button>
            </div>
          </div> :

        <div className="flex flex-col items-center max-w-4xl w-full">
            <div className="relative w-full max-w-2xl aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700">
              
              {!isModelsLoaded && !error &&
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 bg-slate-900 z-10">
                  <Loader2 className="animate-spin mb-4" size={48} />
                  <span className="text-xl font-bold">{statusMsg}</span>
                </div>
            }
              
              {error &&
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10 p-6 text-center">
                  <Camera className="text-red-500 mb-4" size={48} />
                  <span className="text-red-500 font-bold mb-4 text-sm">{error}</span>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => { resetFaceModels(); setError(null); setIsModelsLoaded(false); setStatusMsg('Loading AI...'); initAI(); }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm flex items-center gap-2"
                    >
                      <RefreshCw size={14} /> {t("Retry")}
                    </button>
                    <button onClick={() => setUsePinFallback(true)} className="px-4 py-2 bg-slate-700 text-white rounded-xl font-bold text-sm">{t("Use PIN Instead")}</button>
                  </div>
                </div>
            }

              <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-cover transform scale-x-[-1]" />
            
              
              {/* Scan HUD Overlay */}
              {isModelsLoaded && !error &&
            <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
                  <div className="w-64 h-64 border-2 border-primary/50 rounded-full relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_var(--primary)]"></div>
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_var(--primary)]"></div>
                    <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_var(--primary)]"></div>
                    <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-[0_0_20px_var(--primary)]"></div>
                  </div>
                </div>
            }
            </div>

            <div className="mt-8 flex flex-col items-center">
              {recognitionError ? (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-6 py-2 rounded-full text-base font-bold mb-4 animate-pulse">
                  {t(recognitionError)}
                </div>
              ) : (
                <p className="text-slate-400 text-lg mb-4">{t(statusMsg)}</p>
              )}
              {!error &&
            <button
              onClick={() => setUsePinFallback(true)}
              className="px-8 py-3 border border-slate-600 text-slate-300 hover:bg-slate-800 rounded-full font-bold transition-colors flex items-center gap-2">
              
                  <KeyRound size={18} />{t("Face not recognized? Use PIN")}
            </button>
            }
            </div>
          </div>
        }
      </div>
    </div>);

};

export default AIClockIn;