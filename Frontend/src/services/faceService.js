import * as faceapi from 'face-api.js';

let modelsLoaded = false;

/**
 * Detect the correct models base URL depending on the platform:
 * - Electron (Desktop EXE): served from file:// so /models resolves via Electron's local server
 * - Capacitor (Android APK): assets are served from capacitor://localhost/ — /models maps correctly
 * - Browser (Web): /models resolves from the public folder
 */
const getModelsUri = () => {
  // Capacitor native platform — models are bundled in the APK assets
  // Capacitor serves the web app from capacitor://localhost/ and /models maps to public/models
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'capacitor:') {
    return '/models';
  }

  // Electron (file:// protocol)
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    return './models';
  }

  // Default: browser or Vite dev server
  return '/models';
};

export const loadFaceModels = async () => {
  if (modelsLoaded) return;

  const primaryPath = getModelsUri();

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(primaryPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(primaryPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(primaryPath)
    ]);
    modelsLoaded = true;
    console.log('[FaceService] AI models loaded successfully from:', primaryPath);
    return;
  } catch (primaryErr) {
    console.warn('[FaceService] Primary path failed, trying fallback paths...', primaryErr);
  }

  // Fallback 1: try relative path
  const fallbackPath = './models';
  if (fallbackPath !== primaryPath) {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(fallbackPath),
        faceapi.nets.faceLandmark68Net.loadFromUri(fallbackPath),
        faceapi.nets.faceRecognitionNet.loadFromUri(fallbackPath)
      ]);
      modelsLoaded = true;
      console.log('[FaceService] AI models loaded from fallback path:', fallbackPath);
      return;
    } catch (fallbackErr) {
      console.warn('[FaceService] Fallback path also failed.', fallbackErr);
    }
  }

  // All paths failed
  modelsLoaded = false;
  throw new Error('Failed to load AI models. Please ensure the app has internet access or re-install.');
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
