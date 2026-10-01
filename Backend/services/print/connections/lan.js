import net from 'net';

/**
 * Sends a Buffer directly to a TCP Network Thermal Printer on IP:Port (standard 9100)
 */
export const sendRawToNetworkPrinter = (ipAddress, port = 9100, buffer) => {
  return new Promise((resolve, reject) => {
    if (!ipAddress || ipAddress.trim() === '') {
      return reject(new Error('Printer IP address is required'));
    }

    const socket = new net.Socket();
    let isHandled = false;

    socket.setTimeout(1000); // Fast 1 second connection timeout

    socket.connect(port, ipAddress, () => {
      isHandled = true;
      socket.write(buffer, () => {
        setTimeout(() => {
          socket.end();
          resolve({ success: true, message: `Successfully printed to ${ipAddress}:${port}` });
        }, 300);
      });
    });

    socket.on('error', (err) => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`TCP connection failed to ${ipAddress}:${port} (${err.message})`));
      }
    });

    socket.on('timeout', () => {
      if (!isHandled) {
        isHandled = true;
        socket.destroy();
        reject(new Error(`Timeout connecting to ${ipAddress}:${port}. Check IP and power.`));
      }
    });
  });
};
import os from 'os';
import { execPromise } from './portLocks.js';

export async function checkNetworkConnectivity() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'
      $adapters = Get-NetAdapter | Where-Object {
        $_.Status -eq 'Up' -and $_.MediaConnectionState -eq 'Connected'
      }
      $result = @()
      foreach ($a in $adapters) {
        $ip = Get-NetIPAddress -InterfaceIndex $a.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
              Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '0.0.0.0' } |
              Select-Object -First 1
        if ($ip) {
          $result += [PSCustomObject]@{
            name    = $a.Name
            address = $ip.IPAddress
            mac     = $a.MacAddress
            type    = $a.InterfaceDescription
          }
        }
      }
      if ($result.Count -eq 0) {
        Write-Output '[]'
      } else {
        $result | ConvertTo-Json -Compress
      }
    `;
    try {
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 5000 }
      );
      const trimmed = (stdout || '').trim();
      if (!trimmed || trimmed === '[]') {
        return { connected: false, interfaces: [] };
      }
      const parsed = JSON.parse(trimmed);
      const ifaces = Array.isArray(parsed) ? parsed : [parsed];
      return { connected: ifaces.length > 0, interfaces: ifaces };
    } catch (err) {
      return _checkViaOsInterfaces();
    }
  } else if (process.platform === 'linux') {
    try {
      const ifaces = os.networkInterfaces();
      const activeIfaces = [];
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (name === 'lo') continue;
        const carrierPath = `/sys/class/net/${name}/carrier`;
        let carrier = '0';
        try { carrier = fs.readFileSync(carrierPath, 'utf8').trim(); } catch (_) { }
        if (carrier === '1') {
          for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
              activeIfaces.push({ name, address: addr.address, mac: addr.mac });
            }
          }
        }
      }
      return { connected: activeIfaces.length > 0, interfaces: activeIfaces };
    } catch {
      return _checkViaOsInterfaces();
    }
  }

  return _checkViaOsInterfaces();
}

function _checkViaOsInterfaces() {
  const ifaces = os.networkInterfaces();
  const activeIfaces = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal && addr.address !== '0.0.0.0') {
        activeIfaces.push({ name, address: addr.address, netmask: addr.netmask, mac: addr.mac });
      }
    }
  }
  return { connected: activeIfaces.length > 0, interfaces: activeIfaces };
}
