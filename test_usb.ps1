$pnpList = Get-PnpDevice -PresentOnly -Status 'OK' -ErrorAction SilentlyContinue
$usbPrintDevices = $pnpList | Where-Object { $_.InstanceId -match 'USBPRINT' }
$usbPrintDevices | ConvertTo-Json -Compress
