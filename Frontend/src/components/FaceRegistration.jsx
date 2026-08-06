import { useLanguage } from "../context/LanguageContext";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, Check, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { loadFaceModels, resetFaceModels, captureMultipleDescriptors } from '../services/faceService';
import { requestCameraPermissions } from '../services/permissionsService';

const FaceRegistration = ({ staff, onSave, onClose }) => {
  const { t } = useLanguage();
  const videoRef = useRef();
  const streamRef = useRef(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [captureProgress, setCaptureProgress] = useState(0);
  const [faceDescriptors, setFaceDescriptors] = useState(null);
  const [error, setError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Loading AI Models...');

  const isMountedRef = useRef(true);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startVideo = useCallback(async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      if (isMountedRef.current) {
        setError('Camera permission denied. Please grant camera access in your device settings and try again.');
      }
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (!isMountedRef.current) {
        // Component was unmounted while camera was starting - stop it immediately
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('[FaceRegistration] Camera error:', err);
      if (isMountedRef.current) {
        if (err.name === 'NotAllowedError') {
          setError('Camera access was denied. Please allow camera permissions in your device settings.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found. Please connect a camera and try again.');
        } else {
          setError('Could not access the camera. Please check permissions and try again.');
        }
      }
    }
  }, []);

  const initModels = useCallback(async () => {
    setError(null);
    setIsRetrying(false);
    setIsModelsLoaded(false);
    setLoadingStatus('Loading AI Models...');

    try {
      await loadFaceModels();
      if (!isMountedRef.current) return;
      setIsModelsLoaded(true);
      setLoadingStatus('Starting camera...');
      await startVideo();
    } catch (err) {
      console.error('[FaceRegistration] Model load error:', err);
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load AI models. Please ensure they are downloaded.');
      }
    }
  }, [startVideo]);

  useEffect(() => {
    isMountedRef.current = true;
    initModels();
    return () => {
      isMountedRef.current = false;
      stopStream();
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    resetFaceModels(); // Allow re-loading
    stopStream();
    setFaceDescriptors(null);
    await initModels();
    if (isMountedRef.current) {
      setIsRetrying(false);
    }
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setIsDetecting(true);
    setError(null);
    setCaptureProgress(0);

    try {
      // Capture 15 frames for robust embedding
      const descriptors = await captureMultipleDescriptors(videoRef.current, 15, (current, total) => {
        setCaptureProgress(Math.round((current / total) * 100));
      });
      setFaceDescriptors(descriptors);
    } catch (err) {
      console.error('[FaceRegistration] Capture error:', err);
      setError(err.message || 'Error detecting face. Please ensure your face is fully visible and well-lit.');
    } finally {
      setIsDetecting(false);
      setCaptureProgress(0);
    }
  };

  const handleSave = () => {
    if (faceDescriptors) {
      onSave(faceDescriptors);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-100 backdrop-blur-sm">
      <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="text-primary" />{t("Register Face")}
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:bg-background rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-text-muted mb-4">{t("Registering face for")}
          <strong> {staff.name}</strong>
        </p>

        {error ? (
          <div className="flex flex-col gap-3">
            <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm flex items-start gap-3">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            >
              {isRetrying ? (
                <><Loader2 className="animate-spin" size={18} /> {t('Retrying...')}</>
              ) : (
                <><RefreshCw size={18} /> {t('Retry')}</>
              )}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
              {!isModelsLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-black z-10">
                  <Loader2 className="animate-spin mb-2" />
                  <span className="text-sm">{t(loadingStatus)}</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                muted
                className={`w-full h-full object-cover ${!isModelsLoaded ? 'opacity-0' : 'opacity-100'}`} />
            
              {/* Overlay guides */}
              <div className="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-xl m-8" style={{ borderStyle: 'dashed' }}></div>
              
              {isDetecting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <div className="text-white text-center">
                    <Loader2 className="animate-spin mx-auto mb-2" size={32} />
                    <p className="font-bold">{captureProgress}%</p>
                    <p className="text-sm opacity-80">Please move head slightly...</p>
                  </div>
                </div>
              )}
            </div>

            {faceDescriptors ? (
              <div className="w-full bg-success/10 text-success p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold">
                <Check size={18} />{t("Face mapped successfully!")}
              </div>
            ) : (
              <button
                onClick={captureFace}
                disabled={!isModelsLoaded || isDetecting}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDetecting ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                {isDetecting ? 'Scanning...' : 'Start Capture'}
              </button>
            )}

            {faceDescriptors && (
              <button
                onClick={handleSave}
                className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
              >{t("Save Face Data")}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;