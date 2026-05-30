# GBA Studio

- GBA Studio Copyright (c) 2025 Blue Heron, also released under the MIT license.
- GB Studio Copyright (c) 2024 Chris Maltby, released under the [MIT license](https://opensource.org/licenses/MIT).

GBA Studio is an experimental fork of GB Studio tailored for Game Boy Advance game development. Like the original, it provides a visual retro game editor for Mac, Linux, and Windows.

## Project Status

This project is a prototype. The immediate goal is to make the inherited GB Studio authoring workflow produce reproducible `.gba` ROM builds locally and in CI. The editor can launch and the CLI/build path is being wired up, but full GB Studio feature parity and complete GBA hardware support are not finished yet.

## Aims

- Keep GB Studio's approachable visual workflow while targeting Game Boy Advance ROM output.
- Make the GBA build chain explicit, repeatable, and testable on developer machines and GitHub Actions.
- Support GBA-sized games deliberately, including the 240x160 display, 30x20 tile viewport, A/B/Start/Select/D-pad plus L/R input, and GBA-aware video, sprite, palette, audio, save, and timing constraints.
- Add sample projects and emulator smoke tests for each supported GBA feature.
- Keep the project scriptable through CLI workflows so it can support automation and external tooling.

## Related Work

This fork sits alongside Eoin Jordan's GB Studio MCP/agent work: [gb-studio-agent](https://github.com/eoinjordan/gb-studio-agent). That project explores MCP-driven automation for GB Studio project creation, scenes, actors, assets, validation, and end-to-end workflows. GBA Studio should keep its CLI and project format automation-friendly so that MCP tools can generate, validate, and build projects without depending on manual editor steps.

## Current Capabilities

- Launches the inherited Electron editor.
- Builds the CLI bundle with `npm run make:cli`.
- Provides `npm run build:gba -- <project.gbsproj> <out.gba>` as the standard sample ROM build command.
- Detects official devkitPro/devkitARM installs instead of relying on stale bundled compiler paths.
- Includes a sample project fixture at `test/data/projects/RunProject/RunProject.gbsproj`.
- Includes CI workflow scaffolding for dependency install, tests, CLI build, devkitPro setup, sample ROM build, emulator smoke test, and artifacts.

## Not Finished Yet

- A local `.gba` build must still be proven on machines that have official devkitPro/devkitARM installed.
- Parts of the editor and asset pipeline still inherit Game Boy screen, palette, sprite, and memory assumptions.
- GBA-specific hardware support, including L/R inputs and broader video/audio/save behavior, is still under active development.
- Emulator and hardware validation need to expand as features are added.

For more information on the upstream project see the original [GB Studio](https://www.gbstudio.dev) site.

![GBA Studio](gbstudio.gif)

GBA Studio consists of an [Electron](https://electronjs.org/) game builder application and a C based game engine using [GBDK](http://gbdk.sourceforge.net/).

## Installation / From source

Download a release for your operating system from this repository's GitHub Releases page, or run from source:

Prerequisites

- Node.js (LTS recommended)
- Git
- devkitPro/devkitARM if you plan to build `.gba` files (see `docs/DEVKIT_SETUP.md`)

Quick start (use the bootstrap script to enable Corepack/Yarn or fall back to `npm`):

```bash
cd gba-studio
# Linux / macOS
bash tools/bootstrap.sh
# Windows (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File tools\bootstrap.ps1
```

If you prefer `npm` instead of Yarn/Corepack:

```bash
npm ci
npm run fetch-deps
npm start
```

After checking out a new version run:

```bash
npm run fetch-deps
```

If you use `nvm` you can switch to the repository Node version with `.nvmrc`:

```bash
nvm use
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
- `docs/DEVKIT_SETUP.md` - devkitPro installation and verification
- `docs/CLI_USAGE.md` - CLI commands and examples
- `docs/EMULATOR.md` - emulator smoke tests and CI usage
- `docs/CI.md` - CI notes and recommendations
- `docs/CONTRIBUTING.md` - contributing and development workflow

## Prebuilt Packages

Prebuilt installers are produced by the project's CI when a Git tag is pushed. Download installers from the GitHub Release created for the tag or from the workflow artifacts.

### Local Package Builds

You can build platform installers locally using Electron Forge. The project includes convenience npm scripts for each platform:

Windows:

```powershell
Set-Location 'c:\Users\Eoin\git\GBAStudio\gba-studio'
npm ci
npm run make:win
# Output installers will be in the out/make/ folder
Get-ChildItem -Path .\out\make -Recurse
```

Linux:

```bash
cd gba-studio
npm ci
npm run make:linux
ls -la out/make
```

macOS:

```bash
cd gba-studio
npm ci
npm run make:mac
ls -la out/make
```

Notes

- Packaging may require additional platform tools (codesign on macOS, signing/certificate tooling on Windows). CI will produce unsigned packages by default unless signing secrets are provided.
- If a local package build fails, check the `out/` and `out/make/` directories for logs and artifacts and consult `docs/CI.md` for troubleshooting.

[GB Studio Documentation](https://www.gbstudio.dev/docs)

## Note For Translators

If you're looking to update an existing translation with content that is missing, there is a handy script that lists keys found in the English localisation that are not found and copies them to your localisation

```bash
npm run missing-translations lang
# e.g. npm run missing-translations de
# e.g. npm run missing-translations en-GB
```
