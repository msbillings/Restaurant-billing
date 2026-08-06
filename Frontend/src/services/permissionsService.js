import { Capacitor } from '@capacitor/core';

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
      
      // First check current status
      const current = await Camera.checkPermissions();
      if (current.camera === 'granted') return true;
      
      if (current.camera === 'denied') {
        // Already denied — cannot ask again. Return false.
        // The UI should show "Open Settings" in this case.
        console.warn('[Permissions] Camera permanently denied on device — user must open Settings.');
        return false;
      }
      
      // Ask for permission (state is 'prompt' or 'prompt-with-rationale')
      const permission = await Camera.requestPermissions();
      return permission.camera === 'granted' || permission.camera === 'prompt-with-rationale';
    } catch (error) {
      console.warn("Capacitor camera plugin failed.", error);
      return false;
    }
  } else {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        if (result.state === 'granted') return true;
        if (result.state === 'prompt') {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        }
        return false;
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      }
    } catch (error) {
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
  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      const result = await Camera.checkPermissions();
      return result.camera; // 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale'
    } catch { return 'prompt'; }
  } else {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        return result.state; // 'granted' | 'denied' | 'prompt'
      }
      return 'prompt';
    } catch { return 'prompt'; }
  }
};

export const requestMicPermissions = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return true;
  } catch (error) {
    console.error("Mic permission denied", error);
    return false;
  }
};


export const requestLocationPermissions = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const current = await Geolocation.checkPermissions();
      if (current.location === 'granted') return true;
      const permission = await Geolocation.requestPermissions();
      return permission.location === 'granted';
    } catch (error) {
      console.warn("Capacitor geolocation plugin failed.", error);
      return false;
    }
  } else {
    try {
      if ('geolocation' in navigator) {
        await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
        });
        return true;
      }
      return false;
    } catch (error) {
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
      if (current.display === 'granted') return true;
      const permission = await LocalNotifications.requestPermissions();
      return permission.display === 'granted';
    } catch (error) {
      console.warn("Capacitor notifications plugin failed.", error);
      return false;
    }
  } else {
    try {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      }
      return false;
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
  const results = { camera: 'prompt', mic: 'prompt', location: 'prompt', notifications: 'prompt' };

  if (Capacitor.isNativePlatform()) {
    try {
      const { Camera } = await import('@capacitor/camera');
      const cam = await Camera.checkPermissions();
      results.camera = cam.camera;
    } catch {/* ignore */}

    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const geo = await Geolocation.checkPermissions();
      results.location = geo.location;
    } catch {/* ignore */}

    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const notif = await LocalNotifications.checkPermissions();
      results.notifications = notif.display;
    } catch {/* ignore */}
  } else {
    // Browser / Electron
    try {
      if (navigator.permissions) {
        const [cam, mic, notif] = await Promise.allSettled([
          navigator.permissions.query({ name: 'camera' }),
          navigator.permissions.query({ name: 'microphone' }),
          navigator.permissions.query({ name: 'notifications' })
        ]);
        if (cam.status === 'fulfilled') results.camera = cam.value.state;
        if (mic.status === 'fulfilled') results.mic = mic.value.state;
        if (notif.status === 'fulfilled') results.notifications = notif.value.state;
      }
    } catch {/* ignore */}
  }
  return results;
};

export { openAppSettings };
