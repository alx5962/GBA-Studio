import {
  compileGBAScript,
  emitGBAScriptC,
  type GBAScriptEvent,
} from "lib/compiler/compileGBAEvents";

const VM_OP_END = 0x00;
const VM_OP_LOAD_SCENE = 0x01;
const VM_OP_WAIT = 0x03;
const VM_OP_SET_CONST = 0x04;
const VM_OP_SHOW_TEXT = 0x0f;

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

  it("EVENT_SET_VALUE skips non-constant script values", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      {
        command: "EVENT_SET_VALUE",
        args: { variable: "1", value: { type: "variable", value: "2" } },
      },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining("EVENT_SET_VALUE only supports constant"),
    );
  });

  it("EVENT_WAIT emits VM_OP_WAIT with frame count", () => {
    const events: GBAScriptEvent[] = [
      { command: "EVENT_WAIT", args: { frames: 30 } },
    ];
    const out = compileGBAScript(events, noopCtx);
    expect(out[0]).toBe(VM_OP_WAIT);
    expect(out[1]).toBe(30);
  });

  it("unsupported events are skipped with a warning", () => {
    const ctx = makeCtx();
    const events: GBAScriptEvent[] = [
      { command: "EVENT_ACTOR_MOVE_TO", args: { actorId: "1", x: 5, y: 5 } },
    ];
    const out = compileGBAScript(events, ctx);
    expect(out).toEqual([VM_OP_END]);
    expect(ctx.warnings).toHaveBeenCalledWith(
      expect.stringContaining("EVENT_ACTOR_MOVE_TO"),
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
