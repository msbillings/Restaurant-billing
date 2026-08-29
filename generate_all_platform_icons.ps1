Add-Type -AssemblyName System.Drawing

$logoPath = "d:\restaurant\Restaurant-billing\Frontend\public\msbillings_logo.jpeg"
$srcImage = [System.Drawing.Image]::FromFile($logoPath)
Write-Host "Source Logo loaded: $($srcImage.Width) x $($srcImage.Height)"

# 1. Create Master 1024x1024 Square Icon Bitmap (White background with padding)
$masterSize = 1024
$masterBmp = New-Object System.Drawing.Bitmap($masterSize, $masterSize)
$g = [System.Drawing.Graphics]::FromImage($masterBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.Clear([System.Drawing.Color]::White)

$padding = 80
$targetWidth = $masterSize - ($padding * 2)
$targetHeight = $masterSize - ($padding * 2)

$ratio = [Math]::Min($targetWidth / $srcImage.Width, $targetHeight / $srcImage.Height)
$drawW = [int]($srcImage.Width * $ratio)
$drawH = [int]($srcImage.Height * $ratio)
$drawX = [int](($masterSize - $drawW) / 2)
$drawY = [int](($masterSize - $drawH) / 2)

$g.DrawImage($srcImage, $drawX, $drawY, $drawW, $drawH)
$g.Dispose()

# Helper function to resize bitmap and save as PNG
function Save-ResizedPng($srcBmp, $destPath, $w, $h) {
    $parentDir = [System.IO.Path]::GetDirectoryName($destPath)
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }
    $resized = New-Object System.Drawing.Bitmap($w, $h)
    $g2 = [System.Drawing.Graphics]::FromImage($resized)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g2.DrawImage($srcBmp, 0, 0, $w, $h)
    $g2.Dispose()

    $resized.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $resized.Dispose()
    Write-Host " Saved PNG: $destPath ($w x $h)"
}

# Helper function to generate multi-size ICO
function Save-MultiSizeIco($srcBmp, $destPath, $sizes) {
    $pngBytesList = New-Object System.Collections.Generic.List[byte[]]

    foreach ($size in $sizes) {
        $bmp = New-Object System.Drawing.Bitmap($size, $size)
        $gIco = [System.Drawing.Graphics]::FromImage($bmp)
        $gIco.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gIco.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gIco.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gIco.DrawImage($srcBmp, 0, 0, $size, $size)
        $gIco.Dispose()

        $ms = New-Object System.IO.MemoryStream
        $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngBytesList.Add($ms.ToArray())
        $bmp.Dispose()
        $ms.Dispose()
    }

    $fileStream = [System.IO.File]::Create($destPath)
    $writer = New-Object System.IO.BinaryWriter($fileStream)

    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$sizes.Length)

    $offset = 6 + (16 * $sizes.Length)

    for ($i = 0; $i -lt $sizes.Length; $i++) {
        $size = $sizes[$i]
        $bytes = $pngBytesList[$i]
        $wByte = if ($size -ge 256) { [byte]0 } else { [byte]$size }
        $hByte = if ($size -ge 256) { [byte]0 } else { [byte]$size }

        $writer.Write($wByte)
        $writer.Write($hByte)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$bytes.Length)
        $writer.Write([UInt32]$offset)

        $offset += $bytes.Length
    }

    for ($i = 0; $i -lt $sizes.Length; $i++) {
        $writer.Write($pngBytesList[$i])
    }

    $writer.Flush()
    $writer.Close()
    $fileStream.Close()
    Write-Host " Saved Multi-Size ICO: $destPath ($($sizes -join ', '))"
}

Write-Host "`n--- 1. DESKTOP APP (.EXE & .DMG) ---"
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Desktop\icon.png" 512 512
Save-MultiSizeIco $masterBmp "d:\restaurant\Restaurant-billing\Desktop\icon.ico" @(16, 24, 32, 48, 64, 128, 256)

Write-Host "`n--- 2. WEB / LOCALHOST & VERCEL (FAVICONS & PWA) ---"
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\icon.png" 512 512
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\icon_512.png" 512 512
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\favicon.png" 64 64
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\apple-touch-icon.png" 180 180
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\pwa-192x192.png" 192 192
Save-ResizedPng $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\pwa-512x512.png" 512 512
Save-MultiSizeIco $masterBmp "d:\restaurant\Restaurant-billing\Frontend\public\favicon.ico" @(16, 32, 48, 64)

Write-Host "`n--- 3. ANDROID APP (.APK) MIPMAPS ---"
$androidRes = "d:\restaurant\Restaurant-billing\Frontend\android\app\src\main\res"

$androidSizes = @{
    "mipmap-mdpi" = @{ launcher = 48; foreground = 108 }
    "mipmap-hdpi" = @{ launcher = 72; foreground = 162 }
    "mipmap-xhdpi" = @{ launcher = 96; foreground = 216 }
    "mipmap-xxhdpi" = @{ launcher = 144; foreground = 324 }
    "mipmap-xxxhdpi" = @{ launcher = 192; foreground = 432 }
}

foreach ($folder in $androidSizes.Keys) {
    $sizes = $androidSizes[$folder]
    $lSize = $sizes.launcher
    $fSize = $sizes.foreground

    Save-ResizedPng $masterBmp "$androidRes\$folder\ic_launcher.png" $lSize $lSize
    Save-ResizedPng $masterBmp "$androidRes\$folder\ic_launcher_round.png" $lSize $lSize
    Save-ResizedPng $masterBmp "$androidRes\$folder\ic_launcher_foreground.png" $fSize $fSize
}

Write-Host "`n--- 4. IOS APP (.IPA) ---"
$iosAppIcon = "d:\restaurant\Restaurant-billing\Frontend\ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"
Save-ResizedPng $masterBmp $iosAppIcon 1024 1024

$srcImage.Dispose()
$masterBmp.Dispose()

Write-Host "`n🎉 ALL ICONS FOR .EXE, .APK, .DMG, .IPA, AND WEBSITE FAVICONS GENERATED SUCCESSFULLY!" -ForegroundColor Green
