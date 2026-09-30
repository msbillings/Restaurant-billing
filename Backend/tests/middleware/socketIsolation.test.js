import { Server } from 'socket.io';
import { createServer } from 'http';
import { io as Client } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';

process.env.JWT_SECRET = 'test_secret';

describe('Socket.IO Tenant Isolation', () => {
  let io, serverSocket, clientSocket, httpServer;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    
    io.on('connection', (socket) => {
      // Inline the actual joinTenant logic from server.js for testing
      socket.on('joinTenant', (data) => {
        let tenantDb = null;
        let token = null;
        let requestedTenant = null;

        if (data && typeof data === 'object') {
          requestedTenant = data.tenantDb;
          token = data.token;
        } else {
          requestedTenant = data;
        }

        let isAuthenticated = false;

        if (token) {
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (decoded && decoded.db) {
              tenantDb = decoded.db;
              isAuthenticated = true;
            }
          } catch (err) {
          }
        } else if (requestedTenant) {
          tenantDb = `${requestedTenant}_public`;
        }

        if (tenantDb && tenantDb !== 'undefined' && tenantDb !== 'null') {
          for (const room of socket.rooms) {
            if (room !== socket.id) socket.leave(room);
          }
          socket.join(tenantDb);
          socket.tenantDb = tenantDb;
          socket.isAuthenticated = isAuthenticated;
          socket.emit('joined', { room: tenantDb });
        } else {
          socket.emit('joined', { room: null });
        }
      });
      
      socket.on('clientNotification', (notif) => {
        if (!notif) return;
        let room = socket.tenantDb || notif.tenantDb;
        if (room && room.endsWith('_public')) {
          room = room.replace('_public', '');
        }
        socket.emit('relayed', { room });
      });
    });

    httpServer.listen(() => {
      done();
    });
  });

  afterAll(() => {
    io.close();
    httpServer.close();
  });

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
    done();
  });

  const connectClient = () => {
    return new Promise((resolve) => {
      const port = httpServer.address().port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', resolve);
    });
  };

  test('A. Valid JWT for tenant A + requested tenant B joins A only', async () => {
    await connectClient();
    const token = jwt.sign({ db: 'tenantA' }, process.env.JWT_SECRET);
    
    return new Promise((resolve) => {
      clientSocket.on('joined', (res) => {
        expect(res.room).toBe('tenantA');
        resolve();
      });
      clientSocket.emit('joinTenant', { tenantDb: 'tenantB', token });
    });
  });

  test('C. Missing JWT + requested tenant A joins A_public (NOT private room)', async () => {
    await connectClient();
    return new Promise((resolve) => {
      clientSocket.on('joined', (res) => {
        expect(res.room).toBe('tenantA_public');
        resolve();
      });
      clientSocket.emit('joinTenant', { tenantDb: 'tenantA' });
    });
  });

  test('D. Invalid JWT + requested tenant A joins NOTHING', async () => {
    await connectClient();
    const token = jwt.sign({ db: 'tenantA' }, 'wrong_secret');
    return new Promise((resolve) => {
      clientSocket.on('joined', (res) => {
        expect(res.room).toBe(null);
        resolve();
      });
      clientSocket.emit('joinTenant', { tenantDb: 'tenantA', token });
    });
  });

  test('F. JWT without db joins NOTHING', async () => {
    await connectClient();
    const token = jwt.sign({ id: '123' }, process.env.JWT_SECRET);
    return new Promise((resolve) => {
      clientSocket.on('joined', (res) => {
        expect(res.room).toBe(null);
        resolve();
      });
      clientSocket.emit('joinTenant', { tenantDb: 'tenantA', token });
    });
  });

  test('H. Public notifications correctly route to private room', async () => {
    await connectClient();
    return new Promise((resolve) => {
      // First join public room
      clientSocket.on('joined', () => {
        // Then emit client notification
        clientSocket.emit('clientNotification', { title: 'Call Waiter' });
      });
      
      clientSocket.on('relayed', (res) => {
        // Verifies that 'tenantA_public' was correctly replaced with 'tenantA' for staff broadcast
        expect(res.room).toBe('tenantA');
        resolve();
      });
      
      clientSocket.emit('joinTenant', { tenantDb: 'tenantA' });
    });
  });
});
