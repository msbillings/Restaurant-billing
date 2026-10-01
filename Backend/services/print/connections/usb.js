import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execPromise, execFilePromise, withPrinterLock, usbPrinterCache } from './portLocks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getAvailableUSBAndCOMPorts() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'
      $pnpList = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue
      $spoolerPrinters = Get-CimInstance Win32_Printer -Filter "Local=$true" -ErrorAction SilentlyContinue
      $serialPorts = [System.IO.Ports.SerialPort]::GetPortNames()

      $result = @()
      $seenPorts = @{}

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

      foreach ($com in $serialPorts) {
        $portName = $com -replace '[:\\\\/]', ''
        if ($seenPorts.ContainsKey($portName)) { continue }
        $seenPorts[$portName] = $true

        $pnpMatch = $pnpList | Where-Object { $_.FriendlyName -match [regex]::Escape($portName) } | Select-Object -First 1
        $desc = if ($pnpMatch -and $pnpMatch.FriendlyName) { $pnpMatch.FriendlyName } else { 'Serial / COM Port' }
        $allText = ($portName + ' ' + $desc).ToLower()
        $isThermal = $allText -match '(pos|epson|thermal|receipt|caysn|t82|kpc|xprinter|cashino|rongta|hprt|gprinter|bixolon|citizen|rp\\d+|nt-|58|80)'

        if ($isThermal) {
          $result += [PSCustomObject]@{
            port = $portName
            name = $portName
            description = $desc
            printerName = ''
            isThermalLikely = [bool]$isThermal
            displayName = "$portName ($desc)"
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
      const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
      const { stdout } = await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${b64}`, {
        timeout: 30000
      });

      const trimmed = stdout.trim();
      if (!trimmed || trimmed === '[]') return [];
      const parsed = JSON.parse(trimmed);
      const rawPorts = Array.isArray(parsed) ? parsed : [parsed];

      const formattedPorts = rawPorts
        .filter(p => p && p.port)
        .map(p => {
          if (p.port && p.printerName) {
            usbPrinterCache.set(p.port, p.printerName);
          }
          return {
            port: p.port,
            name: p.port,
            description: p.description,
            printerName: p.printerName,
            isThermalLikely: Boolean(p.isThermalLikely),
            displayName: p.displayName || p.port
          };
        })
        .sort((a, b) => {
          if (a.isThermalLikely && !b.isThermalLikely) return -1;
          if (!a.isThermalLikely && b.isThermalLikely) return 1;
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
    } catch (e) { }
    return ports;
  }
  return [];
}

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

    const psScriptPath = path.join(__dirname, '..', '..', '..', 'utils', 'rawPrint.ps1');

    try {
      let cleanPort = portName.trim().replace(/[:\\/]/g, '');
      const cleanPrinterName = (printerName || '').trim();

      return await withPrinterLock(cleanPrinterName || cleanPort, async () => {
        const exePath = path.join(__dirname, '..', '..', '..', 'utils', 'RawPrinter.exe');
        let targetSpoolerName = cleanPrinterName;

        try {
          if (usbPrinterCache.has(cleanPort)) {
            targetSpoolerName = usbPrinterCache.get(cleanPort);
            console.log(`[USBPrinterService] Using cached spooler name for ${cleanPort}: ${targetSpoolerName}`);
          } else {
            const psCommand = `
              $port = '${cleanPort}'
              $printers = Get-Printer -ErrorAction SilentlyContinue
              $matched = $printers | Where-Object { ($_.PortName -replace '[:\\\\/]', '').Trim() -eq $port } | Select-Object -First 1
              if (-not $matched) {
                  $autoName = "MS_POS_" + $port
                  try {
                      Add-Printer -Name $autoName -DriverName "POS80" -PortName $port -ErrorAction Stop
                      $matched = Get-Printer -Name $autoName -ErrorAction Stop
                  } catch { }
              }
              if ($matched) {
                  $pName = $matched.Name
                  Write-Output $pName
              }
            `;
            const encoded = Buffer.from(psCommand, 'utf16le').toString('base64');
            const { stdout } = await execFilePromise("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-EncodedCommand", encoded], { timeout: 25000 });

            if (stdout) {
              const lines = stdout.trim().split(/\r?\n/);
              const foundName = lines[lines.length - 1].trim();
              if (foundName) {
                targetSpoolerName = foundName;
                usbPrinterCache.set(cleanPort, foundName);
              }
            }
          }
        } catch (e) {
          console.warn('[USBPrinterService] Spooler resolution failed:', e.message);
        }

        if (targetSpoolerName && fs.existsSync(exePath)) {
          try {
            const { stdout, stderr } = await execFilePromise(exePath, [targetSpoolerName, tempBin], { timeout: 8000 });
            if (stdout && stdout.includes("SUCCESS")) {
              return {
                success: true,
                actualPort: cleanPort,
                message: `Printed successfully to ${targetSpoolerName}`
              };
            }
            throw new Error(stderr || stdout || 'Unknown error from RawPrinter.exe');
          } catch (fastErr) {
            console.warn('[USBPrinterService] Native print failed:', fastErr.message);
            throw new Error(`Failed to print to ${targetSpoolerName}: ` + fastErr.message);
          }
        }

        throw new Error(`No printer queue found for ${cleanPort} and RawPrinter.exe missing.`);
      });
    } finally {
      try {
        if (fs.existsSync(tempBin)) {
          fs.unlinkSync(tempBin);
        }
      } catch (_) { }
    }
  } else if (process.platform === 'linux' && portName.startsWith('/dev/')) {
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
