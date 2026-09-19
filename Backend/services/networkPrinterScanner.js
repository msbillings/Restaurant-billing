import net from 'net';
import os from 'os';

/**
 * Get all active local IPv4 subnet prefixes (e.g. ['192.168.1', '192.168.0'])
 */
function getActiveSubnetPrefixes() {
  const interfaces = os.networkInterfaces();
  const prefixes = new Set();

  for (const name of Object.keys(interfaces)) {
    for (const netInfo of interfaces[name]) {
      if (netInfo.family === 'IPv4' && !netInfo.internal) {
        const parts = netInfo.address.split('.');
        if (parts.length === 4) {
          prefixes.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
        }
      }
    }
  }

  // Common POS thermal printer default subnets
  prefixes.add('192.168.1');
  prefixes.add('192.168.0');
  prefixes.add('192.168.123');

  return Array.from(prefixes);
}

/**
 * Fast TCP probe to check if port (standard 9100) is open on host
 */
function probePort(ip, port = 9100, timeout = 300) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isSuccess = false;

    socket.setTimeout(timeout);

    socket.connect(port, ip, () => {
      isSuccess = true;
      socket.destroy();
      resolve({ ip, port, open: true });
    });

    socket.on('error', () => {
      socket.destroy();
      resolve({ ip, port, open: false });
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ip, port, open: false });
    });
  });
}

/**
 * Scan local subnet(s) for thermal printers listening on standard RAW port 9100
 */
export async function scanNetworkThermalPrinters(targetPort = 9100) {
  const prefixes = getActiveSubnetPrefixes();
  const discovered = [];

  for (const prefix of prefixes) {
    const promises = [];
    for (let i = 1; i <= 254; i++) {
      const ip = `${prefix}.${i}`;
      promises.push(probePort(ip, targetPort, 350));
    }

    const results = await Promise.all(promises);
    results.filter(r => r.open).forEach(r => {
      if (!discovered.some(d => d.ip === r.ip)) {
        discovered.push({
          ip: r.ip,
          port: r.port,
          displayName: `${r.ip}:${r.port} (Thermal Printer Detected)`
        });
      }
    });
  }

  return discovered;
}
