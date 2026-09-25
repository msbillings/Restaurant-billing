import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);
const btComPortCache = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
/**
 * Scan and return all available USB and Virtual COM printer ports on the system
 */
export async function getAvailableUSBAndCOMPorts() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'

      # 1. Connected PnP devices (ONLY physically present devices with Status 'OK')
      $pnpList = Get-PnpDevice -PresentOnly -Status 'OK' -ErrorAction SilentlyContinue

      # 2. Installed Printers in Windows Spooler
      $spoolerPrinters = Get-Printer -ErrorAction SilentlyContinue

      # 3. Active COM ports directly from system
      $serialPorts = [System.IO.Ports.SerialPort]::GetPortNames()

      $result = @()
      $seenPorts = @{}

      # A. Scan physically connected USBPRINT devices FIRST (real hardware)
      $usbPrintDevices = $pnpList | Where-Object { $_.InstanceId -match 'USBPRINT' }
      foreach ($dev in $usbPrintDevices) {
        if ($dev.InstanceId -match '(USB\\d+)') {
          $portName = $matches[1]
          $seenPorts[$portName] = $true

          $matchedPrinter = $spoolerPrinters | Where-Object { ($_.PortName -replace '[:\\\\/]', '') -eq $portName } | Select-Object -First 1
          $pName = if ($matchedPrinter) { $matchedPrinter.Name } else { '' }
          $desc = if ($dev.FriendlyName) { $dev.FriendlyName } else { 'USB Thermal Printer' }

          $dn = "$portName ($desc)"
          if ($pName) { $dn = "$dn - $pName" }

          $result += [PSCustomObject]@{
            port = $portName
            name = $portName
            description = $desc
            printerName = $pName
            isThermalLikely = $true
            displayName = $dn
          }
        }
      }

      # B. Scan active COM ports
      foreach ($com in $serialPorts) {
        $portName = $com -replace '[:\\\\/]', ''
        if ($seenPorts.ContainsKey($portName)) { continue }
        $seenPorts[$portName] = $true

        $pnpMatch = $pnpList | Where-Object { $_.FriendlyName -match [regex]::Escape($portName) } | Select-Object -First 1
        $desc = if ($pnpMatch -and $pnpMatch.FriendlyName) { $pnpMatch.FriendlyName } else { 'Serial / COM Port' }
        $allText = ($portName + ' ' + $desc).ToLower()
        $isThermal = $allText -match '(pos|epson|thermal|receipt|caysn|t82|kpc|xprinter|cashino|rongta|hprt|gprinter|bixolon|citizen|rp\\d+|nt-|58|80)'

        $result += [PSCustomObject]@{
          port = $portName
          name = $portName
          description = $desc
          printerName = ''
          isThermalLikely = [bool]$isThermal
          displayName = "$portName ($desc)"
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
        .map(p => ({
          port: p.port,
          name: p.port,
          description: p.description,
          printerName: p.printerName,
          isThermalLikely: Boolean(p.isThermalLikely),
          displayName: p.displayName || p.port
        }))
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
 * Attempt to get the battery status of a Bluetooth SPP device.
 * For most generic printers, this is unsupported unless they broadcast it
 * or support a proprietary ESC/POS status command.
 */
export async function getPrinterBatteryStatus(address) {
  // Currently, desktop Node.js Bluetooth SPP cannot easily poll battery
  // without disrupting print flows or knowing the specific vendor ESC command.
  return { success: false, message: 'Battery polling over Desktop SPP is not supported by printer hardware.' };
}

/**
 * Send raw binary ESC/POS buffer directly to a USB or COM port
 */
export async function sendRawToUSBPrinter(portName, buffer, printerName = '') {
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
      let cleanPort = portName.trim().replace(/[:\\/]/g, '');
      const cleanPrinterName = (printerName || '').trim();

      // Check live active ports to verify physical connection and auto-heal if port shifted
      try {
        const livePorts = []; // Bypassed heavy WMI scan
        const isPortLive = livePorts.some(p => p.port === cleanPort);
        if (!isPortLive && cleanPort.startsWith('USB')) {
          const activeUsb = livePorts.find(p => p.port.startsWith('USB') && p.isThermalLikely) || livePorts.find(p => p.port.startsWith('USB'));
          if (activeUsb) {
            console.log(`[USBPrinterService] Configured USB port '${cleanPort}' is disconnected; auto-rerouting to physically active port '${activeUsb.port}' (${activeUsb.description})`);
            cleanPort = activeUsb.port;
          }
        }
      } catch (checkErr) {
        console.warn('[USBPrinterService] Could not check live USB ports before printing:', checkErr.message);
      }

      const exePath = path.join(__dirname, '..', 'utils', 'RawPrinter.exe');
      if (cleanPrinterName && fs.existsSync(exePath)) {
        try {
          const fastCmd = `"${exePath}" "${cleanPrinterName}" "${tempBin}"`;
          const { stdout } = await execPromise(fastCmd, { timeout: 3000 });
          if (stdout && stdout.includes("SUCCESS")) {
            return {
              success: true,
              actualPort: cleanPort,
              message: `Printed instantly via native spooler to ${cleanPrinterName}`
            };
          }
        } catch (fastErr) {
          console.warn('[USBPrinterService] Fast native print failed, falling back to PowerShell:', fastErr.message);
        }
      }

      const printerParam = cleanPrinterName ? ` -PrinterName "${cleanPrinterName}"` : '';
      const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}" -Port "${cleanPort}" -File "${tempBin}"${printerParam}`;
      const { stdout, stderr } = await execPromise(cmd, { timeout: 12000 });
      
      const outText = (stdout || '').trim();
      if (stderr && stderr.toLowerCase().includes('failed:')) {
        throw new Error(stderr.trim());
      }

      // Check if rawPrint.ps1 rerouted to another port
      let finalPort = cleanPort;
      const rerouteMatch = outText.match(/auto-rerouting to active port '([^']+)'/i);
      if (rerouteMatch && rerouteMatch[1]) {
        finalPort = rerouteMatch[1];
      }

      return {
        success: true,
        actualPort: finalPort,
        message: outText || `Printed raw ESC/POS to ${finalPort}`
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

  // macOS / unsupported â€“ return unavailable
  return { btAvailable: false, devices: [] };
}

/**
 * Send raw binary ESC/POS buffer directly to a paired Bluetooth thermal printer on Windows or Linux
 * Uses an in-memory COM port cache to skip the expensive PnP scan after the first print.
 */
export async function sendRawToBluetoothPrinter(addressOrName, buffer) {
  if (!addressOrName || typeof addressOrName !== 'string') {
    throw new Error('Bluetooth MAC address or printer name is required');
  }
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty print buffer data');
  }

  if (process.platform === 'win32') {
    const cleanAddress = addressOrName.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const cacheKey = cleanAddress || addressOrName.trim().toLowerCase();

    const tempDir = path.join(os.tmpdir(), 'msbillings_print');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempBin = path.join(tempDir, `bt_print_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.bin`);
    fs.writeFileSync(tempBin, buffer);
    const tempBinEscaped = tempBin.replace(/\\/g, '\\\\');

    // -----------------------------------------------------------------
    // FULL SCAN PATH: Find the COM port via PnP, cache it, then print
    // -----------------------------------------------------------------
    if (btComPortCache.has(cacheKey)) {
      const cachedPort = btComPortCache.get(cacheKey);
      try {
        const { stdout } = await execPromise(`cmd.exe /c copy /b "${tempBin}" ${cachedPort}`, { timeout: 3000 });
        try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) {}
        return { success: true, message: `Printed instantly to Bluetooth via ${cachedPort}` };
      } catch (fastErr) {
        console.warn(`[BluetoothPrinter] Fast native print to ${cachedPort} failed, falling back to full scan:`, fastErr.message);
        btComPortCache.delete(cacheKey);
      }
    }
    const fullScript = `
      $ErrorActionPreference = 'Stop'
      $cleanMac = '${cleanAddress}'
      $targetName = '${addressOrName.replace(/'/g, "''")}'

      # Find assigned COM port for this Bluetooth device
      $allPorts = Get-PnpDevice -Class 'Ports' -Status 'OK' -ErrorAction SilentlyContinue |
        Select-Object FriendlyName, InstanceId

      $matchedPort = ''
      foreach ($p in $allPorts) {
        if ($cleanMac -and $p.InstanceId -and $p.InstanceId.ToUpper() -match $cleanMac) {
          if ($p.FriendlyName -match 'COM\\d+') {
            $matchedPort = $matches[0]
            break
          }
        }
      }

      if (-not $matchedPort) {
        foreach ($p in $allPorts) {
          if ($p.FriendlyName -match [regex]::Escape($targetName)) {
            if ($p.FriendlyName -match 'COM\\d+') {
              $matchedPort = $matches[0]
              break
            }
          }
        }
      }
        

      if (-not $matchedPort) {
        Write-Error "PRINTER_OFFLINE: Printer '$targetName' is not reachable. Please make sure the printer is turned ON and paired in Windows Bluetooth Settings, then try again."
        exit 1
      }

      $rawBytes = [System.IO.File]::ReadAllBytes('${tempBinEscaped}')
      $sp = New-Object System.IO.Ports.SerialPort $matchedPort, 115200, 'None', 8, 'One'
      $sp.WriteTimeout = 6000
      $sp.ReadTimeout = 500
      try {
        $sp.Open()
        $chunkSize = 2048
        for ($offset = 0; $offset -lt $rawBytes.Length; $offset += $chunkSize) {
          $count = [Math]::Min($chunkSize, $rawBytes.Length - $offset)
          $sp.Write($rawBytes, $offset, $count)
          Start-Sleep -Milliseconds 2
        }
        Start-Sleep -Milliseconds 200
        $sp.Close()
        Write-Output "SUCCESS:$matchedPort"
      } catch {
        if ($sp.IsOpen) { $sp.Close() }
        Write-Error "Failed to send data to Bluetooth port $matchedPort : $($_.Exception.Message)"
        exit 1
      }
    `;

    try {
      const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 25000 }
      );
      try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) {}

      const out = (stdout || '').trim();
      const portMatch = out.match(/SUCCESS:(.+)/i);
      if (portMatch && portMatch[1]) {
        const discoveredPort = portMatch[1].trim();
        console.log(`[BluetoothPrinter] COM port detected: ${discoveredPort}`);
        btComPortCache.set(cacheKey, discoveredPort);
      }
      return { success: true, message: out || `Printed to Bluetooth port for ${addressOrName}` };
    } catch (err) {
      try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) {}
      const rawMsg = (err.stderr || err.stdout || err.message || '');

      const offlineMatch = rawMsg.match(/PRINTER_OFFLINE:\s*(.+)/i);
      if (offlineMatch) throw new Error(offlineMatch[1].trim());

      const writeErrMatch = rawMsg.match(/Write-Error[^:]*:\s*(.+)/i);
      if (writeErrMatch) throw new Error(writeErrMatch[1].trim());

      const cleaned = rawMsg
        .split('\n')
        .map(l => l.trim())
        .filter(l =>
          l.length > 0 &&
          !/^At line:/i.test(l) &&
          !/^\+/i.test(l) &&
          !/FullyQualifiedErrorId/i.test(l) &&
          !/CategoryInfo/i.test(l) &&
          !/powershell/i.test(l)
        )
        .join(' ')
        .trim();

      throw new Error(cleaned || `Bluetooth printer '${addressOrName}' is not connected or not responding.`);
    }
  }

  throw new Error('Bluetooth raw printing via server is only supported on Windows / Linux hosts.');
}
