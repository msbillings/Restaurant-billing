param (
    [Parameter(Mandatory=$true)]
    [string]$Port,

    [Parameter(Mandatory=$true)]
    [string]$File,

    [Parameter(Mandatory=$false)]
    [string]$PrinterName = ''
)

$ErrorActionPreference = 'Stop'

$Source = @"
using System;
using System.Runtime.InteropServices;
public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;
        di.pDocName = "MS_BILLING_RAW";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return bSuccess;
    }
}
"@
Add-Type -TypeDefinition $Source -ErrorAction SilentlyContinue

$cleanPort = ($Port -replace '[:\\/]', '').Trim()

# 1. Check physical connectivity for USB printer ports
if ($cleanPort -match '^USB\d+$') {
    $activeUsbDevices = Get-PnpDevice -PresentOnly -Status 'OK' -ErrorAction SilentlyContinue |
                        Where-Object { $_.InstanceId -match 'USBPRINT' }

    $targetDevice = $activeUsbDevices | Where-Object { $_.InstanceId -match [regex]::Escape($cleanPort) } | Select-Object -First 1

    if (-not $targetDevice -and $activeUsbDevices) {
        # Target USB port is not physically connected, but another active USBPRINT device IS connected!
        $firstActive = $activeUsbDevices[0]
        if ($firstActive.InstanceId -match '(USB\d+)') {
            $reroutedPort = $matches[1]
            Write-Host "NOTE: Configured USB port '$cleanPort' is offline; auto-rerouting to active port '$reroutedPort' ($($firstActive.FriendlyName))"
            $cleanPort = $reroutedPort
            $Port = $reroutedPort
        }
    } elseif (-not $targetDevice -and -not $activeUsbDevices) {
        Write-Error "FAILED: No physical USB thermal printer is connected or powered on. Please check the USB cable and printer power switch."
        exit 1
    }
}

# 2. Find or create the Windows Print Spooler queue for this port
$allPrinters = Get-Printer -ErrorAction SilentlyContinue
$targetPrinter = $null

# Priority 1: Match printer queue that is bound to the target $cleanPort
$targetPrinter = $allPrinters | Where-Object {
    ($_.PortName -replace '[:\\/]', '').Trim() -eq $cleanPort
} | Select-Object -First 1

# Priority 2: If none matched by port, but $PrinterName is on $cleanPort
if (-not $targetPrinter -and $PrinterName) {
    $namedPrinter = $allPrinters | Where-Object { $_.Name -eq $PrinterName } | Select-Object -First 1
    if ($namedPrinter -and ($namedPrinter.PortName -replace '[:\\/]', '').Trim() -eq $cleanPort) {
        $targetPrinter = $namedPrinter
    }
}

if (-not $targetPrinter) {
    $autoName = "MS_POS_" + $cleanPort
    try {
        Add-Printer -Name $autoName -DriverName "POS80" -PortName $cleanPort -ErrorAction Stop
        $targetPrinter = Get-Printer -Name $autoName -ErrorAction Stop
    } catch {
        Write-Error "Could not auto-create queue for port $cleanPort : $($_.Exception.Message)"
        exit 1
    }
}

$printerQueueName = $targetPrinter.Name

# 3. Clean any stale or errored jobs in queue to avoid spooler hang
$stuckJobs = Get-PrintJob -PrinterName $printerQueueName -ErrorAction SilentlyContinue
foreach ($job in $stuckJobs) {
    if ($job.JobStatus -match 'Error|Offline|UserIntervention' -or $job.DocumentName -eq 'MS_BILLING_RAW') {
        Remove-PrintJob -PrinterName $printerQueueName -ID $job.Id -ErrorAction SilentlyContinue
    }
}

# 4. Read file and send raw bytes directly to printer
$rawBytes = [System.IO.File]::ReadAllBytes($File)
$success = [RawPrinterHelper]::SendBytesToPrinter($printerQueueName, $rawBytes)
if ($success) {
    Write-Output "SUCCESS: Printed raw data to $printerQueueName on $cleanPort"
} else {
    Write-Error "FAILED: SendBytesToPrinter returned false for $printerQueueName on $cleanPort"
    exit 1
}
