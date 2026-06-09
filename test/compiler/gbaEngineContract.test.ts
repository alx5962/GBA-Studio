import { readFileSync } from "fs";
import { join } from "path";
import {
  compileGBAScript,
  type GBAScriptEvent,
} from "lib/compiler/compileGBAEvents";

const vmHeader = readFileSync(
  join(process.cwd(), "appData", "engine", "gbavm", "include", "vm.h"),
  "utf8",
);

const vmOpcode = (name: string): number => {
  const match = vmHeader.match(
    new RegExp(`#define\\s+${name}\\s+0x([0-9A-Fa-f]+)`),
  );
  if (!match) {
    throw new Error(`Missing ${name} in bundled GBA engine vm.h`);
  }
  return parseInt(match[1], 16);
};

test("GBA event compiler opcodes match bundled engine VM constants", () => {
  const events: GBAScriptEvent[] = [
    { command: "EVENT_SWITCH_SCENE", args: { sceneId: "scene2" } },
    { command: "EVENT_WAIT", args: { frames: 9 } },
    { command: "EVENT_SET_VALUE", args: { variable: "VAR_4", value: 7 } },
    { command: "EVENT_TEXT", args: { text: "OK" } },
  ];

  const bytecode = compileGBAScript(events, {
    sceneIndexById: { scene2: 3 },
    warnings: jest.fn(),
  });

  expect(bytecode[0]).toBe(vmOpcode("VM_OP_LOAD_SCENE"));
  expect(bytecode[2]).toBe(vmOpcode("VM_OP_WAIT"));
  expect(bytecode[4]).toBe(vmOpcode("VM_OP_SET_CONST"));
  expect(bytecode[7]).toBe(vmOpcode("VM_OP_SHOW_TEXT"));
  expect(bytecode[11]).toBe(vmOpcode("VM_OP_END"));
});
