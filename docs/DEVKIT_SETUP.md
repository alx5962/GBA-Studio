# devkitPro / devkitARM Setup

GBA Studio uses devkitARM to compile and link `.gba` ROMs. The build expects:

- `DEVKITPRO` set to the devkitPro root, usually `/opt/devkitpro` on Linux or `C:\devkitPro` on Windows.
- `DEVKITARM` set to the devkitARM root, usually `$DEVKITPRO/devkitARM` or `C:\devkitPro\devkitARM`.
- `arm-none-eabi-gcc` available at `$DEVKITARM/bin/arm-none-eabi-gcc`.

## Linux (Ubuntu)

Install devkitPro pacman, then install the GBA toolchain group:

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends ca-certificates curl
curl -L https://github.com/devkitPro/pacman/releases/latest/download/devkitpro-pacman.deb -o /tmp/devkitpro-pacman.deb
sudo apt-get install -y /tmp/devkitpro-pacman.deb
sudo dkp-pacman -Sy --needed gba-dev
```

Set environment variables for the current shell:

```bash
export DEVKITPRO=/opt/devkitpro
export DEVKITARM=$DEVKITPRO/devkitARM
export PATH=$DEVKITARM/bin:$PATH
```

## macOS

Install the devkitPro pacman package from the latest devkitPro pacman release, then install the GBA toolchain:

```bash
sudo dkp-pacman -Sy --needed gba-dev
```

Set the same environment variables as Linux. If the installer writes shell profile files, restart the terminal before verifying.

## Windows

Use the official devkitPro Windows installer, or install through MSYS2 with devkitPro pacman. After installation, open the devkitPro/MSYS2 shell and verify:

```bash
echo $DEVKITPRO
echo $DEVKITARM
arm-none-eabi-gcc --version
```

PowerShell builds also work when the equivalent Windows environment variables are set.

For a default `C:\devkitPro` install in PowerShell:

```powershell
$env:DEVKITPRO = "C:\devkitPro"
$env:DEVKITARM = "C:\devkitPro\devkitARM"
$env:Path = "$env:DEVKITARM\bin;$env:Path"
arm-none-eabi-gcc --version
```

To persist these for new PowerShell sessions:

```powershell
[Environment]::SetEnvironmentVariable("DEVKITPRO", "C:\devkitPro", "User")
[Environment]::SetEnvironmentVariable("DEVKITARM", "C:\devkitPro\devkitARM", "User")
```

Restart the terminal after changing persisted environment variables.

## Verify

```bash
arm-none-eabi-gcc --version
npm run build:gba -- test/data/projects/RunProject/RunProject.gbsproj out/RunProject.gba
```

If you see a platform compatibility error from a bundled compiler, install the official devkitPro toolchain and make sure `DEVKITARM` points at that install.
