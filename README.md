# ALXGBA Studio

- ALXGBA Studio Copyright (c) 2026 Alx5962, also released under the MIT license.
- GBA Studio Copyright (c) 2025 Blue Heron, also released under the MIT license.
- GB Studio Copyright (c) 2024 Chris Maltby, released under the [MIT license](https://opensource.org/licenses/MIT).

ALXGBA Studio is an experimental fork of GB Studio and GBA Studio tailored for Game Boy Advance game development. Like the original, it provides a visual retro game editor for Windows.

## Project Status

<img width="673" height="480" alt="image" src="https://github.com/user-attachments/assets/3e5c7afd-c222-48e3-93ac-08c4681f2a43" />


<img width="647" height="451" alt="image" src="https://github.com/user-attachments/assets/f88dc5e2-879c-4e38-8c0b-18bd9fbda729" />

This project is a prototype, but the editor UI is running and the GBA ROM build path is wired up. The immediate goal is to make the inherited GB Studio authoring workflow produce reproducible `.gba` ROM builds locally and in CI. The editor can launch, sample projects can be built to `.gba`, and Electron packaging scripts are available for installers, though full GB Studio feature parity and complete GBA hardware support are not finished yet.

[Join the GBA STUDIO Discord to share any issues or feedback thanks!](https://discord.gg/3B3SZmdpw)


## Related Work

This fork sits alongside Eoin Jordan's GB Studio MCP/agent work: [gb-studio-agent](https://github.com/eoinjordan/gb-studio-agent). That project explores MCP-driven automation for GB Studio project creation, scenes, actors, assets, validation, and end-to-end workflows. GBA Studio should keep its CLI and project format automation-friendly so that MCP tools can generate, validate, and build projects without depending on manual editor steps.

## Current Capabilities

- Launches the inherited Electron editor UI and supports the editor workflow.
- Builds the CLI bundle with `npm run make:cli`.
- Provides `npm run build:gba -- <project.gbsproj> <out.gba>` as the standard sample ROM build command.
- Provides `npm run test:compile-options` as the end-to-end CLI/export/GBA-ROM compile smoke test.
- Includes `examples/gba-starter-project/project.gbsproj`, a GBA-format conversion of the bundled GB Studio starter sample with scaled backgrounds and scene metadata.
- Includes `examples/poachermon/project.gbsproj` and a matching `gba-poachermon` template as a richer GBA compiler/ROM launch fixture.
- Detects official devkitPro/devkitARM installs instead of relying on stale bundled compiler paths.
- Includes a sample project fixture at `test/data/projects/RunProject/RunProject.gbsproj`.
- Includes CI workflow scaffolding for dependency install, tests, CLI build, devkitPro setup, sample ROM build, emulator smoke test, and generated artifacts.
- Supports local installer/package generation via Electron Forge scripts such as `npm run make:win`, `npm run make:linux`, and `npm run make:mac`.

## Not Finished Yet

- Parts of the editor and asset pipeline still inherit Game Boy screen, palette, sprite, and memory assumptions.
- GBA-specific hardware support, including L/R inputs and broader video/audio/save behavior, is still under active development.
- Emulator and hardware validation need to expand as features are added.

For more information on the upstream project see the original [GB Studio](https://www.gbstudio.dev) site.

![GBA Studio](gbstudio.gif)

GBA Studio consists of an [Electron](https://electronjs.org/) game builder application and a C based game engine using [GBDK](http://gbdk.sourceforge.net/).

## Installation

Download a release installer from the repo's GitHub Releases page, or build from source.

Requirements

- Node.js 20 or newer
- Git
- devkitPro/devkitARM if you want to build `.gba` ROMs
- Optional: mGBA for local emulator smoke tests

Optional host-test requirement for the bundled GBA engine:

- MSYS2 UCRT64 GCC or MSYS2 CLANG64 Clang plus `make` on Windows, or any compatible host `gcc`/`make` on Linux/macOS.

### Build and run from source

<img width="712" height="765" alt="image" src="https://github.com/user-attachments/assets/1b1ef475-520f-400e-8d5f-39f16b95a526" />

Windows (PowerShell):

```powershell
cd gba-studio
git submodule update --init --recursive
powershell -NoProfile -ExecutionPolicy Bypass -File tools\bootstrap.ps1
npm ci
npm run fetch-deps
npm start
```

Linux / macOS:

```bash
cd gba-studio
git submodule update --init --recursive
bash tools/bootstrap.sh
npm ci
npm run fetch-deps
npm start
```

If you use `nvm`, run:

```bash
nvm use
```

### Starter project

A ready-to-run starter project is included at:

- `examples/starter-project/project.gbsproj`

Build a ROM from the starter project:

```bash
npm run make:cli
node out/cli/gb-studio-cli.js make:rom examples/starter-project/project.gbsproj build/starter.gba
```

Export editable build data from the starter project:

```bash
node out/cli/gb-studio-cli.js export -d examples/starter-project/project.gbsproj build/starter-data
```

Open the starter project in the app:

1. Run `npm start`
2. In the editor, open `examples/starter-project/project.gbsproj`

### Validation

Run the default Studio test suite:

```bash
npm test
```

Run the CLI/export/GBA-ROM compile smoke test:

```bash
npm run test:compile-options
```

Run the bundled GBA engine host tests when a host C compiler is installed:

```bash
cd appData/engine/gbavm
make test-host
```

On Windows with MSYS2 UCRT64 installed, make `gcc` and `make` visible to the current PowerShell first:

```powershell
pacman -S --needed mingw-w64-ucrt-x86_64-gcc make
$env:Path = "C:\msys64\ucrt64\bin;$env:Path"
gcc --version
make --version
```

If you installed MSYS2 CLANG64 instead, use `clang` as the host compiler:

```powershell
pacman -S --needed mingw-w64-clang-x86_64-clang make
$env:Path = "C:\msys64\clang64\bin;$env:Path"
$env:HOST_CC = "clang"
clang --version
make --version
```

If the CLI smoke test reports that Electron failed to install correctly, repair the local package and rerun it:

```bash
npm rebuild electron
npm run test:compile-options
```

If `npm start` reaches `Launching dev servers for renderer process code` and exits with `EADDRINUSE` on port 3000, another local process is already using the default Forge dev-server port. Startup probes for the next available port automatically. To force a specific port, set `GBA_STUDIO_WEBPACK_PORT` before launching:

```powershell
$env:GBA_STUDIO_WEBPACK_PORT = "3001"
npm start
```

## GBA Studio CLI

Install GBA Studio from source as above then:

```bash
npm run make:cli
```

The CLI entrypoint is `out/cli/gb-studio-cli.js`. Common commands are documented in `docs/CLI_USAGE.md`.

### Update the CLI

Pull the latest code and run `make:cli` again.

```bash
> npm run make:cli
```

### CLI Examples

- **Export Project**

  ```bash
  > node out/cli/gb-studio-cli.js export path/to/project.gbsproj out/
  ```

  Export GBDK project from gbsproj to out directory

- **Export Data**
  ```bash
  > node out/cli/gb-studio-cli.js export path/to/project.gbsproj out/ -d
  ```
  Export only src/data and include/data from gbsproj to out directory
- **Make ROM**

  ```bash
  > node out/cli/gb-studio-cli.js make:rom path/to/project.gbsproj out/game.gba
  ```

  Make a GBA ROM file from gbsproj

- **Make Pocket**

  ```bash
  > node out/cli/gb-studio-cli.js make:pocket path/to/project.gbsproj out/game.pocket
  ```

  Make a Pocket file from gbsproj

- **Make Web**
  ```bash
  > node out/cli/gb-studio-cli.js make:web path/to/project.gbsproj out/
  ```
  Make a Web build from gbsproj

## Documentation

See the `docs/` folder for repository-specific guides:

- `docs/GETTING_STARTED.md` - quickstart and run instructions
- `docs/PROJECT_AIMS.md` - project aims, current status, and build workflow
- `docs/GBA_SCRIPT_BACKEND.md` - current proof-build behavior and real backend plan
- `docs/DEVKIT_SETUP.md` - devkitPro installation and verification
- `docs/CLI_USAGE.md` - CLI commands and examples
- `docs/EMULATOR.md` - emulator smoke tests and CI usage
- `docs/CI.md` - CI notes and recommendations
- `docs/CONTRIBUTING.md` - contributing and development workflow

## Prebuilt packages

When a tag is pushed, the release workflow builds the sample `.gba` ROM and publishes application installers for supported platforms.

### Local package builds

Build installers locally with Electron Forge.

Windows:

```powershell
cd gba-studio
npm ci
npm run make:win
Get-ChildItem -Path .\out\make -Recurse
```

The generated installers are written to `gba-studio/out/make`.

### Attach local packages to a release

If you build installers locally and want them on a GitHub Release, upload the files from `gba-studio/out/make` when you create or update the tag release.

Notes

- Windows packaging may require Wine and Mono when built from Linux.
- macOS packaging may require a macOS runner or local macOS machine if you want signed `.app`/`.zip` bundles.
- If a local package build fails, inspect `gba-studio/out/make` and `gba-studio/out` for logs.

[GB Studio Documentation](https://www.gbstudio.dev/docs)

## Note For Translators

If you're looking to update an existing translation with content that is missing, there is a handy script that lists keys found in the English localisation that are not found and copies them to your localisation

```bash
npm run missing-translations lang
# e.g. npm run missing-translations de
# e.g. npm run missing-translations en-GB
```
