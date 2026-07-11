import { remove, writeFile, ensureDir, pathExists } from "fs-extra";
import Path from "path";
import AdmZip from "adm-zip";
import spawn from "../../src/lib/helpers/cli/spawn";

const buildToolsRoot = Path.join(
  Path.normalize(`${__dirname}/../../`),
  "buildTools",
);

const dependencies = {
  "darwin-arm64": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-osx.tar.xz",
      type: "tarxz",
    },
  },
  "darwin-x64": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-osx.tar.xz",
      type: "tarxz",
    },
  },
  "linux-x64": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-linux.tar.xz",
      type: "tarxz",
    },
  },
  "linux-arm64": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-linux.tar.xz",
      type: "tarxz",
    },
  },
  "win32-ia32": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-win64.tar.xz",
      type: "tarxz",
    },
  },
  "win32-x64": {
    gbadev: {
      url: "https://github.com/devkitPro/devkitarm-portlibs/releases/download/v1.7.0/devkitARM-r59-win64.tar.xz",
      type: "tarxz",
    },
  },
} as const;

type Arch = keyof typeof dependencies;

const archs = Object.keys(dependencies) as Array<Arch>;
const localArch = `${process.platform}-${process.arch}`;

const fetchAll = process.argv.includes("--all");
const fetchArch =
  process.argv
    .find((arg) => arg.startsWith("--arch="))
    ?.replace("--arch=", "") ?? localArch;

const extractTarXz = async (
  archivePath: string,
  outputDir: string,
): Promise<void> => {
  console.log(`Extract tar.xz to "${outputDir}"`);
  const relArchivePath = Path.relative(process.cwd(), archivePath).replace(/\\/g, "/");
  const relOutputDir = Path.relative(process.cwd(), outputDir).replace(/\\/g, "/");
  const res = spawn(
    "tar",
    ["-Jxf", relArchivePath, "-C", relOutputDir],
    {},
    {
      onLog: (msg) => console.log(msg),
      onError: (msg) => console.error(msg),
    },
  );
  await res.completed;
  console.log("✅ Done");
};

const extractTarGz = async (
  archivePath: string,
  outputDir: string,
): Promise<void> => {
  console.log(`Extract tar to "${outputDir}"`);
  const relArchivePath = Path.relative(process.cwd(), archivePath).replace(/\\/g, "/");
  const relOutputDir = Path.relative(process.cwd(), outputDir).replace(/\\/g, "/");
  const res = spawn(
    "tar",
    ["-zxf", relArchivePath, "-C", relOutputDir],
    {},
    {
      onLog: (msg) => console.log(msg),
      onError: (msg) => console.error(msg),
    },
  );
  await res.completed;
  console.log("✅ Done");
};

const extractZip = async (
  archivePath: string,
  outputDir: string,
): Promise<void> => {
  console.log(`Extract zip to "${outputDir}"`);
  const zip = new AdmZip(archivePath);
  await zip.extractAllTo(outputDir, true);
  console.log("✅ Done");
};

export const fetchGBADevDependency = async (arch: Arch) => {
  console.log(`Fetching GBA Dev tools for arch=${arch}`);
  const { url, type } = dependencies[arch].gbadev;
  console.log(`URL=${url}`);

  const filename = Path.basename(url);
  const localFilePath = Path.join(
    Path.normalize(`${__dirname}../../../buildTools/files`),
    filename,
  );
  console.log('localFilePath', localFilePath);

  const tmpPath = Path.join(buildToolsRoot, "tmp.data");
  let archivePath = tmpPath;
  let isLocal = false;

  if (await pathExists(localFilePath)) {
    console.log(`Found local file at "${localFilePath}". Skipping download.`);
    archivePath = localFilePath;
    isLocal = true;
  } else {
    const response = await fetch(url);
    const buffer = await response.arrayBuffer(); // Get a Buffer from the response
    const data = Buffer.from(buffer);
    await writeFile(tmpPath, data);
    console.log(`Written to "${tmpPath}"`);
  }

  const gbadevArchPath = Path.join(buildToolsRoot, arch);
  await ensureDir(gbadevArchPath);

  if (type === "tarxz") {
    await extractTarXz(archivePath, gbadevArchPath);
  } else if (type === "targz") {
    await extractTarGz(archivePath, gbadevArchPath);
  } else {
    await extractZip(archivePath, gbadevArchPath);
  }

  if (!isLocal) {
    await remove(tmpPath);
  }
};

const main = async () => {
  await ensureDir(buildToolsRoot);
  for (const arch of archs) {
    if (fetchAll || arch === fetchArch) {
      await fetchGBADevDependency(arch);
    }
  }
};

main().catch((e) => {
  console.error(`❌ Error: `, e);
});
