$ErrorActionPreference = 'Stop'

$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RootDir

Write-Host "[release] enabling corepack"
corepack enable | Out-Host

Write-Host "[release] installing deps"
try { yarn install --frozen-lockfile | Out-Host } catch { npm ci | Out-Host }

Write-Host "[release] fetching deps"
npm run fetch-deps | Out-Host

Write-Host "[release] running tests"
npm test | Out-Host

Write-Host "[release] building CLI"
npm run make:cli | Out-Host

Write-Host "[release] building sample GBA ROM"
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba | Out-Host

Write-Host "[release] exporting sample project data"
New-Item -ItemType Directory -Force -Path out\ci | Out-Null
node out/cli/gb-studio-cli.js export test/data/projects/RunProject/RunProject.gbsproj out\ci\RunProject | Out-Host

Write-Host "[release] packaging app (electron-forge make)"
npm run make | Out-Host

Write-Host "[release] artifacts in out\"
