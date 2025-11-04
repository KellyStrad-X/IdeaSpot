@echo off
echo ========================================
echo IdeaSpot Complete Cache Clean (Windows)
echo ========================================
echo.

echo [1/7] Stopping any running Metro bundlers...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/7] Removing node_modules...
if exist node_modules (
    rmdir /s /q node_modules
    echo     node_modules deleted
) else (
    echo     node_modules not found
)

echo [3/7] Removing .expo cache...
if exist .expo (
    rmdir /s /q .expo
    echo     .expo deleted
) else (
    echo     .expo not found
)

echo [4/7] Removing package-lock.json...
if exist package-lock.json (
    del /f /q package-lock.json
    echo     package-lock.json deleted
) else (
    echo     package-lock.json not found
)

echo [5/7] Clearing Metro bundler cache...
if exist "%LOCALAPPDATA%\Temp\metro-*" (
    del /f /s /q "%LOCALAPPDATA%\Temp\metro-*" 2>nul
    echo     Metro cache cleared
)

if exist "%TEMP%\metro-*" (
    del /f /s /q "%TEMP%\metro-*" 2>nul
    echo     Metro temp cache cleared
)

if exist "%TEMP%\haste-*" (
    del /f /s /q "%TEMP%\haste-*" 2>nul
    echo     Haste cache cleared
)

echo [6/7] Clearing React Native cache...
if exist "%LOCALAPPDATA%\Temp\react-*" (
    del /f /s /q "%LOCALAPPDATA%\Temp\react-*" 2>nul
    echo     React Native cache cleared
)

echo [7/7] Installing fresh dependencies...
call npm install
echo.

echo ========================================
echo ✓ Cleanup complete!
echo ========================================
echo.
echo Next steps:
echo 1. Run: npx expo start --clear
echo 2. On your iPhone: Force quit Expo Go and rescan QR code
echo.
pause
