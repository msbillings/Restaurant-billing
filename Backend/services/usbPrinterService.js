import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Scan and return all available USB and Virtual COM printer ports on the system
 */
export async function getAvailableUSBAndCOMPorts() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'

      # --- Step 1: Get physically connected USB/PnP printer devices RIGHT NOW ---
      # Get-PnpDevice only returns hardware that is currently on the bus
      $connectedPnpPrinters = Get-PnpDevice -Class 'SoftwareDevice', 'USB' -Status 'OK' -ErrorAction SilentlyContinue |
        Select-Object FriendlyName, Status, InstanceId

      # Also get USB serial (COM) devices currently connected
      $connectedPnpCOM = Get-PnpDevice -Class 'Ports' -Status 'OK' -ErrorAction SilentlyContinue |
        Select-Object FriendlyName, Status, InstanceId

      # Build a set of currently connected device friendly names (lowercase)
      $connectedNames = @{}
      foreach ($d in $connectedPnpPrinters) {
        if ($d.FriendlyName) { $connectedNames[$d.FriendlyName.ToLower().Trim()] = $d.FriendlyName }
      }
      foreach ($d in $connectedPnpCOM) {
        if ($d.FriendlyName) { $connectedNames[$d.FriendlyName.ToLower().Trim()] = $d.FriendlyName }
      }

      # --- Step 2: Get spooler ports + matched printer names ---
      $spoolerPorts = Get-PrinterPort | Where-Object { $_.Name -match '^(USB|COM)' } | Select-Object Name, Description
      $spoolerPrinters = Get-Printer | Select-Object Name, PortName

      $result = @()
      foreach ($p in $spoolerPorts) {
        $matchedPrinter = $spoolerPrinters | Where-Object { $_.PortName -eq $p.Name } | Select-Object -First 1
        $pName = if ($matchedPrinter) { $matchedPrinter.Name } else { '' }

        # --- Step 3: Cross-validate --- only include port if printer is currently connected ---
        $isCurrentlyConnected = $false
        # Check by printer name first
        if ($pName) {
          $pNameLower = $pName.ToLower().Trim()
          foreach ($key in $connectedNames.Keys) {
            if ($key -match [regex]::Escape($pNameLower)) {
              $isCurrentlyConnected = $true
              break
            }
          }
        }

        # If not matched by name, check COM or USB port descriptions
        if (-not $isCurrentlyConnected) {
          $cName = if ($p.Name -match '^COM') { $p.Name } else { $p.Description }
          if ($cName) {
            $cNameLower = $cName.ToLower().Trim()
            foreach ($key in $connectedNames.Keys) {
              if ($key -match [regex]::Escape($cNameLower) -or $cNameLower -match [regex]::Escape($key)) {
                $isCurrentlyConnected = $true
                break
              }
            }
          }
        }

        # Skip stale / disconnected ports
        if (!$isCurrentlyConnected) { continue }

        $desc = if ($p.Description) { $p.Description } else { '' }
        $it = ($desc -match '(?i)(pos|epson|thermal|receipt|caysn|t82|kpc|xprinter|cashino|rongta|hprt|gprinter|bixolon|citizen)') -or 
              ($pName -match '(?i)(pos|epson|thermal|receipt|caysn|t82|kpc|xprinter|cashino|rongta|hprt|gprinter|bixolon|citizen)')

        # If it doesn't have a printer name but it's connected on a USB port, we mark it as needing driver
        $finalPrinterName = if ($pName) { $pName } elseif ($p.Name -match '^USB') { "Uninstalled Printer (" + $desc + ")" } else { "" }

        $result += [PSCustomObject]@{
          port = $p.Name
          name = $p.Name
          description = $desc
          printerName = $finalPrinterName
          isThermalLikely = [bool]$it
        }
      }

      if ($result.Count -eq 0) {
        Write-Output '[]'
      } else {
        $result | ConvertTo-Json -Compress
      }
    `;

    try {
      const tempDir = path.join(os.tmpdir(), 'msbillings_scripts');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempScript = path.join(tempDir, `scan_ports_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ps1`);
      fs.writeFileSync(tempScript, psScript);

      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`, {
        timeout: 10000
      });
      
      try {
        if (fs.existsSync(tempScript)) fs.unlinkSync(tempScript);
      } catch (_) {}

      const trimmed = stdout.trim();
      if (!trimmed || trimmed === '[]') return [];
      const parsed = JSON.parse(trimmed);
      const rawPorts = Array.isArray(parsed) ? parsed : [parsed];

      // Format clean display labels and sort so thermal printers (e.g. Caysn, Epson, POS80) appear first
      const formattedPorts = rawPorts
        .filter(p => p && p.port)
        .map(p => {
          let label = p.port;
          if (p.description && p.description !== 'Local Port' && p.description !== 'Virtual printer port for USB') {
            label += ` (${p.description})`;
          } else if (p.printerName) {
            label += ` (${p.printerName})`;
          }
          if (p.printerName && !label.includes(p.printerName)) {
            label += ` - ${p.printerName}`;
          }

          return {
            port: p.port,
            name: p.port,
            description: p.description,
            printerName: p.printerName,
            isThermalLikely: Boolean(p.isThermalLikely),
            displayName: label
          };
        })
        .sort((a, b) => {
          // Priority 1: Likely thermal printers
          if (a.isThermalLikely && !b.isThermalLikely) return -1;
          if (!a.isThermalLikely && b.isThermalLikely) return 1;
          // Priority 2: USB ports before COM ports
          const aIsUsb = a.port.startsWith('USB');
          const bIsUsb = b.port.startsWith('USB');
          if (aIsUsb && !bIsUsb) return -1;
          if (!aIsUsb && bIsUsb) return 1;
          return a.port.localeCompare(b.port);
        });

      return formattedPorts;
    } catch (err) {
      console.error('[USBPrinterService] Windows port scan error:', err.message);
      return [];
    }
  } else if (process.platform === 'linux') {
    // Linux USB printer device nodes
    const ports = [];
    try {
      if (fs.existsSync('/dev/usb')) {
        const files = fs.readdirSync('/dev/usb');
        files.filter(f => f.startsWith('lp')).forEach(f => {
          ports.push({
            port: `/dev/usb/${f}`,
            name: `/dev/usb/${f}`,
            description: 'Linux USB Printer',
            printerName: '',
            isThermalLikely: true,
            displayName: `/dev/usb/${f} (USB Printer)`
          });
        });
      }
    } catch (e) {}
    return ports;
  }

  return [];
}

