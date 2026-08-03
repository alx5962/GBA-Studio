import {
  compileGBAScript,
  emitGBAScriptC,
  type GBAScriptEvent,
} from "lib/compiler/compileGBAEvents";

const VM_OP_END = 0x00;
const VM_OP_LOAD_SCENE = 0x01;
const VM_OP_SET_SCENE_TONE = 0x02;
const VM_OP_WAIT = 0x03;
const VM_OP_SET_CONST = 0x04;
const VM_OP_COPY_VAR = 0x05;
const VM_OP_ADD_CONST = 0x06;
const VM_OP_SUB_CONST = 0x07;
const VM_OP_ADD_VAR = 0x08;
const VM_OP_SUB_VAR = 0x09;
const VM_OP_RANDOM = 0x0a;
const VM_OP_JUMP = 0x0b;
const VM_OP_IF_VAR_EQ_CONST = 0x0c;
const VM_OP_IF_VAR_GT_CONST = 0x0d;
const VM_OP_IF_VAR_LT_CONST = 0x0e;
const VM_OP_SHOW_TEXT = 0x0f;
const VM_OP_IF_INPUT = 0x10;
const VM_OP_ACTOR_SET_POS = 0x11;
const VM_OP_ACTOR_MOVE_REL = 0x12;
const VM_OP_ACTOR_SET_DIR = 0x13;
const VM_OP_ACTOR_SET_HIDDEN = 0x14;
const VM_OP_CAMERA_SHAKE = 0x18;
const VM_OP_AWAIT_INPUT = 0x1b;
const VM_OP_OVERLAY_SHOW = 0x2f;
const VM_OP_OVERLAY_HIDE = 0x30;
const VM_OP_OVERLAY_MOVE_TO = 0x31;
const VM_OP_OVERLAY_SET_SCANLINE_CUTOFF = 0x32;
const VM_OP_ACTOR_EMOTE = 0x33;
const VM_OP_SET_TIMER_SCRIPT = 0x34;
const VM_OP_TIMER_DISABLE = 0x35;
const VM_OP_TIMER_RESTART = 0x36;
const VM_OP_REPLACE_TILE_XY = 0x37;
const VM_OP_SCENE_PUSH_STATE = 0x38;
const VM_OP_SCENE_POP_STATE = 0x39;
const VM_OP_SCENE_POP_ALL_STATE = 0x3a;
const VM_OP_SAVE_DATA = 0x3b;
const VM_OP_LOAD_DATA = 0x3c;
const VM_OP_CLEAR_DATA = 0x3d;
const VM_OP_IF_SAVED_DATA = 0x3e;
const VM_OP_SAVE_PEEK = 0x3f;
const VM_OP_PROJECTILE_LAUNCH = 0x40;
const VM_OP_PROJECTILE_LOAD_SLOT = 0x41;

const noopCtx = {
  sceneIndexById: {} as Record<string, number>,
  warnings: jest.fn(),
};

function makeCtx(sceneIndexById: Record<string, number> = {}) {
  return { sceneIndexById, warnings: jest.fn() };
}

