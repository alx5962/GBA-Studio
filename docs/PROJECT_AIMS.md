# Project Aims

GBA Studio is an experimental fork of GB Studio for making Game Boy Advance ROMs. The project is not trying to hide the GB Studio inheritance; the short-term goal is to keep the familiar editor and project workflow while replacing the build target, runtime assumptions, and validation path with GBA-specific behavior.

## Goals

- Produce real `.gba` ROM files from `.gbsproj` projects.
- Keep the build path reproducible through scripts and GitHub Actions.
- Move the editor and engine toward GBA-native limits: 240x160 display, 30x20 tile viewport, A/B/Start/Select/D-pad plus L/R input, and GBA-aware sprites, palettes, backgrounds, audio, saves, and timing.
- Keep the CLI useful for automation, CI, MCP workflows, and future project generators.
- Add small sample projects that prove each supported feature through build and emulator smoke tests.

## Related GB Studio MCP Work

Eoin Jordan's [gb-studio-agent](https://github.com/eoinjordan/gb-studio-agent) project explores MCP and agent-driven workflows for GB Studio automation, including project management, scene and actor operations, asset creation, validation, and end-to-end generation flows.

That work is relevant here because GBA Studio should expose a reliable non-interactive workflow:

- project files stay machine-editable
- build commands work without opening the GUI
- validation can run in CI
- sample projects can be generated or checked by external tools
- future MCP tools can target GBA Studio without relying on private editor state

## Current Stage

The project is at an early developer-preview stage.

Working or partially working:

- Electron editor launch path inherited from GB Studio.
- CLI bundle build through `npm run make:cli`.
- GBA build wrapper through `npm run build:gba`.
- Official devkitPro/devkitARM detection.
- Sample project fixture for build testing.
- GitHub Actions workflow for tests, CLI build, sample ROM build, emulator smoke test, and artifacts.

Still incomplete:

- Local ROM output must be proven with official devkitPro installed.
- The editor still has Game Boy screen-size and asset assumptions in places.
- GBA hardware support is not complete.
- L/R input, GBA-specific video behavior, save behavior, audio behavior, and hardware-limit validation need dedicated work.
- More emulator and real-hardware smoke tests are needed.

## Build Repository Workflow

Use this sequence when validating the repository from source:

```bash
corepack enable
yarn install --immutable
npm run fetch-deps
npm test
npm run make:cli
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
npm run test:emu -- out/RunProject.gba
```

If Corepack/Yarn is not available, use `npm ci` before `npm run fetch-deps`.

On Windows, install devkitPro to `C:\devkitPro` unless you have a specific reason to use another path. Before building, verify:

```powershell
$env:DEVKITPRO = "C:\devkitPro"
$env:DEVKITARM = "C:\devkitPro\devkitARM"
$env:Path = "$env:DEVKITARM\bin;$env:Path"
arm-none-eabi-gcc --version
```

The active PR workflow should be:

```bash
git checkout -b gba-rom-release-workflow
# make changes
npm test
npm run make:cli
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
git push fork gba-rom-release-workflow
```

Then open or update a pull request from `eoinjordan/gb-studio:gba-rom-release-workflow` to `blueheron786/gba-studio:main`.
