import dns from 'dns';
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) { }

import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import mongoose from 'mongoose';

// Cache of active mongoose connections for each cluster (e.g. 'cluster1', 'cluster2')
const clusterConnections = new Map();
const clusterInitPromises = new Map();

/**
 * Normalizes cluster name and returns an active mongoose.Connection for that cluster.
 * @param {string} clusterName - e.g. 'cluster0', 'cluster1', 'cluster2'
 * @returns {Promise<mongoose.Connection>}
 */
export const getClusterConnection = async (clusterName = 'cluster0') => {
  const normalized = (clusterName || 'cluster0').toLowerCase().trim();

  // Primary cluster (Cluster 0) defaults to global mongoose.connection
  if (normalized === 'cluster0' || normalized === 'primary' || normalized === 'default') {
    if (mongoose.connection.readyState !== 1 && mongoose.connection.readyState === 2) {
      await new Promise((resolve) => {
        if (mongoose.connection.readyState === 1) return resolve();
        mongoose.connection.once('open', resolve);
        setTimeout(resolve, 5000);
      });
    }
    return mongoose.connection;
  }

  // Return existing active connection from pool
  if (clusterConnections.has(normalized)) {
    const conn = clusterConnections.get(normalized);
    if (conn && conn.readyState === 1) return conn;
  }

  // Return ongoing connection promise if currently connecting
  if (clusterInitPromises.has(normalized)) {
    return clusterInitPromises.get(normalized);
  }

  const envKey = `MONGO_URI_${normalized.toUpperCase()}`;
  const uri = process.env[envKey] || process.env[`MONGODB_URI_${normalized.toUpperCase()}`];

  if (!uri) {
    console.warn(`[clusterManager] No environment URI found for ${normalized} (${envKey}). Falling back to primary cluster.`);
    return mongoose.connection;
  }

  const initPromise = (async () => {
    try {
      console.log(`[clusterManager] Connecting to ${normalized} pool...`);
      const conn = mongoose.createConnection(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10000
      });
      await conn.asPromise();
      console.log(`[clusterManager] Successfully connected to ${normalized}`);
      clusterConnections.set(normalized, conn);
      return conn;
    } catch (err) {
      console.error(`[clusterManager] Failed to connect to ${normalized}:`, err.message);
      clusterInitPromises.delete(normalized);
      return mongoose.connection;
    }
  })();

  clusterInitPromises.set(normalized, initPromise);
  return initPromise;
};

/**
 * Returns a specific tenant database on its target cluster.
 * @param {string} clusterName - e.g. 'cluster2'
 * @param {string} databaseName - e.g. 'client_test5_6aad21'
 * @returns {Promise<mongoose.Connection>}
 */
export const getTenantDb = async (clusterName, databaseName) => {
  if (!databaseName) {
    throw new Error('Database name is required to get tenant DB');
  }
  const clusterConn = await getClusterConnection(clusterName);
  return clusterConn.useDb(databaseName, { useCache: true });
};
