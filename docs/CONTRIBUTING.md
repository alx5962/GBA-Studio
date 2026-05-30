# Contributing

This fork is focused on making the GB Studio workflow produce Game Boy Advance ROMs.

See `docs/PROJECT_AIMS.md` for the current project aims, GBA support status, and how the related GB Studio MCP/agent work fits into the automation direction.

## Setup

```bash
corepack enable
yarn install --immutable
npm run fetch-deps
npm test
```

Use `npm ci` if Corepack/Yarn is unavailable.

## Build Workflow

The repository build workflow is:

```bash
npm run fetch-deps
npm test
npm run make:cli
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
npm run test:emu -- out/RunProject.gba
```

`npm run build:gba` is the canonical ROM-build entry point. It rebuilds the CLI and then calls `make:rom` for the target project.

Use official devkitPro/devkitARM for ROM builds. On Windows, the expected default install path is `C:\devkitPro`; verify `DEVKITPRO`, `DEVKITARM`, and `arm-none-eabi-gcc --version` before debugging build failures.

## Before Opening a PR

Run the checks that match your change:

```bash
npm test
npm run make:cli
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
```

For compiler, CI, or ROM-output changes, also run:

```bash
npm run test:emu -- out/RunProject.gba
```

## Notes

- Keep generated build outputs out of git.
- Do not commit local toolchain installs.
- Prefer POSIX-style paths for project resource paths stored in `.gbsres` files.
