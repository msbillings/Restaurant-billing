import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as capacitorCore from '@capacitor/core';
import { getApiUrl, getSuperadminApiUrl, getSocketUrl } from './config.js';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false)
  }
}));

describe('config.js routing matrix', () => {
  beforeEach(() => {
    vi.resetModules();
    
    // Setup global browser mocks
    vi.stubGlobal('window', {
      location: { protocol: 'http:', hostname: 'localhost' }
    });
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0'
    });
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null)
    });
    
    delete import.meta.env.VITE_API_URL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const mockWeb = (hostname = 'localhost', envUrl = undefined) => {
    capacitorCore.Capacitor.isNativePlatform.mockReturnValue(false);
    window.location.hostname = hostname;
    if (envUrl !== undefined) import.meta.env.VITE_API_URL = envUrl;
  };

  const mockElectron = (envUrl = undefined) => {
    capacitorCore.Capacitor.isNativePlatform.mockReturnValue(false);
    navigator.userAgent = 'Mozilla/5.0 electron';
    if (envUrl !== undefined) import.meta.env.VITE_API_URL = envUrl;
  };

  const mockCapacitor = (envUrl = undefined) => {
    capacitorCore.Capacitor.isNativePlatform.mockReturnValue(true);
    if (envUrl !== undefined) import.meta.env.VITE_API_URL = envUrl;
  };

  describe('Web Routing', () => {
    it('Development: uses localhost if no env', () => {
      mockWeb('localhost');
      expect(getApiUrl()).toBe('http://localhost:4001/api');
      expect(getSuperadminApiUrl()).toBe('http://localhost:4001');
      expect(getSocketUrl()).toBe('http://localhost:4001');
    });

    it('Staging/Production: uses VITE_API_URL', () => {
      mockWeb('app.example.com', 'https://api.example.com');
      expect(getApiUrl()).toBe('https://api.example.com/api');
      expect(getSuperadminApiUrl()).toBe('https://api.example.com');
      expect(getSocketUrl()).toBe('https://api.example.com');
    });

    it('Vercel: throws FAIL FAST if missing VITE_API_URL', () => {
      mockWeb('my-app.vercel.app');
      expect(() => getApiUrl()).toThrow('FATAL: VITE_API_URL is missing in Vercel environment');
    });
  });

  describe('Electron Routing', () => {
    it('Development: uses explicitly configured local target if no env', () => {
      mockElectron();
      expect(getApiUrl()).toBe('http://127.0.0.1:5002/api');
      expect(getSuperadminApiUrl()).toBe('http://127.0.0.1:4001');
      expect(getSocketUrl()).toBe('http://127.0.0.1:5002');
    });

    it('Staging/Production: uses VITE_API_URL if configured', () => {
      mockElectron('https://staging-api.example.com');
      expect(getApiUrl()).toBe('https://staging-api.example.com/api');
      expect(getSuperadminApiUrl()).toBe('https://staging-api.example.com');
      expect(getSocketUrl()).toBe('https://staging-api.example.com');
    });
  });

  describe('Capacitor Routing', () => {
    it('Staging/Production: uses VITE_API_URL if configured', () => {
      mockCapacitor('https://staging-api.example.com');
      expect(getApiUrl()).toBe('https://staging-api.example.com/api');
      expect(getSuperadminApiUrl()).toBe('https://staging-api.example.com');
      expect(getSocketUrl()).toBe('https://staging-api.example.com');
    });

    it('Throws FAIL FAST if missing VITE_API_URL', () => {
      mockCapacitor();
      expect(() => getApiUrl()).toThrow('FATAL: VITE_API_URL is missing in Capacitor build');
      expect(() => getSuperadminApiUrl()).toThrow('FATAL: VITE_API_URL is missing for SuperAdmin in mobile build');
    });
  });

  describe('Safety Guards', () => {
    it('Should not silently fall back to production on mobile if env missing', () => {
      mockCapacitor();
      expect(() => getSuperadminApiUrl()).toThrow('FATAL');
    });
  });
});
