import { jest } from '@jest/globals';

// Mock dependencies before importing the module
jest.unstable_mockModule('redis', () => {
  return {
    createClient: jest.fn(() => mockRedisClient)
  };
});

let mockRedisClient;
let redisManager;

describe('RedisClient Integrity & Safety', () => {
  beforeEach(async () => {
    jest.resetModules();
    process.env.NODE_ENV = 'test'; // Ensure not cloud
    delete process.env.RENDER;

    mockRedisClient = {
      connect: jest.fn().mockResolvedValue(),
      quit: jest.fn().mockResolvedValue(),
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue('OK'),
      keys: jest.fn().mockResolvedValue([]),
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
      duplicate: jest.fn().mockReturnThis(), // Return same mock for pub/sub
      on: jest.fn((event, handler) => {
        // Automatically trigger 'ready' on connect in tests to simulate successful connection
        if (event === 'ready') {
          mockRedisClient._readyHandler = handler;
        }
        if (event === 'error' && !mockRedisClient._errorHandler) {
          // capture only the first error handler (the main client)
          mockRedisClient._errorHandler = handler;
        }
      })
    };

    const module = await import('../../utils/redisClient.js');
    redisManager = module.default;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('1. connect success: establishes connection and listens to events', async () => {
    await redisManager.connect();
    expect(mockRedisClient.connect).toHaveBeenCalledTimes(3); // main, pub, sub

    // Simulate ready event
    mockRedisClient._readyHandler();
    expect(redisManager.isConnected).toBe(true);
  });

  it('2. connect failure: handles gracefully without crashing', async () => {
    mockRedisClient.connect.mockRejectedValue(new Error('Connection Refused'));

    await redisManager.connect();
    expect(redisManager.isConnected).toBe(false);
  });

  it('3. acquireLock success: acquires lock and returns unique token', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler(); // mark as connected

    const token = await redisManager.acquireLock('test:lock', 60);
    expect(token).toBeDefined();
    expect(token).not.toBe(false);
    expect(typeof token).toBe('string');
    expect(mockRedisClient.set).toHaveBeenCalledWith('test:lock', token, { NX: true, EX: 60 });
  });

  it('4. acquireLock returns false when another lock exists', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();

    mockRedisClient.set.mockResolvedValue(null); // Redis returns null when NX condition fails

    const token = await redisManager.acquireLock('test:lock', 60);
    expect(token).toBe(false);
  });

  it('5. acquireLock returns false when Redis unavailable by default (secure-by-default)', async () => {
    const token = await redisManager.acquireLock('test:lock', 60);
    expect(token).toBe(false); // Should fail closed by default
  });

  it('local fallback: returns fallback token ONLY when explicitly allowed', async () => {
    process.env.ALLOW_LOCAL_REDIS_FALLBACK = 'true';
    const token = await redisManager.acquireLock('test:lock', 60);
    expect(token).toBe('local-fallback-token');
    delete process.env.ALLOW_LOCAL_REDIS_FALLBACK;
  });

  it('6. unique lock token generated', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();

    const token1 = await redisManager.acquireLock('test:lock1', 60);
    const token2 = await redisManager.acquireLock('test:lock2', 60);
    expect(token1).not.toEqual(token2);
  });

  it('7. releaseLock succeeds for owner', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();

    await redisManager.releaseLock('test:lock', 'my-token');

    expect(mockRedisClient.eval).toHaveBeenCalled();
    const callArgs = mockRedisClient.eval.mock.calls[0][1];
    expect(callArgs.keys).toEqual(['test:lock']);
    expect(callArgs.arguments).toEqual(['my-token']);
  });

  it('8. releaseLock does NOT delete another owner\'s lock (atomic script logic)', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();
    // In our mock we can't fully simulate Lua execution, but we verify the correct command is dispatched
    await redisManager.releaseLock('test:lock', 'wrong-token');

    expect(mockRedisClient.eval).toHaveBeenCalled();
    const script = mockRedisClient.eval.mock.calls[0][0];
    expect(script).toContain('redis.call("get", KEYS[1]) == ARGV[1]');
  });

  it('11. Redis reconnect/recovery behavior', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();
    expect(redisManager.isConnected).toBe(true);

    // Simulate disconnect error event
    mockRedisClient._errorHandler(new Error('Dropped connection'));
    expect(redisManager.isConnected).toBe(false);

    // Node-redis automatically reconnects and emits ready again
    mockRedisClient._readyHandler();
    expect(redisManager.isConnected).toBe(true);
  });

  it('12. disconnect is safe', async () => {
    await redisManager.connect();
    mockRedisClient._readyHandler();
    await redisManager.disconnect();

    expect(mockRedisClient.quit).toHaveBeenCalledTimes(3);
    expect(redisManager.isConnected).toBe(false);
  });
});
