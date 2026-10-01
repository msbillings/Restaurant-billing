npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npx cap sync android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

cd android
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

.\gradlew assembleRelease
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "APK built successfully!"
