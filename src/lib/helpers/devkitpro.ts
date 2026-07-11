import { existsSync } from "fs";
import { join } from "path";
import { spawnSync } from "child_process";

export interface DevKitProPaths {
  devkitPro: string;
  devkitArm: string;
  gccPath: string;
  isValid: boolean;
}

export const isUsableGcc = (gccPath: string): boolean => {
  if (!existsSync(gccPath)) {
    return false;
  }

  const result = spawnSync(gccPath, ["--version"], {
    stdio: "ignore",
    timeout: 5000,
  });

  return !result.error && result.status === 0;
};

export function getDevKitProPaths(): DevKitProPaths {
  // Check environment variables first
  let devkitPro = process.env.DEVKITPRO;
  let devkitArm = process.env.DEVKITARM;

  if (process.platform === "win32") {
    const driveLetterRegex = /^\/([a-zA-Z])\/(.*)$/;
    if (devkitPro && driveLetterRegex.test(devkitPro)) {
      devkitPro = devkitPro.replace(driveLetterRegex, "$1:\\$2");
    }
    if (devkitArm && driveLetterRegex.test(devkitArm)) {
      devkitArm = devkitArm.replace(driveLetterRegex, "$1:\\$2");
    }

    const optPathRegex = /^\/opt\/devkitpro/i;
    if (devkitPro && optPathRegex.test(devkitPro)) {
      const drives = ["C:", "D:", "E:", "F:", "G:"];
      for (const drive of drives) {
        const potentialPath = devkitPro.replace(optPathRegex, `${drive}\\devkitPro`);
        const normalizedPotential = potentialPath.replace(/\//g, "\\");
        if (existsSync(normalizedPotential)) {
          devkitPro = normalizedPotential;
          break;
        }
      }
    }
    if (devkitArm && optPathRegex.test(devkitArm)) {
      const drives = ["C:", "D:", "E:", "F:", "G:"];
      for (const drive of drives) {
        const potentialPath = devkitArm.replace(optPathRegex, `${drive}\\devkitPro`);
        const normalizedPotential = potentialPath.replace(/\//g, "\\");
        if (existsSync(normalizedPotential)) {
          devkitArm = normalizedPotential;
          break;
        }
      }
    }

    if (devkitPro) {
      devkitPro = devkitPro.replace(/\//g, "\\");
    }
    if (devkitArm) {
      devkitArm = devkitArm.replace(/\//g, "\\");
    }
  }

  if (devkitPro && devkitArm) {
    const gccPath = join(
      devkitArm,
      "bin",
      process.platform === "win32"
        ? "arm-none-eabi-gcc.exe"
        : "arm-none-eabi-gcc",
    );

    if (isUsableGcc(gccPath)) {
      return {
        devkitPro,
        devkitArm,
        gccPath,
        isValid: true,
      };
    }
  }

  // Fallback: Try common installation paths
  const commonPaths =
    process.platform === "win32"
      ? [
          "C:\\devkitPro",
          "D:\\devkitPro",
          "C:\\Utils\\DevKitPro",
          "D:\\Utils\\DevKitPro",
        ]
      : ["/opt/devkitpro", "/usr/local/devkitpro"];

  for (const basePath of commonPaths) {
    const armPath = join(basePath, "devkitARM");
    const gccPath = join(
      armPath,
      "bin",
      process.platform === "win32"
        ? "arm-none-eabi-gcc.exe"
        : "arm-none-eabi-gcc",
    );

    if (isUsableGcc(gccPath)) {
      return {
        devkitPro: basePath,
        devkitArm: armPath,
        gccPath,
        isValid: true,
      };
    }
  }
  // Return invalid state
  return {
    devkitPro: "",
    devkitArm: "",
    gccPath: "",
    isValid: false,
  };
}

export function validateDevKitPro(): void {
  const paths = getDevKitProPaths();

  if (!paths.isValid) {
    throw new Error(
      "devkitPro not found! Please install devkitPro from https://devkitpro.org/wiki/Getting_Started\n" +
        "Make sure the DEVKITPRO and DEVKITARM environment variables are set correctly.",
    );
  }
}