/**
 * Send raw binary ESC/POS buffer directly to a USB or COM port
 */
export async function sendRawToUSBPrinter(portName, buffer) {
  if (!portName || typeof portName !== 'string') {
    throw new Error('USB / COM port identifier is required');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Empty print buffer data');
  }

  if (process.platform === 'win32') {
    const tempDir = path.join(os.tmpdir(), 'msbillings_print');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempBin = path.join(tempDir, `print_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.bin`);
    fs.writeFileSync(tempBin, buffer);

    const psScriptPath = path.join(__dirname, '..', 'utils', 'rawPrint.ps1');

    try {
      const cleanPort = portName.trim();
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}" -Port "${cleanPort}" -File "${tempBin}"`;
      const { stdout, stderr } = await execPromise(cmd, { timeout: 10000 });
      
      const outText = (stdout || '').trim();
      if (stderr && stderr.toLowerCase().includes('failed:')) {
        throw new Error(stderr.trim());
      }
      return {
        success: true,
        message: outText || `Printed raw ESC/POS to ${cleanPort}`
      };
    } finally {
      try {
        if (fs.existsSync(tempBin)) {
          fs.unlinkSync(tempBin);
        }
      } catch (_) {}
    }
  } else if (process.platform === 'linux' && portName.startsWith('/dev/')) {
    // Linux direct write
    return new Promise((resolve, reject) => {
      fs.writeFile(portName, buffer, (err) => {
        if (err) return reject(new Error(`Failed writing to ${portName}: ${err.message}`));
        resolve({ success: true, message: `Printed raw ESC/POS to ${portName}` });
      });
    });
  } else {
    throw new Error(`USB direct raw printing is not yet supported on platform: ${process.platform}`);
  }
}

/**
 * Check if a real LAN / WiFi network interface is physically active RIGHT NOW.
 * Uses PowerShell Get-NetAdapter on Windows (checks actual hardware MediaConnectionState)
 * rather than os.networkInterfaces() which caches stale IPs after disconnect.
 * Returns { connected: bool, interfaces: [] }
 */
