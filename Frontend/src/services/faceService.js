import * as faceapi from 'face-api.js';
import { getApiUrl } from '../config.js';

let modelsLoaded = false;

export const loadFaceModels = async () => {
  if (modelsLoaded) return;

  const candidatePaths = [];

  // 1. POS Backend Server models URL over HTTP (e.g. http://127.0.0.1:5002/models or http://192.168.x.x:5002/models)
  try {
    const backendApi = getApiUrl();
    if (backendApi) {
      const backendBase = backendApi.replace(/\/api\/?$/, '');
      candidatePaths.push(`${backendBase}/models`);
    }
  } catch (e) {
    console.warn('[FaceService] Could not resolve backend URL for models:', e);
  }

  // 2. Current origin / relative location
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.protocol !== 'file:') {
      candidatePaths.push(window.location.origin + '/models');
    }
    const cleanHref = window.location.href.split('?')[0].split('#')[0];
    const baseDir = cleanHref.substring(0, cleanHref.lastIndexOf('/'));
    candidatePaths.push(baseDir + '/models');
  }
  candidatePaths.push('./models');
  candidatePaths.push('/models');

  // 3. High-availability CDN Fallbacks
  candidatePaths.push('https://cdn.jsdelivr.net/gh/cshly/face-api.js-models@master/models');
  candidatePaths.push('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights');

  const uniquePaths = [...new Set(candidatePaths.filter(Boolean))];

  for (const pathUri of uniquePaths) {
    try {
      console.log('[FaceService] Attempting to load AI models from:', pathUri);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(pathUri),
        faceapi.nets.faceLandmark68Net.loadFromUri(pathUri),
        faceapi.nets.faceRecognitionNet.loadFromUri(pathUri)
      ]);
      modelsLoaded = true;
      console.log('[FaceService] AI models loaded successfully from:', pathUri);
      return;
    } catch (err) {
      console.warn(`[FaceService] Failed to load AI models from ${pathUri}, trying next candidate...`, err?.message || err);
    }
  }

  modelsLoaded = false;
  throw new Error(`Failed to load AI models from ${uniquePaths[0] || './models'}. Please ensure the app has internet access or local server is running.`);
};

/**
 * Reset the model loaded state — allows retry after failure
 */
export const resetFaceModels = () => {
  modelsLoaded = false;
};

export const captureMultipleDescriptors = async (videoElement, count = 10, onProgress = null) => {
  const descriptors = [];
  
  for (let i = 0; i < count; i++) {
    const detection = await faceapi.detectSingleFace(
      videoElement,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }) // smaller input for faster detection
    ).withFaceLandmarks().withFaceDescriptor();

    if (detection) {
      descriptors.push(Array.from(detection.descriptor));
      if (onProgress) onProgress(i + 1, count);
    }
    // minimal delay to allow frame to update
    await new Promise(res => setTimeout(res, 100)); 
  }
  
  if (descriptors.length === 0) {
    throw new Error('No faces detected. Please ensure your face is clearly visible and well-lit.');
  }
  
  return descriptors;
};

// Computes Euclidean distance between two descriptors
export const euclideanDistance = (desc1, desc2) => {
  return Math.sqrt(desc1.reduce((sum, val, i) => sum + Math.pow(val - desc2[i], 2), 0));
};
