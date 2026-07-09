import request from 'supertest';
import app from '../server.js'; // Ensure this path is correct relative to tests/

describe('Security Headers', () => {
    it('should have security headers', async () => {
        const res = await request(app).get('/');

        // Helmet headers
        if (!res.headers['x-dns-prefetch-control']) throw new Error('Missing X-DNS-Prefetch-Control');
        if (!res.headers['x-frame-options']) throw new Error('Missing X-Frame-Options');

        console.log('Security headers verification passed!');
    });
});
