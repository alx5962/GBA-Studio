import fs from "fs-extra";
import os from "os";
import Path from "path";
import { buildLinkFile, getBuildCommands } from "lib/compiler/buildMakeScript";

jest.mock("lib/helpers/devkitpro", () => ({
  getDevKitProPaths: () => ({
    isValid: true,
    gccPath: "arm-none-eabi-gcc",
    devkitArm: "C:/devkitPro/devkitARM",
    devkitPro: "C:/devkitPro",
  }),
}));

describe("GBA build file selection", () => {
  let buildRoot = "";

  beforeEach(async () => {
    buildRoot = await fs.mkdtemp(Path.join(os.tmpdir(), "gba-build-script-"));
    await fs.ensureDir(Path.join(buildRoot, "src", "data"));
    await fs.writeFile(
      Path.join(buildRoot, "src", "main.c"),
      "int main(void){return 0;}\n",
    );
    await fs.writeFile(
      Path.join(buildRoot, "src", "startup.s"),
      ".global _start\n",
    );
    await fs.writeFile(
      Path.join(buildRoot, "src", "data", "actor_10_interact.s"),
      ".module actor_10_interact\n",
    );
  });

  afterEach(async () => {
    if (buildRoot) {
      await fs.remove(buildRoot);
    }
  });

  it("skips GBVM script assembly files for GBA compile commands", async () => {
    const commands = await getBuildCommands(buildRoot, {
      colorEnabled: false,
      sgb: false,
      musicDriver: "gbt",
      debug: false,
      platform: process.platform,
      batteryless: false,
      targetPlatform: "gba",
      cartType: "mbc5",
      compilerPreset: 3000,
    });

    const labels = commands.map((command) => command.label);
    expect(labels.some((label) => label.includes("actor_10_interact.s"))).toBe(
      false,
    );
    expect(labels.some((label) => label.includes("startup.s"))).toBe(false);
    expect(labels.some((label) => label.includes("main.c"))).toBe(true);
  });

  it("skips GBVM script assembly files from the GBA link file", async () => {
    const linkFile = await buildLinkFile(buildRoot, "gba");

    expect(linkFile).toContain("obj/main.o");
    expect(linkFile).not.toContain("actor_10_interact.o");
    expect(linkFile).not.toContain("startup.o");
  });
});
