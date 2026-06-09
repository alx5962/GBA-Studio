// GBA event compiler — translates GB Studio script event trees into GBA VM
// bytecode. Only the subset of events the GBA VM currently implements is
// handled; everything else is skipped with a warning so partially-scripted
// scenes still produce a valid (if incomplete) ROM.
//
// Opcode constants mirror vm.h exactly. Any change there must be reflected
// here and vice-versa.

const VM_OP_END           = 0x00;
const VM_OP_LOAD_SCENE    = 0x01;
const VM_OP_SET_SCENE_TONE = 0x02;
const VM_OP_WAIT          = 0x03;
const VM_OP_SET_CONST     = 0x04;
const VM_OP_ADD_CONST     = 0x06;
const VM_OP_SUB_CONST     = 0x07;
const VM_OP_SHOW_TEXT     = 0x0f;

// Minimal structural type for the script events we receive — matches the
// shape of GBAScriptEvent from entitiesTypes without importing it (which would
// pull in a large transitive dependency graph into this pure-logic module).
export type GBAScriptEvent = {
  command: string;
  args?: Record<string, unknown>;
  children?: Record<string, GBAScriptEvent[]>;
};

export type GBACompileContext = {
  // Map from scene id → scene index (0-based) used for LOAD_SCENE operand.
  sceneIndexById: Record<string, number>;
  warnings: (msg: string) => void;
};

// Encode a NUL-terminated string as UTF-8 bytes (ASCII subset only on GBA).
// Replaces any non-ASCII byte with '?' to stay safe.
function encodeString(s: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // Allow printable ASCII and newline (\n = 0x0A used for textbox line breaks).
    if ((code >= 0x20 && code <= 0x7e) || code === 0x0a) {
      bytes.push(code);
    } else {
      bytes.push(0x3f /* '?' */);
    }
  }
  bytes.push(0x00); // NUL terminator
  return bytes;
}

function clampU8(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

// Compile one event and append bytes to `out`. Returns false if the event
// was unsupported (and the caller emits a warning).
function compileEvent(
  event: GBAScriptEvent,
  out: number[],
  ctx: GBACompileContext,
): boolean {
  const { command, args = {} } = event;

  switch (command) {
    case "EVENT_END":
      out.push(VM_OP_END);
      return true;

    case "EVENT_TEXT": {
      // args.text may be a string or array of strings (multi-page). We join
      // with newline — the textbox renderer shows the first two wrapped lines.
      const raw = Array.isArray(args.text)
        ? (args.text as string[]).join("\n")
        : String(args.text ?? "");
      out.push(VM_OP_SHOW_TEXT, ...encodeString(raw));
      return true;
    }

    case "EVENT_SWITCH_SCENE": {
      const sceneId = String(args.sceneId ?? "");
      const sceneIndex = ctx.sceneIndexById[sceneId];
      if (sceneIndex === undefined) {
        ctx.warnings(
          `GBA compiler: EVENT_SWITCH_SCENE references unknown scene "${sceneId}" — skipped`,
        );
        return false;
      }
      out.push(VM_OP_LOAD_SCENE, clampU8(sceneIndex));
      return true;
    }

    case "EVENT_SET_VALUE": {
      // args.variable is a variable id string like "0" or "VAR_0".
      // For the GBA VM, variables are 0-indexed integers 0..255.
      const varIndex = clampU8(parseInt(String(args.variable ?? "0"), 10));
      const value = clampU8(Number(args.value ?? 0));
      out.push(VM_OP_SET_CONST, varIndex, value);
      return true;
    }

    case "EVENT_WAIT": {
      const frames = clampU8(Number(args.frames ?? 1));
      out.push(VM_OP_WAIT, frames);
      return true;
    }

    default:
      return false;
  }
}

// Compile a full script event array into a flat GBA VM bytecode array.
// Always terminates with VM_OP_END, even if the script is empty.
export function compileGBAScript(
  events: GBAScriptEvent[],
  ctx: GBACompileContext,
): number[] {
  const out: number[] = [];
  for (const event of events) {
    const ok = compileEvent(event, out, ctx);
    if (!ok) {
      ctx.warnings(
        `GBA compiler: unsupported event "${event.command}" — skipped`,
      );
    }
  }
  out.push(VM_OP_END);
  return out;
}

// Emit a C byte-array literal for the given bytecode.
// symbol: C identifier for the array (e.g. "scene_1_trigger_0_script")
export function emitGBAScriptC(symbol: string, bytecode: number[]): string {
  const bytes = bytecode
    .map((b, i) => `${i % 16 === 0 ? "\n  " : " "}0x${b.toString(16).padStart(2, "0").toUpperCase()}`)
    .join(",");
  return `static const uint8_t ${symbol}[${bytecode.length}] = {${bytes}\n};`;
}
