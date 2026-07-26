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
    {
      command: "EVENT_SET_VALUE",
      args: { variable: "VAR_5", value: { type: "variable", value: "VAR_4" } },
    },
    { command: "EVENT_INC_VALUE", args: { variable: "VAR_4" } },
    { command: "EVENT_DEC_VALUE", args: { variable: "VAR_4" } },
    {
      command: "EVENT_VARIABLE_MATH",
      args: {
        vectorX: "VAR_1",
        operation: "add",
        other: "var",
        vectorY: "VAR_2",
      },
    },
    {
      command: "EVENT_VARIABLE_MATH",
      args: {
        vectorX: "VAR_1",
        operation: "sub",
        other: "var",
        vectorY: "VAR_2",
      },
    },
    {
      command: "EVENT_VARIABLE_MATH",
      args: {
        vectorX: "VAR_1",
        operation: "set",
        other: "rnd",
        minValue: 1,
        maxValue: 3,
      },
    },
    { command: "EVENT_PALETTE_SET_BACKGROUND", args: { tone: 2 } },
    {
      command: "EVENT_IF_VALUE",
      args: {
        variable: "VAR_1",
        operator: "==",
        comparator: 1,
        true: [
          { command: "EVENT_SET_VALUE", args: { variable: "VAR_2", value: 1 } },
        ],
        false: [
          { command: "EVENT_SET_VALUE", args: { variable: "VAR_2", value: 0 } },
        ],
      },
    },
    { command: "EVENT_OVERLAY_SHOW", args: { color: "black", x: 0, y: 0 } },
    { command: "EVENT_OVERLAY_MOVE_TO", args: { x: 0, y: 18, speed: 2 } },
    { command: "EVENT_OVERLAY_SET_SCANLINE_CUTOFF", args: { y: 150 } },
    { command: "EVENT_OVERLAY_HIDE" },
    { command: "EVENT_ACTOR_EMOTE", args: { actorId: "player", emoteId: "emote1" } },
    {
      command: "EVENT_SET_TIMER_SCRIPT",
      args: {
        timer: 1,
        units: "frames",
        frames: 30,
        script: [{ command: "EVENT_INC_VALUE", args: { variable: "VAR_1" } }],
      },
    },
    { command: "EVENT_TIMER_DISABLE", args: { timer: 1 } },
    { command: "EVENT_TIMER_RESTART", args: { timer: 1 } },
    { command: "EVENT_REPLACE_TILE_XY", args: { x: 0, y: 0, tileIndex: 1 } },
    { command: "EVENT_SCENE_PUSH_STATE" },
    { command: "EVENT_SCENE_POP_STATE", args: { fadeSpeed: 2 } },
    { command: "EVENT_SCENE_POP_ALL_STATE", args: { fadeSpeed: 2 } },
    { command: "EVENT_SAVE_DATA", args: { saveSlot: 0 } },
    { command: "EVENT_IF_SAVED_DATA", args: { saveSlot: 0 } },
    { command: "EVENT_LOAD_DATA", args: { saveSlot: 0 } },
    { command: "EVENT_CLEAR_DATA", args: { saveSlot: 0 } },
    { command: "EVENT_PEEK_DATA", args: { saveSlot: 0, variableSource: "VAR_1", variableDest: "VAR_2" } },
    { command: "EVENT_LAUNCH_PROJECTILE", args: { spriteSheetId: "s1" } },
    { command: "EVENT_LOAD_PROJECTILE_SLOT", args: { slot: 0, projectileIndex: 1 } },
    { command: "EVENT_TEXT", args: { text: "OK" } },
  ];

  const bytecode = compileGBAScript(events, {
    sceneIndexById: { scene2: 3 },
    warnings: jest.fn(),
  });

  const emittedOpcodes = new Set(bytecode);
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_LOAD_SCENE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_WAIT"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SET_CONST"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_COPY_VAR"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_ADD_CONST"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SUB_CONST"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_ADD_VAR"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SUB_VAR"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_RANDOM"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_JUMP"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_IF_VAR_EQ_CONST"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SET_SCENE_TONE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_OVERLAY_SHOW"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_OVERLAY_MOVE_TO"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_OVERLAY_SET_SCANLINE_CUTOFF"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_OVERLAY_HIDE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_ACTOR_EMOTE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SET_TIMER_SCRIPT"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_TIMER_DISABLE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_TIMER_RESTART"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_REPLACE_TILE_XY"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SCENE_PUSH_STATE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SCENE_POP_STATE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SCENE_POP_ALL_STATE"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SAVE_DATA"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_IF_SAVED_DATA"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_LOAD_DATA"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_CLEAR_DATA"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SAVE_PEEK"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_PROJECTILE_LAUNCH"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_PROJECTILE_LOAD_SLOT"));
  expect(emittedOpcodes).toContain(vmOpcode("VM_OP_SHOW_TEXT"));
  expect(bytecode[bytecode.length - 1]).toBe(vmOpcode("VM_OP_END"));
});
