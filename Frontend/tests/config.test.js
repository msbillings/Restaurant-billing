import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApiUrl } from '../src/config.js';
import { Capacitor } from '@capacitor/core';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn()
    }
}));

describe('config.js - getApiUrl safety', () => {
    let originalWindow;
    
    beforeEach(() => {
        vi.resetModules();
        vi.unstubAllEnvs();
        vi.stubEnv('VITE_API_URL', ''); // Ensure it's clear
        Capacitor.isNativePlatform.mockReturnValue(false);
        originalWindow = global.window;
    });
    
    afterEach(() => {
        global.window = originalWindow;
    });

    it('1. Explicit API URL -> accepted', () => {
        global.window = { location: { hostname: 'vercel.app' } };
        vi.stubEnv('VITE_API_URL', 'https://staging-api.example.com');
        expect(getApiUrl()).toBe('https://staging-api.example.com/api');
    });

    it('2. Missing API URL in local development -> expected local behavior', () => {
        global.window = { location: { hostname: 'localhost' } };
        // Clean missing env should default to localhost:4001/api for local dev
        expect(getApiUrl()).toBe('http://localhost:4001/api');
    });

    it('3. Missing API URL in non-local build/runtime -> fails safely (Vercel)', () => {
        global.window = { location: { hostname: 'my-app.vercel.app' } };
        expect(() => getApiUrl()).toThrow(/FATAL: VITE_API_URL is missing in Vercel environment/);
    });

    it('3b. Missing API URL in non-local build/runtime -> fails safely (Capacitor)', () => {
        global.window = { location: { hostname: 'localhost' } }; // Not vercel host
        Capacitor.isNativePlatform.mockReturnValue(true);
        expect(() => getApiUrl()).toThrow(/FATAL: VITE_API_URL is missing in Capacitor build/);
    });

    it('4. Production URL is never selected implicitly', () => {
        global.window = { location: { hostname: 'my-app.vercel.app' } };
        try {
            getApiUrl();
        } catch (e) {
            expect(e.message).not.toContain('msbillings-backend-x9qw.onrender.com');
        }
    });

    it('5. Staging URL is accepted explicitly', () => {
        global.window = { location: { hostname: 'my-app.vercel.app' } };
        vi.stubEnv('VITE_API_URL', 'https://my-staging-backend.onrender.com');
        expect(getApiUrl()).toBe('https://my-staging-backend.onrender.com/api');
    });
});
