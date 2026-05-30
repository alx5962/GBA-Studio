# Getting Started

This guide covers running GBA Studio from source, opening the GUI, and building a sample `.gba` ROM with the CLI.

The repository root for commands is the nested `gba-studio` folder. For example, on the current Windows checkout:

```powershell
Set-Location "C:\Users\Eoin\git\GBAStudio\gba-studio"
```

## Prerequisites

- Node.js matching `.nvmrc`.
- Git.
- devkitPro/devkitARM for ROM builds. See `docs/DEVKIT_SETUP.md`.

## Install and Run

```bash
git clone https://github.com/blueheron786/gba-studio.git
cd gba-studio
corepack enable
yarn install --immutable
npm run fetch-deps
npm start
```

On Windows, the helper script can do the same setup:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\bootstrap.ps1
```

If devkitPro is installed to the default Windows path, verify it before building:

```powershell
$env:DEVKITPRO = "C:\devkitPro"
$env:DEVKITARM = "C:\devkitPro\devkitARM"
$env:Path = "$env:DEVKITARM\bin;$env:Path"
arm-none-eabi-gcc --version
```

On macOS or Linux:

```bash
bash tools/bootstrap.sh
```

If Corepack/Yarn is unavailable, use npm:

```bash
npm ci
npm run fetch-deps
npm start
```

## Open a Sample Project

```bash
npm start -- "test/data/projects/RunProject/RunProject.gbsproj"
```

## Build a Sample ROM

```bash
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
```

The command builds the CLI bundle first, then calls `make:rom`.

## Verify

```bash
npm test
npm run make:cli
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
npm run test:emu -- out/RunProject.gba
```

If the native link step fails, confirm `DEVKITPRO`, `DEVKITARM`, and `arm-none-eabi-gcc` are available as described in `docs/DEVKIT_SETUP.md`.
