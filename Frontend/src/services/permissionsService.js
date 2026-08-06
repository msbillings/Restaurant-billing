import { Capacitor } from '@capacitor/core';

const setPermStorage = (key, value) => {
  try { localStorage.setItem(`ms_perm_${key}`, value); } catch {}
};

const getPermStorage = (key) => {
  try { return localStorage.getItem(`ms_perm_${key}`); } catch { return null; }
};

/**
 * Opens the app's permission settings page on Android/iOS
 * so the user can manually grant a denied permission.
 */
const openAppSettings = async () => {
  try {
    // @capacitor/app has openUrl for deep links, but for settings we use NativeSettings or App
    // Try using the App plugin to open settings if available
    const { App } = await import('@capacitor/app');
    // On Android, this opens the app's info page where user can manage permissions
    await App.openUrl({ url: 'app-settings:' });
  } catch {
    try {
      // Fallback: try opening Android settings directly
      const { App } = await import('@capacitor/app');
      await App.openUrl({ url: 'android.settings.APPLICATION_DETAILS_SETTINGS' });
    } catch (err) {
      console.warn('Could not open app settings:', err);
    }
  }
};

/**
 * Request camera permission.
 * On Capacitor (APK): Uses the Capacitor Camera plugin's native dialog.
 * On browser/Electron: Uses the Web getUserMedia API.
 * Returns true if granted, false otherwise.
 */
export const requestCameraPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      
      const current = await Camera.checkPermissions();
      if (current.camera === 'granted') {
        setPermStorage('camera', 'granted');
        return true;
      }
      
      if (current.camera === 'denied') {
        console.warn('[Permissions] Camera permanently denied on device — user must open Settings.');
        return false;
      }
      
      const permission = await Camera.requestPermissions();
      const granted = permission.camera === 'granted' || permission.camera === 'prompt-with-rationale';
      if (granted) setPermStorage('camera', 'granted');
      return granted;
    } catch (error) {
      console.warn("Capacitor camera plugin failed.", error);
      return false;
    }
  } else {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setPermStorage('camera', 'granted');
        return true;
      }
      setPermStorage('camera', 'granted');
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermStorage('camera', 'granted');
        return true;
      }
      console.error("Web camera permission denied", error);
      return false;
    }
  }
};

/**
 * Check current camera permission status without requesting.
 * Returns 'granted', 'denied', or 'prompt'.
 */
export const checkCameraPermission = async () => {
  if (getPermStorage('camera') === 'granted') return 'granted';
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      const result = await Camera.checkPermissions();
      return result.camera;
    } catch { return 'prompt'; }
  } else {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state;
      }
      return 'prompt';
    } catch { return 'prompt'; }
  }
};

export const requestMicPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const canRecord = await VoiceRecorder.hasAudioRecordingPermission();
      if (canRecord.value) {
        setPermStorage('mic', 'granted');
        return true;
      }
      const permission = await VoiceRecorder.requestAudioRecordingPermission();
      if (permission.value) {
        setPermStorage('mic', 'granted');
        return true;
      }
      setPermStorage('mic', 'denied');
      return false;
    } catch (e) {
      console.warn("Native mic permission failed:", e);
      return false;
    }
  } else {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermStorage('mic', 'granted');
        return true;
      }
      setPermStorage('mic', 'granted');
      return true;
    } catch (error) {
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setPermStorage('mic', 'granted');
        return true;
      }
      console.error("Mic permission denied", error);
      return false;
    }
  }
};


export const requestLocationPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const current = await Geolocation.checkPermissions();
      if (current.location === 'granted' || current.location === 'coarse') {
        setPermStorage('location', 'granted');
        return true;
      }
      const permission = await Geolocation.requestPermissions();
      const granted = permission.location === 'granted' || permission.location === 'coarse';
      if (granted) setPermStorage('location', 'granted');
      return granted;
    } catch (error) {
      console.warn("Capacitor geolocation plugin failed.", error);
      return false;
    }
  } else {
    try {
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { 
            timeout: 8000,
            maximumAge: 60000,
            enableHighAccuracy: false
          });
        });
        setPermStorage('location', 'granted');
        return true;
      }
      setPermStorage('location', 'granted');
      return true;
    } catch (error) {
      if (error && error.code !== 1) {
        console.warn("Location hardware unavailable on PC, but permission allowed.");
        setPermStorage('location', 'granted');
        return true;
      }
      console.error("Location permission denied", error);
      return false;
    }
  }
};

export const requestNotificationPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const current = await LocalNotifications.checkPermissions();
      if (current.display === 'granted') {
        setPermStorage('notifications', 'granted');
        return true;
      }
      const permission = await LocalNotifications.requestPermissions();
      const granted = permission.display === 'granted';
      if (granted) setPermStorage('notifications', 'granted');
      return granted;
    } catch (error) {
      console.warn("Capacitor notifications plugin failed.", error);
      return false;
    }
  } else {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          setPermStorage('notifications', 'granted');
          return true;
        }
        const permission = await Notification.requestPermission();
        const granted = permission === 'granted' || Notification.permission === 'granted';
        if (granted) setPermStorage('notifications', 'granted');
        return granted;
      }
      setPermStorage('notifications', 'granted');
      return true;
    } catch (error) {
      console.error("Notification permission denied", error);
      return false;
    }
  }
};

/**
 * Check all permission statuses at once.
 * Returns an object with keys: camera, mic, location, notifications
 * Each value is 'granted', 'denied', or 'prompt'.
 */
export const checkAllPermissions = async () => {
  const results = {
    camera: getPermStorage('camera') || 'prompt',
    mic: getPermStorage('mic') || 'prompt',
    location: getPermStorage('location') || 'prompt',
    notifications: getPermStorage('notifications') || 'prompt'
  };

  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      const cam = await Camera.checkPermissions();
      if (cam.camera) results.camera = cam.camera;
    } catch {/* ignore */}

    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const geo = await Geolocation.checkPermissions();
      if (geo.location) results.location = (geo.location === 'granted' || geo.location === 'coarse') ? 'granted' : geo.location;
    } catch {/* ignore */}

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notif = await LocalNotifications.checkPermissions();
      if (notif.display) results.notifications = notif.display;
    } catch {/* ignore */}

    try {
      const { VoiceRecorder } = await import('capacitor-voice-recorder');
      const canRecord = await VoiceRecorder.hasAudioRecordingPermission();
      if (canRecord.value) results.mic = 'granted';
    } catch {/* ignore */}
  } else {
    // Browser / Electron
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const cam = await navigator.permissions.query({ name: 'camera' });
          if (cam) results.camera = cam.state;
        } catch {}

        try {
          const mic = await navigator.permissions.query({ name: 'microphone' });
          if (mic) results.mic = mic.state;
        } catch {}

        try {
          const loc = await navigator.permissions.query({ name: 'geolocation' });
          if (loc) results.location = loc.state;
        } catch {}
      }
    } catch {/* ignore */}

    try {
      if ('Notification' in window) {
        const p = Notification.permission;
        if (p === 'granted') results.notifications = 'granted';
        else if (p === 'denied') results.notifications = 'denied';
      }
    } catch {/* ignore */}
  }

  if (getPermStorage('camera') === 'granted') results.camera = 'granted';
  if (getPermStorage('mic') === 'granted') results.mic = 'granted';
  if (getPermStorage('location') === 'granted') results.location = 'granted';
  if (getPermStorage('notifications') === 'granted') results.notifications = 'granted';

  return results;
};

export { openAppSettings };