export async function checkNetworkConnectivity() {
  if (process.platform === 'win32') {
    // PowerShell: get adapters that are physically Up AND media is Connected
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
      console.warn('[NetworkCheck] PowerShell adapter check failed, falling back to os.networkInterfaces():', err.message);
      // Fallback: os.networkInterfaces (may be stale on Windows but better than nothing)
      return _checkViaOsInterfaces();
    }
  } else if (process.platform === 'linux') {
    // Linux: check /sys/class/net/<iface>/carrier (1=connected, 0=no link)
    try {
      const ifaces = os.networkInterfaces();
      const activeIfaces = [];
      for (const [name, addrs] of Object.entries(ifaces)) {
        if (name === 'lo') continue;
        const carrierPath = `/sys/class/net/${name}/carrier`;
        let carrier = '0';
        try { carrier = fs.readFileSync(carrierPath, 'utf8').trim(); } catch (_) {}
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

// Shared fallback using os.networkInterfaces (may lag after disconnect on Windows)
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

/**
 * Scan for Bluetooth devices currently paired/visible on Windows or Linux.
 * Returns { btAvailable: bool, devices: [{ name, address, connected, isThermal }] }
 */
export async function scanBluetoothDevices() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'

      # Check if any Bluetooth radio is available
      $radio = Get-PnpDevice -Class 'Bluetooth' -Status 'OK' -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match '(?i)(radio|adapter|intel|realtek|qualcomm|broadcom|mediatek)' }

      if (-not $radio) {
        Write-Output '{"btAvailable":false,"devices":[]}'
        exit
      }

      # Paired / connected Bluetooth devices (filter out driver/system entries)
      $btDevices = Get-PnpDevice -Class 'Bluetooth' -ErrorAction SilentlyContinue |
        Where-Object {
          $_.Status -in @('OK','Unknown') -and
          $_.FriendlyName -notmatch '(?i)(Bluetooth|Microsoft|Generic|Intel|Realtek|Qualcomm|Mediatek|Broadcom|AVRCP|HFP|A2DP|PAN|HID|RFCOMM|BthEnum|Service|Transport|Enumerator|Hands-Free)'
        } |
        Select-Object FriendlyName, Status, InstanceId

      $result = @()
      foreach ($d in $btDevices) {
        $mac = ''
        if ($d.InstanceId -match 'DEV_([0-9A-Fa-f]{12})') {
          $raw = $matches[1]
          # Format as AA:BB:CC:DD:EE:FF
          $mac = ($raw -split '(?<=\G.{2})(?=.)') -join ':'
        }
        $conn = ($d.Status -eq 'OK')
        $isThermal = $d.FriendlyName -match '(?i)(pos|epson|caysn|thermal|receipt|kpc|xprinter|cashino|rongta|hprt|gprinter|bixolon|citizen|printer)'
        if ($d.FriendlyName -and $mac) {
          $isDuplicate = $result | Where-Object { $_.address -eq $mac }
          if (-not $isDuplicate) {
            $result += [PSCustomObject]@{
              name      = $d.FriendlyName
              address   = $mac
              connected = [bool]$conn
              isThermal = [bool]$isThermal
            }
          }
        }
      }

      if ($result.Count -eq 0) {
        Write-Output '{"btAvailable":true,"devices":[]}'
      } else {
        $json = $result | ConvertTo-Json -Compress -Depth 2
        Write-Output "{""btAvailable"":true,""devices"":$json}"
      }
    `;
    try {
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 9000 }
      );
      const raw = (stdout || '').trim();
      if (!raw) return { btAvailable: false, devices: [] };
      const parsed = JSON.parse(raw);
      return {
        btAvailable: parsed.btAvailable !== false,
        devices: Array.isArray(parsed.devices)
          ? parsed.devices
          : parsed.devices ? [parsed.devices] : []
      };
    } catch (err) {
      console.error('[BluetoothScanner] Windows scan error:', err.message);
      return { btAvailable: false, devices: [] };
    }
  } else if (process.platform === 'linux') {
    try {
      const { stdout } = await execPromise(
        'bluetoothctl devices Paired 2>/dev/null || bluetoothctl devices 2>/dev/null',
        { timeout: 5000 }
      );
      const lines = (stdout || '').trim().split('\n').filter(Boolean);
      const devices = lines.map(line => {
        const match = line.match(/Device\s+([0-9A-Fa-f:]{17})\s+(.+)/);
        if (!match) return null;
        return {
          address: match[1],
          name: match[2].trim(),
          connected: true,
          isThermal: /pos|thermal|printer|epson/i.test(match[2])
        };
      }).filter(Boolean);
      return { btAvailable: true, devices };
    } catch {
      return { btAvailable: false, devices: [] };
    }
  }

  // macOS / unsupported – return unavailable
  return { btAvailable: false, devices: [] };
}
