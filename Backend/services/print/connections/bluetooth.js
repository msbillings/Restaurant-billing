import fs from 'fs';
import path from 'path';
import os from 'os';
import { execPromise, btComPortCache } from './portLocks.js';

export async function getPrinterBatteryStatus(address) {
  return { success: false, message: 'Battery polling over Desktop SPP is not supported by printer hardware.' };
}

export async function scanBluetoothDevices() {
  if (process.platform === 'win32') {
    const psScript = `
      $ErrorActionPreference = 'SilentlyContinue'

      $radio = Get-PnpDevice -Class 'Bluetooth' -Status 'OK' -ErrorAction SilentlyContinue |
        Where-Object { $_.FriendlyName -match '(?i)(radio|adapter|intel|realtek|qualcomm|broadcom|mediatek)' }

      if (-not $radio) {
        Write-Output '{"btAvailable":false,"devices":[]}'
        exit
      }

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
          $mac = ($raw -split '(?<=\\G.{2})(?=.)') -join ':'
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
        { timeout: 30000 }
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

  return { btAvailable: false, devices: [] };
}

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

    if (btComPortCache.has(cacheKey)) {
      const cachedPort = btComPortCache.get(cacheKey);
      try {
        const fastScript = `
          $ErrorActionPreference = 'Stop'
          $rawBytes = [System.IO.File]::ReadAllBytes('${tempBinEscaped}')
          $sp = New-Object System.IO.Ports.SerialPort '${cachedPort}', 115200, 'None', 8, 'One'
          $sp.WriteTimeout = 6000
          $sp.ReadTimeout = 500
          try {
            $sp.Open()
            $chunkSize = 512
            for ($offset = 0; $offset -lt $rawBytes.Length; $offset += $chunkSize) {
              $count = [Math]::Min($chunkSize, $rawBytes.Length - $offset)
              $sp.Write($rawBytes, $offset, $count)
              Start-Sleep -Milliseconds 10
            }
            Start-Sleep -Milliseconds 200
            $sp.Close()
          } catch {
            if ($sp.IsOpen) { $sp.Close() }
            throw $_
          }
        `;
        const encodedFast = Buffer.from(fastScript, 'utf16le').toString('base64');
        await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedFast}`, { timeout: 45000 });
        try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) { }
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

      $matchedPort = ''
      $bthEnumPath = 'HKLM:\\SYSTEM\\CurrentControlSet\\Enum\\BTHENUM'
      if (Test-Path $bthEnumPath) {
        $bthKeys = Get-ChildItem -Path $bthEnumPath -Recurse -Depth 1 -ErrorAction SilentlyContinue
        foreach ($key in $bthKeys) {
          if ($cleanMac -and $key.PSChildName.ToUpper() -match $cleanMac) {
            $devParams = Join-Path -Path $key.PSPath -ChildPath 'Device Parameters'
            if (Test-Path $devParams) {
              $portName = (Get-ItemProperty -Path $devParams -Name 'PortName' -ErrorAction SilentlyContinue).PortName
              if ($portName -match 'COM\\d+') {
                $matchedPort = $portName
                break
              }
            }
          }
        }
      }

      if (-not $matchedPort) {
        Write-Output "PRINTER_OFFLINE: Printer $targetName ($cleanMac) has no assigned COM port. Make sure it's paired via Classic Bluetooth (not LE)."
        exit 1
      }

      $rawBytes = [System.IO.File]::ReadAllBytes('${tempBinEscaped}')
      $sp = New-Object System.IO.Ports.SerialPort $matchedPort, 115200, 'None', 8, 'One'
      $sp.WriteTimeout = 6000
      $sp.ReadTimeout = 500
      try {
        $sp.Open()
        $chunkSize = 512
        for ($offset = 0; $offset -lt $rawBytes.Length; $offset += $chunkSize) {
          $count = [Math]::Min($chunkSize, $rawBytes.Length - $offset)
          $sp.Write($rawBytes, $offset, $count)
          Start-Sleep -Milliseconds 10
        }
        Start-Sleep -Milliseconds 200
        $sp.Close()
        Write-Output "SUCCESS:$matchedPort"
      } catch {
        if ($sp.IsOpen) { $sp.Close() }
        Write-Output "ERROR: Failed to send data to Bluetooth port $matchedPort : $($_.Exception.Message)"
        exit 1
      }
    `;

    try {
      const encoded = Buffer.from(fullScript, 'utf16le').toString('base64');
      const { stdout } = await execPromise(
        `powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`,
        { timeout: 60000 }
      );
      try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) { }

      const out = (stdout || '').trim();
      const portMatch = out.match(/SUCCESS:(.+)/i);
      if (portMatch && portMatch[1]) {
        const discoveredPort = portMatch[1].trim();
        console.log(`[BluetoothPrinter] COM port detected: ${discoveredPort}`);
        btComPortCache.set(cacheKey, discoveredPort);
      }
      return { success: true, message: out || `Printed to Bluetooth port for ${addressOrName}` };
    } catch (err) {
      try { if (fs.existsSync(tempBin)) fs.unlinkSync(tempBin); } catch (_) { }
      const rawMsg = (err.stderr || err.stdout || err.message || '');

      const offlineMatch = rawMsg.match(/PRINTER_OFFLINE:\s*(.+)/i);
      if (offlineMatch) throw new Error(offlineMatch[1].trim());

      const writeErrMatch = rawMsg.match(/ERROR:\s*(.+)/i);
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
