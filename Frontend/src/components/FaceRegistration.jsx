import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, X, Check, Loader2 } from 'lucide-react';

const FaceRegistration = ({ staff, onSave, onClose }) => {
  const videoRef = useRef();
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models')
        ]);
        setIsModelsLoaded(true);
        startVideo();
      } catch (err) {
        console.error("Error loading face-api models", err);
        setError("Failed to load AI models. Please ensure they are downloaded.");
      }
    };
    loadModels();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not access webcam. Please check permissions.");
      });
  };

  const captureFace = async () => {
    if (!videoRef.current) return;
    setIsDetecting(true);
    
    try {
      const detection = await faceapi.detectSingleFace(
        videoRef.current,
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceLandmarks().withFaceDescriptor();

      if (detection) {
        setFaceDescriptor(Array.from(detection.descriptor));
      } else {
        alert("No face detected. Please look directly at the camera in good lighting.");
      }
    } catch (err) {
      console.error(err);
      alert("Error detecting face.");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSave = () => {
    if (faceDescriptor) {
      onSave(faceDescriptor);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-surface p-6 rounded-2xl w-full max-w-md border border-border shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Camera className="text-primary" /> Register Face
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:bg-background rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-text-muted mb-4">
          Registering face for <strong>{staff.name}</strong>
        </p>

        {error ? (
          <div className="bg-danger/10 text-danger p-4 rounded-xl text-sm">{error}</div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-inner">
              {!isModelsLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50">
                  <Loader2 className="animate-spin mb-2" />
                  <span className="text-sm">Loading AI Models...</span>
                </div>
              )}
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                className={`w-full h-full object-cover ${!isModelsLoaded ? 'opacity-0' : 'opacity-100'}`}
              />
              
              {/* Overlay guides */}
              <div className="absolute inset-0 pointer-events-none border-2 border-white/20 rounded-xl m-8" style={{ borderStyle: 'dashed' }}></div>
            </div>

            {faceDescriptor ? (
              <div className="w-full bg-success/10 text-success p-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold">
                <Check size={18} /> Face mapped successfully!
              </div>
            ) : (
              <button 
                onClick={captureFace}
                disabled={!isModelsLoaded || isDetecting}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDetecting ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
                {isDetecting ? 'Scanning...' : 'Capture Face'}
              </button>
            )}

            {faceDescriptor && (
              <button 
                onClick={handleSave}
                className="w-full py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-colors shadow-lg shadow-green-500/20"
              >
                Save Face Data
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceRegistration;