describe("compileGBAScript", () => {
  it("empty script produces only VM_OP_END", () => {
    const out = compileGBAScript([], noopCtx);
    expect(out).toEqual([VM_OP_END]);
  });

  it("EVENT_END produces VM_OP_END (and the implicit terminal END)", () => {
    const events: GBAScriptEvent[] = [{ command: "EVENT_END" }];
    const out = compileGBAScript(events, noopCtx);
    // EVENT_END emits one END, then the implicit terminal appends another —
    // the engine stops at the first one so the duplicate is harmless.
    expect(out[0]).toBe(VM_OP_END);
  });

  it("disabled event (args.__comment = true) is skipped and produces no bytecode", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TEXT", args: { text: "Hello", __comment: true } },
    ];
    const out = compileGBAScript(events, noopCtx);
    // Only the implicit terminal END should be emitted.
    expect(out).toEqual([VM_OP_END]);
  });

  it("EVENT_COMMENT block is silently skipped", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_COMMENT", args: { text: "just a note" } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_END]);
  });

  it("disabled events are skipped without emitting a warning", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TEXT", args: { text: "Hello", __comment: true } },
    ];
    compileGBAScript(events, ctx);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_TEXT emits VM_OP_SHOW_TEXT followed by the NUL-terminated string", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TEXT", args: { text: "Hi" } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_SHOW_TEXT);
    expect(out[1]).toBe("H".charCodeAt(0));
    expect(out[2]).toBe("i".charCodeAt(0));
    expect(out[3]).toBe(0x00); // NUL terminator
    expect(out[out.length - 1]).toBe(VM_OP_END);
  });

  it("EVENT_TEXT formats variable references like $Alex1 into GBA variable placeholders", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TEXT", args: { text: "valeur: $Alex1" } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_SHOW_TEXT);
    const str = String.fromCharCode(...out.slice(1, out.indexOf(0x00, 1)));
    expect(str).toBe("valeur: {1}");
  });

  it("EVENT_TEXT with array of strings joins with newline", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TEXT", args: { text: ["Hello", "World"] } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_SHOW_TEXT);
    // "Hello\nWorld\0"
    const str = String.fromCharCode(...out.slice(1, out.indexOf(0x00, 1)));
    expect(str).toBe("Hello\nWorld");
  });

  it("EVENT_TEXT_DRAW emits VM_OP_SHOW_TEXT followed by NUL-terminated string", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_TEXT_DRAW",
        args: { text: "Draw Me", x: 2, y: 3, location: "background" },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out[0]).toBe(VM_OP_SHOW_TEXT);
    const str = String.fromCharCode(...out.slice(1, out.indexOf(0x00, 1)));
    expect(str).toBe("Draw Me");
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_SWITCH_SCENE emits VM_OP_LOAD_SCENE with the resolved scene index", () => {
    const ctx = makeCtx({ "scene-abc": 2 });
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SWITCH_SCENE", args: { sceneId: "scene-abc" } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out[0]).toBe(VM_OP_LOAD_SCENE);
    expect(out[1]).toBe(2);
    expect(out[2]).toBe(VM_OP_END);
  });

  it("EVENT_SWITCH_SCENE emits position and direction opcodes when provided", () => {
    const ctx = makeCtx({ "scene-abc": 2 });
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SWITCH_SCENE",
        args: {
          sceneId: "scene-abc",
          x: { type: "number", value: 24 },
          y: { type: "number", value: 8 },
          direction: "left",
        },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([
      VM_OP_ACTOR_SET_POS,
      0,
      192,
      64,
      VM_OP_ACTOR_SET_DIR,
      0,
      3,
      VM_OP_LOAD_SCENE,
      2,
      VM_OP_END,
    ]);
  });

  it("EVENT_SWITCH_SCENE to unknown scene emits a warning and is skipped", () => {
    const ctx = makeCtx({});
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SWITCH_SCENE", args: { sceneId: "ghost-scene" } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalled();
  });

  it("EVENT_SET_VALUE emits VM_OP_SET_CONST with var index and value", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SET_VALUE", args: { variable: "5", value: 42 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_SET_CONST);
    expect(out[1]).toBe(5);
    expect(out[2]).toBe(42);
    expect(out[3]).toBe(VM_OP_END);
  });

  it("EVENT_SET_VALUE supports VAR-prefixed variable ids", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SET_VALUE", args: { variable: "VAR_5", value: 42 } },
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "VAR_VARIABLE_6", value: 43 },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_SET_CONST);
    expect(out[1]).toBe(5);
    expect(out[2]).toBe(42);
    expect(out[3]).toBe(VM_OP_SET_CONST);
    expect(out[4]).toBe(6);
    expect(out[5]).toBe(43);
  });

  it("EVENT_SET_VALUE supports constant script values", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "1", value: { type: "number", value: 7 } },
      },
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "2", value: { type: "true" } },
      },
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "3", value: { type: "false" } },
      },
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "4", value: "12" },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_SET_CONST,
      1,
      7,
      VM_OP_SET_CONST,
      2,
      1,
      VM_OP_SET_CONST,
      3,
      0,
      VM_OP_SET_CONST,
      4,
      12,
      VM_OP_END,
    ]);
  });

  it("EVENT_SET_VALUE clamps constants to byte range", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SET_VALUE", args: { variable: "1", value: -1 } },
      { command: "EVENT_SET_VALUE", args: { variable: "2", value: 256 } },
      { command: "EVENT_SET_VALUE", args: { variable: "3", value: 1.6 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_SET_CONST,
      1,
      0,
      VM_OP_SET_CONST,
      2,
      255,
      VM_OP_SET_CONST,
      3,
      2,
      VM_OP_END,
    ]);
  });

  it("EVENT_SET_VALUE skips unsupported expression script values", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "1", value: { type: "expression", value: "$1 + 2" } },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining("EVENT_SET_VALUE only supports constant"),
    );
  });

  it("EVENT_SET_VALUE copies variable script values", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_VALUE",
        args: {
          variable: "VAR_1",
          value: { type: "variable", value: "VAR_2" },
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_COPY_VAR, 1, 2, VM_OP_END]);
  });

  it("EVENT_INC_VALUE and EVENT_DEC_VALUE map to add/sub one", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_INC_VALUE", args: { variable: "VAR_3" } },
      { command: "EVENT_DEC_VALUE", args: { variable: "VAR_4" } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_ADD_CONST,
      3,
      1,
      VM_OP_SUB_CONST,
      4,
      1,
      VM_OP_END,
    ]);
  });

  it("EVENT_VARIABLE_MATH supports set/copy/random/add/sub", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_VARIABLE_MATH",
        args: { vectorX: "VAR_1", operation: "set", other: "val", value: 9 },
      },
      {
        command: "EVENT_VARIABLE_MATH",
        args: {
          vectorX: "VAR_2",
          operation: "set",
          other: "var",
          vectorY: "VAR_1",
        },
      },
      {
        command: "EVENT_VARIABLE_MATH",
        args: {
          vectorX: "VAR_3",
          operation: "set",
          other: "rnd",
          minValue: 4,
          maxValue: 8,
        },
      },
      {
        command: "EVENT_VARIABLE_MATH",
        args: { vectorX: "VAR_4", operation: "add", other: "val", value: 5 },
      },
      {
        command: "EVENT_VARIABLE_MATH",
        args: {
          vectorX: "VAR_5",
          operation: "sub",
          other: "var",
          vectorY: "VAR_4",
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_SET_CONST,
      1,
      9,
      VM_OP_COPY_VAR,
      2,
      1,
      VM_OP_RANDOM,
      3,
      4,
      8,
      VM_OP_ADD_CONST,
      4,
      5,
      VM_OP_SUB_VAR,
      5,
      4,
      VM_OP_END,
    ]);
  });

  it("EVENT_VARIABLE_MATH supports variable add", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_VARIABLE_MATH",
        args: {
          vectorX: "VAR_6",
          operation: "add",
          other: "var",
          vectorY: "VAR_7",
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_ADD_VAR, 6, 7, VM_OP_END]);
  });

  it("EVENT_VARIABLE_MATH warns for unsupported VM operations", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_VARIABLE_MATH",
        args: { vectorX: "VAR_1", operation: "mul", other: "val", value: 2 },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining('EVENT_VARIABLE_MATH operation "mul"'),
    );
  });

  it("EVENT_WAIT emits VM_OP_WAIT with frame count", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_WAIT", args: { units: "frames", frames: 30 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_WAIT);
    expect(out[1]).toBe(30);
  });

  it("EVENT_WAIT converts seconds to frames at 60fps", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_WAIT", args: { units: "time", time: { type: "number", value: 1 } } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_WAIT);
    expect(out[1]).toBe(60); // 1 second * 60fps
  });

  it("EVENT_WAIT chunks long waits into multiple VM_OP_WAIT opcodes", () => {
    // 40 seconds = 2400 frames, needs 9×255 + 1×105 = 10 chunks
    const events: GBAScriptEvent[] = [
      { command: "EVENT_WAIT", args: { units: "time", time: { type: "number", value: 40 } } },
    ];
    const out = compileGBAScript(events, noopCtx);
    // 2400 frames: 9 chunks of 255 (2295) + 1 chunk of 105
    const expectedChunks = Math.floor(2400 / 255); // 9
    const remainder = 2400 % 255; // 105
    for (let i = 0; i < expectedChunks; i++) {
      expect(out[i * 2]).toBe(VM_OP_WAIT);
      expect(out[i * 2 + 1]).toBe(255);
    }
    expect(out[expectedChunks * 2]).toBe(VM_OP_WAIT);
    expect(out[expectedChunks * 2 + 1]).toBe(remainder);
  });

  it("EVENT_PALETTE_SET_BACKGROUND maps to scene tone", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_PALETTE_SET_BACKGROUND", args: { tone: 3 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_SET_SCENE_TONE, 3, VM_OP_END]);
  });

  it("EVENT_FADE_IN emits VM_OP_SET_SCENE_TONE sequence", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [{ command: "EVENT_FADE_IN", args: { speed: 0 } }];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_SET_SCENE_TONE, 0, VM_OP_END]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_FADE_OUT emits VM_OP_SET_SCENE_TONE sequence", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [{ command: "EVENT_FADE_OUT", args: { speed: 0 } }];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_SET_SCENE_TONE, 3, VM_OP_END]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_SET_INPUT_SCRIPT emits VM_OP_IF_INPUT button check and child script", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_INPUT_SCRIPT",
        args: { input: ["a", "b"] },
        children: {
          true: [{ command: "EVENT_TEXT", args: { text: "EN" } }],
        },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out[0]).toBe(VM_OP_IF_INPUT);
    expect(out[1]).toBe(0x03); // A (0x01) | B (0x02) = 0x03
    expect(out[2]).toBe(0x00);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_ACTOR_SET_FRAME compiles constant animation frame", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_FRAME",
        args: { actorId: "$self$", frame: 2 },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([0x24, 0, 2, 0x00]); // VM_OP_ACTOR_SET_ANIM_FRAME actor 0, frame 2
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_ACTOR_SET_FRAME_TO_VALUE compiles variable animation frame", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_FRAME_TO_VALUE",
        args: { actorId: "$self$", frame: { type: "variable", value: "pass1" } },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out[0]).toBe(0x42); // VM_OP_ACTOR_SET_ANIM_FRAME_VAR
    expect(out[1]).toBe(0); // actor 0
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_IF_TRUE compiles true and false branches", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_TRUE",
        args: {
          variable: "VAR_1",
          true: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 10 },
            },
          ],
          false: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 20 },
            },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_IF_VAR_GT_CONST,
      1,
      0,
      3,
      0,
      VM_OP_JUMP,
      6,
      0,
      VM_OP_SET_CONST,
      2,
      10,
      VM_OP_JUMP,
      3,
      0,
      VM_OP_SET_CONST,
      2,
      20,
      VM_OP_END,
    ]);
  });

  it("EVENT_IF_FALSE inverts branch payloads", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_FALSE",
        args: {
          variable: "VAR_1",
          true: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 10 },
            },
          ],
          false: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 20 },
            },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out.slice(8, 11)).toEqual([VM_OP_SET_CONST, 2, 20]);
    expect(out.slice(14, 17)).toEqual([VM_OP_SET_CONST, 2, 10]);
  });

  it("EVENT_IF supports script-value variable comparisons", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF",
        args: {
          condition: {
            type: "eq",
            valueA: { type: "variable", value: "VAR_1" },
            valueB: { type: "number", value: 5 },
          },
          true: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 1 },
            },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_IF_VAR_EQ_CONST);
    expect(out[1]).toBe(1);
    expect(out[2]).toBe(5);
    expect(out).toContain(VM_OP_SET_CONST);
  });

  it("EVENT_IF_VALUE supports inverse comparisons", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_VALUE",
        args: {
          variable: "VAR_1",
          operator: "!=",
          comparator: 5,
          true: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 1 },
            },
          ],
          false: [
            {
              command: "EVENT_SET_VALUE",
              args: { variable: "VAR_2", value: 0 },
            },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_IF_VAR_EQ_CONST);
    expect(out.slice(8, 11)).toEqual([VM_OP_SET_CONST, 2, 0]);
    expect(out.slice(14, 17)).toEqual([VM_OP_SET_CONST, 2, 1]);
  });

  it("EVENT_IF_VALUE supports greater-than and less-than comparisons", () => {
    const gt = compileGBAScript(
      [
        {
          command: "EVENT_IF_VALUE",
          args: { variable: "VAR_1", operator: ">", comparator: 5 },
        },
      ],
      noopCtx,
    );
    const lt = compileGBAScript(
      [
        {
          command: "EVENT_IF_VALUE",
          args: { variable: "VAR_1", operator: "<", comparator: 5 },
        },
      ],
      noopCtx,
    );
    expect(gt[0]).toBe(VM_OP_IF_VAR_GT_CONST);
    expect(lt[0]).toBe(VM_OP_IF_VAR_LT_CONST);
  });

  it("EVENT_GROUP inlines its children in order", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_GROUP",
        args: {
          true: [
            { command: "EVENT_SET_VALUE", args: { variable: "1", value: 7 } },
            { command: "EVENT_INC_VALUE", args: { variable: "2" } },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_SET_CONST,
      1,
      7,
      VM_OP_ADD_CONST,
      2,
      1,
      VM_OP_END,
    ]);
  });

  it("EVENT_GROUP reads children from the children map", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_GROUP",
        children: {
          true: [
            { command: "EVENT_WAIT", args: { units: "frames", frames: 5 } },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_WAIT, 5, VM_OP_END]);
  });

  it("EVENT_IF_COLOR_SUPPORTED always inlines the true branch (GBA has colour)", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_COLOR_SUPPORTED",
        args: {
          true: [
            { command: "EVENT_SET_VALUE", args: { variable: "1", value: 1 } },
          ],
          false: [
            { command: "EVENT_SET_VALUE", args: { variable: "1", value: 0 } },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_SET_CONST, 1, 1, VM_OP_END]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_IF_INPUT branches on a key mask (A = 0x0001)", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_INPUT",
        args: {
          input: ["a"],
          true: [
            { command: "EVENT_SET_VALUE", args: { variable: "1", value: 1 } },
          ],
          false: [
            { command: "EVENT_SET_VALUE", args: { variable: "1", value: 0 } },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_IF_INPUT);
    expect(out[1]).toBe(0x01); // mask lo (A)
    expect(out[2]).toBe(0x00); // mask hi
    expect(out).toContain(VM_OP_SET_CONST);
  });

  it("EVENT_IF_INPUT combines multiple keys into one mask", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_IF_INPUT", args: { input: ["b", "up"] } },
    ];
    const out = compileGBAScript(events, noopCtx);
    // B=0x02 | UP=0x40 = 0x42
    expect(out[0]).toBe(VM_OP_IF_INPUT);
    expect(out[1]).toBe(0x42);
    expect(out[2]).toBe(0x00);
  });

  it("EVENT_AWAIT_INPUT emits the correct opcode and key mask", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_AWAIT_INPUT", args: { input: ["a", "b"] } },
    ];
    const out = compileGBAScript(events, noopCtx);
    // A=0x0001 | B=0x0002 = 0x0003
    expect(out[0]).toBe(VM_OP_AWAIT_INPUT);
    expect(out[1]).toBe(0x03); // mask lo
    expect(out[2]).toBe(0x00); // mask hi
    expect(out[3]).toBe(VM_OP_END);
  });

  it("EVENT_AWAIT_INPUT with an empty mask emits no opcode (no-op)", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_AWAIT_INPUT", args: { input: [] } },
    ];
    const out = compileGBAScript(events, noopCtx);
    // No VM_OP_AWAIT_INPUT — just END.
    expect(out).toEqual([VM_OP_END]);
  });

  it("EVENT_ACTOR_SET_POSITION resolves player to index 0 with tile to pixel conversion", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_POSITION",
        args: { actorId: "player", x: 5, y: 7 },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_ACTOR_SET_POS, 0, 40, 56, VM_OP_END]);
  });

  it("EVENT_ACTOR_SET_POSITION respects pixel units when provided", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_POSITION",
        args: { actorId: "player", x: 5, y: 7, units: "pixels" },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_ACTOR_SET_POS, 0, 5, 7, VM_OP_END]);
  });

  it("EVENT_ACTOR_SET_POSITION resolves a scene actor via actorIndexById", () => {
    const ctx = {
      sceneIndexById: {},
      actorIndexById: { "npc-1": 2 },
      warnings: jest.fn(),
    };
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_POSITION",
        args: { actorId: "npc-1", x: 3, y: 4, units: "pixels" },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_ACTOR_SET_POS, 2, 3, 4, VM_OP_END]);
  });

  it("EVENT_ACTOR_MOVE_RELATIVE encodes negative deltas as signed bytes with tile scaling", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_MOVE_RELATIVE",
        args: { actorId: "player", x: -1, y: 2, units: "pixels" },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_ACTOR_MOVE_REL, 0, 0xff, 2, VM_OP_END]);
  });

  it("EVENT_ACTOR_SET_DIRECTION maps direction names (up=2)", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_DIRECTION",
        args: { actorId: "player", direction: "up" },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_ACTOR_SET_DIR, 0, 2, VM_OP_END]);
  });

  it("EVENT_ACTOR_ACTIVATE / DEACTIVATE / SHOW / HIDE toggle hidden", () => {
    const out = compileGBAScript(
      [
        { command: "EVENT_ACTOR_DEACTIVATE", args: { actorId: "player" } },
        { command: "EVENT_ACTOR_ACTIVATE", args: { actorId: "player" } },
        { command: "EVENT_ACTOR_HIDE", args: { actorId: "player" } },
        { command: "EVENT_ACTOR_SHOW", args: { actorId: "player" } },
      ],
      noopCtx,
    );
    expect(out).toEqual([
      VM_OP_ACTOR_SET_HIDDEN,
      0,
      1,
      VM_OP_ACTOR_SET_HIDDEN,
      0,
      0,
      VM_OP_ACTOR_SET_HIDDEN,
      0,
      1,
      VM_OP_ACTOR_SET_HIDDEN,
      0,
      0,
      VM_OP_END,
    ]);
  });

  it("$self$ resolves to the enclosing actor index", () => {
    const ctx = {
      sceneIndexById: {},
      selfActorIndex: 3,
      warnings: jest.fn(),
    };
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_SET_DIRECTION",
        args: { actorId: "$self$", direction: "down" },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_ACTOR_SET_DIR, 3, 0, VM_OP_END]);
  });

  it("EVENT_CALL_CUSTOM_EVENT inlines the referenced script", () => {
    const ctx = {
      sceneIndexById: {},
      customEventsById: {
        "ce-1": {
          script: [
            { command: "EVENT_SET_VALUE", args: { variable: "9", value: 1 } },
          ],
        },
      },
      warnings: jest.fn(),
    };
    const events: GBAScriptEvent[] = [
      { command: "EVENT_CALL_CUSTOM_EVENT", args: { customEventId: "ce-1" } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_SET_CONST, 9, 1, VM_OP_END]);
  });

  it("EVENT_CALL_CUSTOM_EVENT guards against recursion", () => {
    const ctx: {
      sceneIndexById: Record<string, number>;
      customEventsById: Record<string, { script?: GBAScriptEvent[] }>;
      warnings: jest.Mock;
    } = {
      sceneIndexById: {},
      customEventsById: {},
      warnings: jest.fn(),
    };
    ctx.customEventsById["ce-loop"] = {
      script: [
        { command: "EVENT_CALL_CUSTOM_EVENT", args: { customEventId: "ce-loop" } },
      ],
    };
    const out = compileGBAScript(
      [{ command: "EVENT_CALL_CUSTOM_EVENT", args: { customEventId: "ce-loop" } }],
      ctx,
    );
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining("recursive"),
    );
  });

  it("unsupported events are skipped with a warning", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      { command: "EVENT_UNSUPPORTED_DUMMY", args: { actorId: "1", x: 5, y: 5 } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining("EVENT_UNSUPPORTED_DUMMY"),
    );
  });

  it("sequences multiple events in order", () => {
    const ctx = makeCtx({ s1: 0 });
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SET_VALUE", args: { variable: "0", value: 10 } },
      { command: "EVENT_SWITCH_SCENE", args: { sceneId: "s1" } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out[0]).toBe(VM_OP_SET_CONST);
    expect(out[3]).toBe(VM_OP_LOAD_SCENE);
    expect(out[5]).toBe(VM_OP_END);
  });

  it("EVENT_SWITCH compiles to a chain of IF_VAR_EQ_CONST checks", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SWITCH",
        args: {
          variable: "0",
          choices: 2,
        },
        children: {
          true0: [{ command: "EVENT_WAIT", args: { frames: 5, units: "frames" } }],
          true1: [{ command: "EVENT_WAIT", args: { frames: 10, units: "frames" } }],
        },
      },
    ];
    const out = compileGBAScript(events, ctx);
    // Verifying default values (1 and 2) are used when value0/value1 are omitted:
    // First arm checks variable 0 == value 1:
    expect(out[0]).toBe(VM_OP_IF_VAR_EQ_CONST);
    expect(out[1]).toBe(0); // variable 0
    expect(out[2]).toBe(1); // default value 1
    // Second arm checks variable 0 == value 2:
    expect(out[13]).toBe(VM_OP_IF_VAR_EQ_CONST);
    expect(out[14]).toBe(0); // variable 0
    expect(out[15]).toBe(2); // default value 2
  });

  it("EVENT_CAMERA_SHAKE emits VM_OP_CAMERA_SHAKE opcode for shake duration and flags", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_CAMERA_SHAKE", args: { time: 0.5 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([VM_OP_CAMERA_SHAKE, 30, 3, VM_OP_END]);
  });

  it("EVENT_OVERLAY_SHOW, EVENT_OVERLAY_HIDE, EVENT_OVERLAY_MOVE_TO, and EVENT_OVERLAY_SET_SCANLINE_CUTOFF emit opcodes without warnings", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      { command: "EVENT_OVERLAY_SHOW", args: { color: "black", x: 0, y: 0 } },
      { command: "EVENT_OVERLAY_MOVE_TO", args: { x: 0, y: 18, speed: "2" } },
      { command: "EVENT_OVERLAY_SET_SCANLINE_CUTOFF", args: { y: 150, units: "pixels" } },
      { command: "EVENT_OVERLAY_HIDE" },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([
      VM_OP_OVERLAY_SHOW,
      0,
      0,
      0,
      VM_OP_OVERLAY_MOVE_TO,
      0,
      144,
      2,
      VM_OP_OVERLAY_SET_SCANLINE_CUTOFF,
      150,
      VM_OP_OVERLAY_HIDE,
      VM_OP_END,
    ]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_PLAYER_SET_SPRITE emits VM_OP_ACTOR_SET_SPRITE for actor 0 (player)", () => {
    const ctx = {
      sceneIndexById: {},
      spriteIndexById: { "sprite-sheet-2": 4 },
      warnings: jest.fn(),
    };
    const events: GBAScriptEvent[] = [
      { command: "EVENT_PLAYER_SET_SPRITE", args: { spriteSheetId: "sprite-sheet-2" } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([0x2d /* VM_OP_ACTOR_SET_SPRITE */, 0, 4, VM_OP_END]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_ACTOR_EMOTE emits VM_OP_ACTOR_EMOTE with actor index and emote index", () => {
    const ctx = {
      sceneIndexById: {},
      actorIndexById: { actor1: 2 },
      emoteIndexById: { emote1: 5 },
      selfActorIndex: 2,
      warnings: jest.fn(),
    };
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_ACTOR_EMOTE",
        args: { actorId: "actor1", emoteId: "emote1" },
      },
      {
        command: "EVENT_ACTOR_EMOTE",
        args: { actorId: "$self$", emoteId: "emote1" },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([
      VM_OP_ACTOR_EMOTE,
      2,
      5,
      VM_OP_ACTOR_EMOTE,
      2,
      5,
      VM_OP_END,
    ]);
    expect(ctx.warnings).not.toHaveBeenCalled();
  });

  it("EVENT_SET_TIMER_SCRIPT compiles timer slot, interval frames, and nested script payload", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_TIMER_SCRIPT",
        args: {
          timer: 2,
          units: "frames",
          frames: 60,
          script: [
            { command: "EVENT_INC_VALUE", args: { variable: "VAR_1" } },
          ],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    // VM_OP_SET_TIMER_SCRIPT timer_idx(1) frames_lo(60) frames_hi(0) offset_lo(4) offset_hi(0) payload...
    expect(out).toEqual([
      VM_OP_SET_TIMER_SCRIPT,
      1,
      60,
      0,
      4,
      0,
      VM_OP_ADD_CONST,
      1,
      1,
      VM_OP_END,
      VM_OP_END,
    ]);
  });

  it("EVENT_TIMER_DISABLE and EVENT_TIMER_RESTART emit opcodes for timer index", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_TIMER_DISABLE", args: { timer: 3 } },
      { command: "EVENT_TIMER_RESTART", args: { timer: 3 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_TIMER_DISABLE,
      2,
      VM_OP_TIMER_RESTART,
      2,
      VM_OP_END,
    ]);
  });

  it("EVENT_REPLACE_TILE_XY emits VM_OP_REPLACE_TILE_XY with operands and flags", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_REPLACE_TILE_XY",
        args: {
          x: 4,
          y: 7,
          tileIndex: 12,
          tileSize: "16px",
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    // VM_OP_REPLACE_TILE_XY x(4) y(7) tile_lo(12) tile_hi(0) flags(0x08)
    expect(out).toEqual([VM_OP_REPLACE_TILE_XY, 4, 7, 12, 0, 8, VM_OP_END]);
  });

  it("EVENT_REPLACE_TILE_XY_SEQUENCE compiles bounds checking and variable sequence tile replacement", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_REPLACE_TILE_XY_SEQUENCE",
        args: {
          x: 2,
          y: 3,
          tileIndex: 10,
          frames: 4,
          variable: "VAR_2",
          tileSize: "8px",
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(0x0e); // VM_OP_IF_VAR_LT_CONST
    expect(out).toContain(VM_OP_REPLACE_TILE_XY);
    expect(out).toContain(0x06); // VM_OP_ADD_CONST
    expect(out[out.length - 1]).toBe(VM_OP_END);
  });

  it("EVENT_SCENE_PUSH_STATE, EVENT_SCENE_POP_STATE, and EVENT_SCENE_POP_ALL_STATE emit scene stack opcodes", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_SCENE_PUSH_STATE" },
      { command: "EVENT_SCENE_POP_STATE", args: { fadeSpeed: 3 } },
      { command: "EVENT_SCENE_POP_ALL_STATE", args: { fadeSpeed: 1 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toEqual([
      VM_OP_SCENE_PUSH_STATE,
      VM_OP_SCENE_POP_STATE,
      3,
      VM_OP_SCENE_POP_ALL_STATE,
      1,
      VM_OP_END,
    ]);
  });

  it("EVENT_SAVE_DATA, EVENT_LOAD_DATA, EVENT_CLEAR_DATA, EVENT_PEEK_DATA emit save opcodes", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SAVE_DATA",
        args: { saveSlot: 1 },
        children: {
          true: [
            { command: "EVENT_SET_VALUE", args: { variable: "0", value: 5 } },
          ],
        },
      },
      { command: "EVENT_LOAD_DATA", args: { saveSlot: 1 } },
      { command: "EVENT_CLEAR_DATA", args: { saveSlot: 1 } },
      {
        command: "EVENT_PEEK_DATA",
        args: { saveSlot: 1, variableSource: "0", variableDest: "1" },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out).toContain(VM_OP_SAVE_DATA);
    expect(out).toContain(VM_OP_LOAD_DATA);
    expect(out).toContain(VM_OP_CLEAR_DATA);
    expect(out).toContain(VM_OP_SAVE_PEEK);
  });

  it("EVENT_IF_SAVED_DATA emits VM_OP_IF_SAVED_DATA conditional branches", () => {
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_IF_SAVED_DATA",
        args: { saveSlot: 0 },
        children: {
          true: [{ command: "EVENT_SET_VALUE", args: { variable: "0", value: 1 } }],
          false: [{ command: "EVENT_SET_VALUE", args: { variable: "0", value: 0 } }],
        },
      },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_IF_SAVED_DATA);
    expect(out[1]).toBe(0); // slot 0
  });

  it("EVENT_LAUNCH_PROJECTILE, EVENT_LAUNCH_PROJECTILE_SLOT, and EVENT_LOAD_PROJECTILE_SLOT compile without warnings and emit VM opcodes", () => {
    const warnings = jest.fn();
    const events: GBAScriptEvent[] = [
      { command: "EVENT_LAUNCH_PROJECTILE", args: { spriteSheetId: "s1", direction: "right" } },
      { command: "EVENT_LAUNCH_PROJECTILE_SLOT", args: { slot: 1 } },
      { command: "EVENT_LOAD_PROJECTILE_SLOT", args: { slot: 1, projectileIndex: 2 } },
    ];
    const out = compileGBAScript(events, { ...noopCtx, warnings });
    expect(warnings).not.toHaveBeenCalled();
    expect(out).toContain(VM_OP_PROJECTILE_LAUNCH);
    expect(out).toContain(VM_OP_PROJECTILE_LOAD_SLOT);
  });
});

describe("emitGBAScriptC", () => {
  it("produces a valid static C byte array", () => {
    const bytecode = [VM_OP_SHOW_TEXT, 0x48, 0x69, 0x00, VM_OP_END];
    const c = emitGBAScriptC("my_script", bytecode);
    expect(c).toContain("static const uint8_t my_script[5]");
    expect(c).toContain("0x0F");
    expect(c).toContain("0x00");
  });

  it("throws before emitting invalid numeric bytes", () => {
    expect(() => emitGBAScriptC("bad_script", [Number.NaN])).toThrow(
      "Invalid GBA bytecode byte",
    );
  });
});
