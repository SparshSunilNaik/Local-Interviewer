$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location "$Root\backend"
uv sync --group dev --group audio
Set-Location "$Root\frontend"
npm install
Write-Host "Setup complete. Start backend and frontend in separate terminals; see docs/SETUP_WINDOWS.md."
