// GBA event compiler — translates GB Studio script event trees into GBA VM
// bytecode. Only the subset of events the GBA VM currently implements is
// handled; everything else is skipped with a warning so partially-scripted
// scenes still produce a valid (if incomplete) ROM.
//
// Opcode constants mirror vm.h exactly. Any change there must be reflected
// here and vice-versa.

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
const VM_OP_MUSIC_PLAY = 0x15;
const VM_OP_MUSIC_STOP = 0x16;
const VM_OP_MENU = 0x17;
const VM_OP_CAMERA_SHAKE = 0x18;
const VM_OP_SEED_RNG = 0x19;
const VM_OP_SOUND_PLAY_EFFECT = 0x1a;
const VM_OP_AWAIT_INPUT = 0x1b;
const VM_OP_ACTOR_SET_COLLISIONS = 0x1c;
const VM_OP_IF_ACTOR_AT_POS = 0x1d;
const VM_OP_ACTOR_SET_MOVE_SPEED = 0x1e;
const VM_OP_ACTOR_MOVE_TO = 0x1f;
const VM_OP_IF_ACTOR_RELATIVE_TO_ACTOR = 0x20;
const VM_OP_ACTOR_SET_STATE = 0x21;
const VM_OP_ACTOR_PUSH = 0x22;
const VM_OP_ACTOR_SET_ENABLED = 0x23;
const VM_OP_ACTOR_SET_ANIM_FRAME = 0x24;
const VM_OP_ACTOR_SET_ANIM_SPEED = 0x25;
const VM_OP_IF_VAR_EQ_VAR = 0x26;
const VM_OP_IF_VAR_GT_VAR = 0x27;
const VM_OP_IF_VAR_LT_VAR = 0x28;
const VM_OP_ACTOR_MOVE_CANCEL = 0x29;
const VM_OP_CAMERA_MOVE_TO = 0x2a;
const VM_OP_CAMERA_LOCK = 0x2b;
const VM_OP_IF_ACTOR_DIRECTION = 0x2c;
const VM_OP_ACTOR_SET_SPRITE = 0x2d;
const VM_OP_PLAYER_BOUNCE = 0x2e;
// Direction operands for VM_OP_IF_ACTOR_RELATIVE_TO_ACTOR (mirror vm.h)
const ACTOR_RELATIVE_ABOVE = 0;
const ACTOR_RELATIVE_BELOW = 1;
const ACTOR_RELATIVE_LEFT = 2;
const ACTOR_RELATIVE_RIGHT = 3;

// GBA key bit masks (mirror gba_system.h).
const GBA_KEYS: Record<string, number> = {
  a: 0x0001,
  b: 0x0002,
  select: 0x0004,
  start: 0x0008,
  right: 0x0010,
  left: 0x0020,
  up: 0x0040,
  down: 0x0080,
  r: 0x0100,
  l: 0x0200,
};

// GB Studio direction_e order: 0=down, 1=left, 2=right, 3=up.
const GBA_DIRECTIONS: Record<string, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

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
  // Map from music track id → music track index.
  musicIndexById?: Record<string, number>;
  // Map from actor id → runtime actor index for the scene being compiled.
  // Runtime index 0 is the player; scene actors follow. Set per-scene.
  actorIndexById?: Record<string, number>;
  // Map from sprite sheet id → sprite index.
  spriteIndexById?: Record<string, number>;
  // Runtime index substituted for the "$self$" actor id (the actor whose
  // own script is being compiled). Undefined outside an actor script.
  selfActorIndex?: number;
  // Custom-event scripts by id, for inlining EVENT_CALL_CUSTOM_EVENT.
  customEventsById?: Record<string, { script?: GBAScriptEvent[] }>;
  // Recursion guard for nested custom-event calls.
  customEventCallStack?: string[];
  warnings: (msg: string) => void;
};

// Resolve a GB Studio actorId to a runtime actor index.
// "player" → 0; "$self$" → the enclosing actor; otherwise the per-scene map.
function resolveActorIndex(actorId: unknown, ctx: GBACompileContext): number {
  const id = String(actorId ?? "player");
  if (id === "player" || id === "$player$") {
    return 0;
  }
  if (id === "$self$") {
    return ctx.selfActorIndex ?? 0;
  }
  return ctx.actorIndexById?.[id] ?? 0;
}

function resolveSpriteIndex(spriteId: unknown, ctx: GBACompileContext): number {
  const id = String(spriteId ?? "");
  return ctx.spriteIndexById?.[id] ?? 0;
}

// Signed byte (-128..127) encoded as u8 for delta operands.
function clampS8ToU8(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  const v = Math.max(-128, Math.min(127, Math.round(n)));
  return v < 0 ? 256 + v : v;
}

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
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(n)));
}

function clampU16(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(65535, Math.round(n)));
}

function parseVariableIndex(variable: unknown): number {
  const variableId = String(variable ?? "0");
  const numericPart = variableId.replace(/[^0-9]/g, "");
  return clampU8(parseInt(numericPart || "0", 10));
}

function scriptValueVariableIndex(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?[0-9]+$/.test(trimmed)) {
      return parseVariableIndex(trimmed);
    }
    return undefined;
  }
  if (typeof value === "object" && "type" in value) {
    const scriptValue = value as { type?: unknown; value?: unknown };
    if (scriptValue.type === "variable") {
      return parseVariableIndex(scriptValue.value);
    }
  }
  return undefined;
}

function constValueToU8(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return clampU8(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?[0-9]+$/.test(trimmed)) {
      return clampU8(Number(trimmed));
    }
    return undefined;
  }

  if (typeof value !== "object" || !("type" in value)) {
    return undefined;
  }

  const scriptValue = value as { type?: unknown; value?: unknown };

  if (scriptValue.type === "number") {
    return clampU8(Number(scriptValue.value ?? 0));
  }
  if (scriptValue.type === "true") {
    return 1;
  }
  if (scriptValue.type === "false") {
    return 0;
  }

  return undefined;
}

// Best-effort numeric value from a ScriptValue/number/string (signed).
function scriptValueToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (value && typeof value === "object" && "type" in value) {
    const sv = value as { type?: unknown; value?: unknown };
    if (sv.type === "number") {
      return Number(sv.value ?? 0);
    }
  }
  return 0;
}

// Build a 16-bit GBA key mask from an EVENT_IF_INPUT `input` arg, which may be
// a single key name or an array of them.
function inputMask(input: unknown): number {
  const names = Array.isArray(input) ? input : [input];
  let mask = 0;
  for (const name of names) {
    const key = String(name ?? "").toLowerCase();
    mask |= GBA_KEYS[key] ?? 0;
  }
  return mask & 0xffff;
}

// Extract a direction name from a string or {type:"direction"} union.
function directionValue(value: unknown): number {
  let name = "";
  if (typeof value === "string") {
    name = value;
  } else if (value && typeof value === "object" && "value" in value) {
    name = String((value as { value?: unknown }).value ?? "");
  }
  return GBA_DIRECTIONS[name.toLowerCase()] ?? 0;
}

function pushS16(out: number[], value: number): void {
  const signed = value < 0 ? 0x10000 + value : value;
  out.push(signed & 0xff, (signed >> 8) & 0xff);
}

function patchS16(out: number[], offsetIndex: number, value: number): void {
  const signed = value < 0 ? 0x10000 + value : value;
  out[offsetIndex] = signed & 0xff;
  out[offsetIndex + 1] = (signed >> 8) & 0xff;
}

function pushJump(out: number[], offset: number): void {
  out.push(VM_OP_JUMP);
  pushS16(out, offset);
}

type BranchCondition = {
  opcode: number;
  variable: number;
  value: number;
  invert?: boolean;
};

function compareOpcode(operator: unknown): number | undefined {
  switch (operator) {
    case "==":
    case ".EQ":
    case "eq":
      return VM_OP_IF_VAR_EQ_CONST;
    case ">":
    case ".GT":
    case "gt":
      return VM_OP_IF_VAR_GT_CONST;
    case "<":
    case ".LT":
    case "lt":
      return VM_OP_IF_VAR_LT_CONST;
    default:
      return undefined;
  }
}

function inverseCompareOpcode(operator: unknown): number | undefined {
  switch (operator) {
    case "!=":
    case ".NE":
    case "ne":
      return VM_OP_IF_VAR_EQ_CONST;
    case "<=":
    case ".LTE":
    case "lte":
      return VM_OP_IF_VAR_GT_CONST;
    case ">=":
    case ".GTE":
    case "gte":
      return VM_OP_IF_VAR_LT_CONST;
    default:
      return undefined;
  }
}

function compileNestedEvents(
  events: GBAScriptEvent[] | undefined,
  ctx: GBACompileContext,
): number[] {
  return compileEvents(events ?? [], ctx, false);
}

function compileConditional(
  out: number[],
  condition: BranchCondition,
  trueEvents: GBAScriptEvent[] | undefined,
  falseEvents: GBAScriptEvent[] | undefined,
  ctx: GBACompileContext,
): void {
  const trueBytes = compileNestedEvents(trueEvents, ctx);
  const falseBytes = compileNestedEvents(falseEvents, ctx);
  const branchTrueBytes = condition.invert ? falseBytes : trueBytes;
  const branchFalseBytes = condition.invert ? trueBytes : falseBytes;

  out.push(condition.opcode, condition.variable, condition.value);
  pushS16(out, 3);

  const jumpToFalseOffsetIndex = out.length + 1;
  pushJump(out, 0);
  out.push(...branchTrueBytes);

  const jumpToEndOffsetIndex = out.length + 1;
  pushJump(out, 0);
  out.push(...branchFalseBytes);

  patchS16(out, jumpToFalseOffsetIndex, branchTrueBytes.length + 3);
  patchS16(out, jumpToEndOffsetIndex, branchFalseBytes.length);
}

function conditionFromScriptValue(
  condition: unknown,
  ctx: GBACompileContext,
): BranchCondition | undefined {
  if (condition === undefined || condition === null) {
    return undefined;
  }

  if (typeof condition === "boolean") {
    return {
      opcode: VM_OP_IF_VAR_EQ_CONST,
      variable: 0,
      value: 0,
      invert: !condition,
    };
  }

  if (typeof condition === "string") {
    const str = condition.trim();
    const match = str.match(/^([$a-zA-Z0-9_]+)\s*(==|!=|>=|<=|>|<)\s*([$a-zA-Z0-9_]+)$/);
    if (match) {
      const typeMap: Record<string, string> = {
        "==": "eq",
        "!=": "ne",
        ">": "gt",
        "<": "lt",
        ">=": "gte",
        "<=": "lte",
      };
      return conditionFromScriptValue({
        type: typeMap[match[2]] ?? "eq",
        valueA: match[1],
        valueB: match[3],
      }, ctx);
    }
    return {
      opcode: VM_OP_IF_VAR_GT_CONST,
      variable: parseVariableIndex(str),
      value: 0,
    };
  }

  if (typeof condition === "number") {
    return {
      opcode: VM_OP_IF_VAR_EQ_CONST,
      variable: 0,
      value: 0,
      invert: condition === 0,
    };
  }

  if (typeof condition !== "object") {
    return undefined;
  }

  const scriptValue = condition as {
    type?: unknown;
    value?: unknown;
    valueA?: unknown;
    valueB?: unknown;
  };

  if (scriptValue.type === "true") {
    return {
      opcode: VM_OP_IF_VAR_EQ_CONST,
      variable: 0,
      value: 0,
      invert: false,
    };
  }

  if (scriptValue.type === "false") {
    return {
      opcode: VM_OP_IF_VAR_EQ_CONST,
      variable: 0,
      value: 0,
      invert: true,
    };
  }

  if (scriptValue.type === "variable") {
    return {
      opcode: VM_OP_IF_VAR_GT_CONST,
      variable: parseVariableIndex(scriptValue.value),
      value: 0,
    };
  }

  if (scriptValue.type === "not") {
    const inner = conditionFromScriptValue(scriptValue.value, ctx);
    if (!inner) {
      return undefined;
    }
    return { ...inner, invert: !inner.invert };
  }

  const directOpcode = compareOpcode(scriptValue.type);
  const inverseOpcode = inverseCompareOpcode(scriptValue.type);
  const opcode = directOpcode ?? inverseOpcode;

  if (opcode) {
    const varA = scriptValueVariableIndex(scriptValue.valueA);
    const constB = constValueToU8(scriptValue.valueB);

    if (varA !== undefined && constB !== undefined) {
      return {
        opcode,
        variable: varA,
        value: constB,
        invert: inverseOpcode !== undefined,
      };
    }

    const constA = constValueToU8(scriptValue.valueA);
    const varB = scriptValueVariableIndex(scriptValue.valueB);

    if (constA !== undefined && varB !== undefined) {
      let swappedType = String(scriptValue.type);
      if (swappedType === ">" || swappedType === ".GT" || swappedType === "gt") swappedType = "<";
      else if (swappedType === "<" || swappedType === ".LT" || swappedType === "lt") swappedType = ">";
      else if (swappedType === ">=" || swappedType === ".GTE" || swappedType === "gte") swappedType = "<=";
      else if (swappedType === "<=" || swappedType === ".LTE" || swappedType === "lte") swappedType = ">=";

      const swappedDirect = compareOpcode(swappedType);
      const swappedInverse = inverseCompareOpcode(swappedType);
      const swappedOpcode = swappedDirect ?? swappedInverse;

      if (swappedOpcode) {
        return {
          opcode: swappedOpcode,
          variable: varB,
          value: constA,
          invert: swappedInverse !== undefined,
        };
      }
    }

    if (varA !== undefined && varB !== undefined) {
      let varOpcode = VM_OP_IF_VAR_EQ_VAR;
      if (opcode === VM_OP_IF_VAR_GT_CONST) varOpcode = VM_OP_IF_VAR_GT_VAR;
      if (opcode === VM_OP_IF_VAR_LT_CONST) varOpcode = VM_OP_IF_VAR_LT_VAR;

      return {
        opcode: varOpcode,
        variable: varA,
        value: varB,
        invert: inverseOpcode !== undefined,
      };
    }

    if (constA !== undefined && constB !== undefined) {
      let staticTrue = false;
      const typeStr = String(scriptValue.type);
      if (typeStr === "==" || typeStr === ".EQ" || typeStr === "eq") staticTrue = constA === constB;
      else if (typeStr === "!=" || typeStr === ".NE" || typeStr === "ne") staticTrue = constA !== constB;
      else if (typeStr === ">" || typeStr === ".GT" || typeStr === "gt") staticTrue = constA > constB;
      else if (typeStr === "<" || typeStr === ".LT" || typeStr === "lt") staticTrue = constA < constB;
      else if (typeStr === ">=" || typeStr === ".GTE" || typeStr === "gte") staticTrue = constA >= constB;
      else if (typeStr === "<=" || typeStr === ".LTE" || typeStr === "lte") staticTrue = constA <= constB;

      return {
        opcode: VM_OP_IF_VAR_EQ_CONST,
        variable: 0,
        value: 0,
        invert: !staticTrue,
      };
    }
  }

  ctx.warnings(`GBA compiler: unsupported EVENT_IF condition — skipped`);
  return undefined;
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

    case "EVENT_TEXT":
    case "EVENT_TEXT_DRAW": {
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
      if (args.x !== undefined || args.y !== undefined) {
        const scale = args.units === "pixels" ? 1 : 8;
        const x = clampU8(scriptValueToNumber(args.x) * scale);
        const y = clampU8(scriptValueToNumber(args.y) * scale);
        out.push(VM_OP_ACTOR_SET_POS, 0, x, y);
      }
      const dirStr =
        typeof args.direction === "string"
          ? args.direction
          : args.direction &&
            typeof args.direction === "object" &&
            "value" in args.direction
            ? String((args.direction as { value?: unknown }).value ?? "")
            : "";
      if (dirStr && dirStr.toLowerCase() in GBA_DIRECTIONS) {
        out.push(VM_OP_ACTOR_SET_DIR, 0, GBA_DIRECTIONS[dirStr.toLowerCase()]);
      }
      return true;
    }

    case "EVENT_SET_VALUE": {
      // args.variable is a variable id string like "0" or "VAR_0".
      // For the GBA VM, variables are 0-indexed integers 0..255.
      const varIndex = parseVariableIndex(args.variable);
      const sourceVarIndex = scriptValueVariableIndex(args.value);
      if (sourceVarIndex !== undefined) {
        out.push(VM_OP_COPY_VAR, varIndex, sourceVarIndex);
        return true;
      }
      const value = constValueToU8(args.value);
      if (value === undefined) {
        ctx.warnings(
          `GBA compiler: EVENT_SET_VALUE only supports constant number/boolean values — skipped`,
        );
        return false;
      }
      out.push(VM_OP_SET_CONST, varIndex, value);
      return true;
    }

    case "EVENT_INC_VALUE": {
      out.push(VM_OP_ADD_CONST, parseVariableIndex(args.variable), 1);
      return true;
    }

    case "EVENT_DEC_VALUE": {
      out.push(VM_OP_SUB_CONST, parseVariableIndex(args.variable), 1);
      return true;
    }

    case "EVENT_VARIABLE_MATH": {
      const targetVar = parseVariableIndex(args.vectorX);
      const operation = String(args.operation ?? "set");
      const other = String(args.other ?? "val");
      const sourceVar = parseVariableIndex(args.vectorY);
      const constValue =
        other === "true"
          ? 1
          : other === "false"
            ? 0
            : clampU8(Number(args.value ?? 0));

      if (operation === "set" || operation === "") {
        if (other === "var") {
          out.push(VM_OP_COPY_VAR, targetVar, sourceVar);
        } else if (other === "rnd") {
          out.push(
            VM_OP_RANDOM,
            targetVar,
            clampU8(Number(args.minValue ?? 0)),
            clampU8(Number(args.maxValue ?? 0)),
          );
        } else {
          out.push(VM_OP_SET_CONST, targetVar, constValue);
        }
        return true;
      }

      if (operation === "add") {
        out.push(
          other === "var" ? VM_OP_ADD_VAR : VM_OP_ADD_CONST,
          targetVar,
          other === "var" ? sourceVar : constValue,
        );
        return true;
      }

      if (operation === "sub") {
        out.push(
          other === "var" ? VM_OP_SUB_VAR : VM_OP_SUB_CONST,
          targetVar,
          other === "var" ? sourceVar : constValue,
        );
        return true;
      }

      ctx.warnings(
        `GBA compiler: EVENT_VARIABLE_MATH operation "${operation}" is not supported by the GBA VM — skipped`,
      );
      return false;
    }

    case "EVENT_WAIT": {
      // When unit is "frames" use args.frames; otherwise args.time is in
      // seconds (stored as a ScriptValue) and must be converted to frames at
      // 60 fps.
      const isFrameUnit = args.units === "frames";
      const rawFrames = isFrameUnit
        ? scriptValueToNumber(args.frames ?? 1)
        : Math.ceil(scriptValueToNumber(args.time ?? 0.5) * 60);
      // VM_OP_WAIT accepts a single u8 (0-255). For longer durations emit
      // multiple wait opcodes so no VM changes are required.
      let remaining = Math.max(0, Math.round(rawFrames));
      if (remaining === 0) {
        return true;
      }
      while (remaining > 0) {
        const chunk = Math.min(remaining, 255);
        out.push(VM_OP_WAIT, chunk);
        remaining -= chunk;
      }
      return true;
    }

    case "EVENT_CAMERA_SHAKE": {
      const isFrameUnit = args.units === "frames";
      const rawFrames = isFrameUnit
        ? scriptValueToNumber(args.frames ?? 30)
        : Math.ceil(scriptValueToNumber(args.time ?? 0.5) * 60);
      const frames = clampU8(Math.max(1, Math.round(rawFrames || 30)));

      const shakeDirection = String(args.shakeDirection ?? "diagonal");
      const shouldShakeX =
        args.shouldShakeX !== false && shakeDirection !== "vertical";
      const shouldShakeY =
        args.shouldShakeY !== false && shakeDirection !== "horizontal";

      let flags = 0;
      if (shouldShakeX) flags |= 0x01;
      if (shouldShakeY) flags |= 0x02;

      out.push(VM_OP_CAMERA_SHAKE, frames, flags);
      return true;
    }

    case "EVENT_CAMERA_MOVE_TO":
    case "EVENT_CAMERA_SET_POSITION": {
      const scale = args.units === "pixels" ? 1 : 8;
      const pxX = scriptValueToNumber(args.x) * scale;
      const pxY = scriptValueToNumber(args.y) * scale;
      const targetCenterX = clampU16(pxX + 120);
      const targetCenterY = clampU16(pxY + 80);
      const speed =
        command === "EVENT_CAMERA_SET_POSITION"
          ? 0
          : clampU8(scriptValueToNumber(args.speed ?? 1));
      out.push(
        VM_OP_CAMERA_MOVE_TO,
        targetCenterX & 0xff,
        (targetCenterX >> 8) & 0xff,
        targetCenterY & 0xff,
        (targetCenterY >> 8) & 0xff,
        speed,
      );
      return true;
    }

    case "EVENT_CAMERA_LOCK":
    case "EVENT_CAMERA_SET_LOCK": {
      out.push(VM_OP_CAMERA_LOCK);
      return true;
    }


    case "EVENT_PALETTE_SET_BACKGROUND":
    case "EVENT_PALETTE_SET_SPRITE":
    case "EVENT_PALETTE_SET_UI":
    case "EVENT_PALETTE_SET_EMOTE": {
      const tone = clampU8(
        Number(args.tone ?? args.palette ?? args.palette0 ?? 0),
      );
      out.push(VM_OP_SET_SCENE_TONE, tone);
      return true;
    }

    case "EVENT_FADE_IN": {
      out.push(VM_OP_SET_SCENE_TONE, 0);
      return true;
    }

    case "EVENT_FADE_OUT": {
      out.push(VM_OP_SET_SCENE_TONE, 3);
      return true;
    }

    case "EVENT_MUSIC_PLAY": {
      const musicId = String(args.musicId ?? "");
      const musicIndex = ctx.musicIndexById?.[musicId];
      if (musicIndex === undefined) {
        // No valid music track set – skip the opcode entirely.
        return true;
      }
      const loop = args.loop !== false ? 1 : 0;
      out.push(VM_OP_MUSIC_PLAY, musicIndex, loop);
      return true;
    }

    case "EVENT_MUSIC_STOP": {
      out.push(VM_OP_MUSIC_STOP);
      return true;
    }

    case "EVENT_SET_INPUT_SCRIPT":
    case "EVENT_REMOVE_INPUT_SCRIPT":
    case "EVENT_INPUT_SCRIPT_SET":
    case "EVENT_INPUT_SCRIPT_REMOVE": {
      return true;
    }

    case "EVENT_IF":
    case "EVENT_IF_EXPRESSION": {
      const condInput = args.condition ?? args.expression;
      const condition = conditionFromScriptValue(condInput, ctx);
      if (!condition) {
        ctx.warnings(
          `GBA compiler: unsupported EVENT_IF_EXPRESSION ("${String(condInput)}") — compiling true branch as fallback`,
        );
        const trueEvents =
          (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
        if (trueEvents && trueEvents.length > 0) {
          out.push(...compileNestedEvents(trueEvents, ctx));
        }
        return true;
      }
      compileConditional(
        out,
        condition,
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true,
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false,
        ctx,
      );
      return true;
    }

    case "EVENT_IF_TRUE":
    case "EVENT_IF_FALSE": {
      compileConditional(
        out,
        {
          opcode: VM_OP_IF_VAR_GT_CONST,
          variable: parseVariableIndex(args.variable),
          value: 0,
          invert: command === "EVENT_IF_FALSE",
        },
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true,
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false,
        ctx,
      );
      return true;
    }

    case "EVENT_IF_INPUT": {
      const mask = inputMask(args.input);
      if (mask === 0) {
        return false;
      }
      const trueEvents =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      const falseEvents =
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false;
      const trueBytes = compileNestedEvents(trueEvents, ctx);
      const falseBytes = compileNestedEvents(falseEvents, ctx);

      // VM_OP_IF_INPUT mask_lo mask_hi offset(branch over the skip-jump)
      out.push(VM_OP_IF_INPUT, mask & 0xff, (mask >> 8) & 0xff);
      pushS16(out, 3); // if pressed, skip the jump-to-false below
      const jumpToFalseIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...trueBytes);
      const jumpToEndIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...falseBytes);
      patchS16(out, jumpToFalseIndex, trueBytes.length + 3);
      patchS16(out, jumpToEndIndex, falseBytes.length);
      return true;
    }

    case "EVENT_IF_ACTOR_DIRECTION": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      const dir = directionValue(args.direction);
      const trueEvents =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      const falseEvents =
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false;
      const trueBytes = compileNestedEvents(trueEvents, ctx);
      const falseBytes = compileNestedEvents(falseEvents, ctx);

      // VM_OP_IF_ACTOR_DIRECTION actor direction offset(branch over skip-jump)
      out.push(VM_OP_IF_ACTOR_DIRECTION, actor, dir);
      pushS16(out, 3);
      const jumpToFalseIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...trueBytes);
      const jumpToEndIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...falseBytes);
      patchS16(out, jumpToFalseIndex, trueBytes.length + 3);
      patchS16(out, jumpToEndIndex, falseBytes.length);
      return true;
    }

    case "EVENT_ACTOR_SET_POSITION": {
      const actor = resolveActorIndex(args.actorId, ctx);
      const scale = args.units === "pixels" ? 1 : 8;
      out.push(
        VM_OP_ACTOR_SET_POS,
        actor,
        clampU8(scriptValueToNumber(args.x) * scale),
        clampU8(scriptValueToNumber(args.y) * scale),
      );
      return true;
    }

    case "EVENT_ACTOR_MOVE_RELATIVE": {
      const actor = resolveActorIndex(args.actorId, ctx);
      const scale = args.units === "pixels" ? 1 : 8;
      out.push(
        VM_OP_ACTOR_MOVE_REL,
        actor,
        clampS8ToU8(scriptValueToNumber(args.x) * scale),
        clampS8ToU8(scriptValueToNumber(args.y) * scale),
      );
      return true;
    }

    case "EVENT_ACTOR_SET_DIRECTION": {
      const actor = resolveActorIndex(args.actorId, ctx);
      out.push(VM_OP_ACTOR_SET_DIR, actor, directionValue(args.direction));
      return true;
    }

    case "EVENT_ACTOR_SET_SPRITE": {
      const actor = resolveActorIndex(args.actorId, ctx);
      const spriteIndex = resolveSpriteIndex(args.spriteSheetId, ctx);
      out.push(VM_OP_ACTOR_SET_SPRITE, actor, spriteIndex);
      return true;
    }

    case "EVENT_PLAYER_BOUNCE": {
      const hStr = String(args.height ?? "medium").toLowerCase();
      let height = 1;
      if (hStr === "low" || hStr === "0") height = 0;
      else if (hStr === "medium" || hStr === "1") height = 1;
      else if (hStr === "high" || hStr === "2") height = 2;
      else height = clampU8(scriptValueToNumber(args.height));

      out.push(VM_OP_PLAYER_BOUNCE, height);
      return true;
    }

    case "EVENT_ACTOR_SHOW":
    case "EVENT_ACTOR_ACTIVATE": {
      out.push(VM_OP_ACTOR_SET_HIDDEN, resolveActorIndex(args.actorId, ctx), 0);
      return true;
    }

    case "EVENT_ACTOR_HIDE":
    case "EVENT_ACTOR_DEACTIVATE": {
      out.push(VM_OP_ACTOR_SET_HIDDEN, resolveActorIndex(args.actorId, ctx), 1);
      return true;
    }

    case "EVENT_ACTOR_COLLISIONS_DISABLE": {
      out.push(VM_OP_ACTOR_SET_COLLISIONS, resolveActorIndex(args.actorId, ctx), 0);
      return true;
    }

    case "EVENT_ACTOR_COLLISIONS_ENABLE": {
      out.push(VM_OP_ACTOR_SET_COLLISIONS, resolveActorIndex(args.actorId, ctx), 1);
      return true;
    }

    case "EVENT_ACTOR_SET_STATE": {
      const actor = resolveActorIndex(args.actorId, ctx);
      const loopAnim = args.loopAnim !== false ? 1 : 0;
      out.push(VM_OP_ACTOR_SET_STATE, actor, loopAnim);
      return true;
    }

    case "EVENT_ACTOR_PUSH": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      const continueUntilCollision = args.continue ? 1 : 0;
      out.push(VM_OP_ACTOR_PUSH, actor, continueUntilCollision);
      return true;
    }

    case "EVENT_ACTOR_STOP_UPDATE": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      out.push(VM_OP_ACTOR_SET_ENABLED, actor, 0);
      return true;
    }

    case "EVENT_ACTOR_START_UPDATE": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      out.push(VM_OP_ACTOR_SET_ENABLED, actor, 1);
      return true;
    }

    case "EVENT_ACTOR_SET_FRAME":
    case "EVENT_ACTOR_SET_FRAME_TO_VALUE": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      const frame = clampU8(scriptValueToNumber(args.frame ?? 0));
      out.push(VM_OP_ACTOR_SET_ANIM_FRAME, actor, frame);
      return true;
    }

    case "EVENT_ACTOR_SET_ANIMATION_SPEED": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      const speed = clampU8(scriptValueToNumber(args.speed ?? 15));
      out.push(VM_OP_ACTOR_SET_ANIM_SPEED, actor, speed);
      return true;
    }

    case "EVENT_ACTOR_MOVE_CANCEL": {
      const actor = resolveActorIndex(args.actorId ?? "$self$", ctx);
      out.push(VM_OP_ACTOR_MOVE_CANCEL, actor);
      return true;
    }

    case "EVENT_ACTOR_SET_MOVEMENT_SPEED": {
      const actor = resolveActorIndex(args.actorId, ctx);
      // `speed` is a positive integer (1 = 1 px/frame, 2 = 2 px/frame, …).
      // The GBA engine stores this directly as pixels/frame in actor->move_speed.
      const speed = clampU8(Math.max(1, Math.round(Number(args.speed ?? 1))));
      out.push(VM_OP_ACTOR_SET_MOVE_SPEED, actor, speed);
      return true;
    }

    case "EVENT_ACTOR_MOVE_TO": {
      const actor = resolveActorIndex(args.actorId, ctx);
      // units: "tiles" (default) ×8 for pixel coords; "pixels" = direct.
      // moveType / collideWith are GBA-side handled by the engine’s
      // horizontal-first step logic (matching the GB Studio default).
      const scale = args.units === "pixels" ? 1 : 8;
      const x = clampU8(scriptValueToNumber(args.x) * scale);
      const y = clampU8(scriptValueToNumber(args.y) * scale);
      out.push(VM_OP_ACTOR_MOVE_TO, actor, x, y);
      return true;
    }

    case "EVENT_IF_ACTOR_RELATIVE_TO_ACTOR": {
      const actorA = resolveActorIndex(args.actorId, ctx);
      const actorB = resolveActorIndex(args.otherActorId, ctx);
      const opMap: Record<string, number> = {
        up: ACTOR_RELATIVE_ABOVE,
        down: ACTOR_RELATIVE_BELOW,
        left: ACTOR_RELATIVE_LEFT,
        right: ACTOR_RELATIVE_RIGHT,
      };
      const op = opMap[String(args.operation ?? "up")] ?? ACTOR_RELATIVE_ABOVE;

      const trueEvents =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      const falseEvents =
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false;
      const trueBytes = compileNestedEvents(trueEvents, ctx);
      const falseBytes = compileNestedEvents(falseEvents, ctx);

      // VM_OP_IF_ACTOR_RELATIVE_TO_ACTOR  actor_a  actor_b  op  offset_lo  offset_hi
      out.push(VM_OP_IF_ACTOR_RELATIVE_TO_ACTOR, actorA, actorB, op);
      pushS16(out, 3); // if true, skip the JUMP below

      const jumpToFalseOffsetIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...trueBytes);

      const jumpToEndOffsetIndex = out.length + 1;
      pushJump(out, 0);
      out.push(...falseBytes);

      patchS16(out, jumpToFalseOffsetIndex, trueBytes.length + 3);
      patchS16(out, jumpToEndOffsetIndex, falseBytes.length);
      return true;
    }

    case "EVENT_IF_ACTOR_AT_POSITION": {
      const actor = resolveActorIndex(args.actorId, ctx);
      const scale = args.units === "pixels" ? 1 : 8;
      const x = clampU8(scriptValueToNumber(args.x) * scale);
      const y = clampU8(scriptValueToNumber(args.y) * scale);

      const trueEvents =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      const falseEvents =
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false;
      const trueBytes = compileNestedEvents(trueEvents, ctx);
      const falseBytes = compileNestedEvents(falseEvents, ctx);

      // VM_OP_IF_ACTOR_AT_POS  actor  x  y  offset_lo  offset_hi
      // offset skips the jump-over when the condition is true.
      out.push(VM_OP_IF_ACTOR_AT_POS, actor, x, y);
      pushS16(out, 3); // if match, skip the JUMP below

      const jumpToFalseOffsetIndex = out.length + 1;
      pushJump(out, 0); // placeholder — jump to false branch
      out.push(...trueBytes);

      const jumpToEndOffsetIndex = out.length + 1;
      pushJump(out, 0); // placeholder — jump past false branch
      out.push(...falseBytes);

      patchS16(out, jumpToFalseOffsetIndex, trueBytes.length + 3);
      patchS16(out, jumpToEndOffsetIndex, falseBytes.length);
      return true;
    }

    case "EVENT_CALL_CUSTOM_EVENT": {
      const customEventId = String(args.customEventId ?? "");
      const customEvent = ctx.customEventsById?.[customEventId];
      if (!customEvent) {
        ctx.warnings(
          `GBA compiler: EVENT_CALL_CUSTOM_EVENT references unknown custom event "${customEventId}" — skipped`,
        );
        return false;
      }
      const stack = ctx.customEventCallStack ?? [];
      if (stack.includes(customEventId)) {
        ctx.warnings(
          `GBA compiler: EVENT_CALL_CUSTOM_EVENT "${customEventId}" is recursive — skipped to avoid infinite inline`,
        );
        return false;
      }
      // Inline the custom event's script. Parameter (variable/actor) remapping
      // is not yet supported — calls to parameterless custom events work fully.
      const nestedCtx: GBACompileContext = {
        ...ctx,
        customEventCallStack: [...stack, customEventId],
      };
      out.push(...compileNestedEvents(customEvent.script ?? [], nestedCtx));
      return true;
    }

    case "EVENT_GROUP": {
      // A group is purely organisational — inline its children in order.
      const children =
        (args.true as GBAScriptEvent[] | undefined) ??
        event.children?.true ??
        [];
      out.push(...compileNestedEvents(children, ctx));
      return true;
    }

    case "EVENT_LOOP": {
      const children =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      const childBytes = compileNestedEvents(children, ctx);
      out.push(...childBytes);
      pushJump(out, -(childBytes.length + 3));
      return true;
    }

    case "EVENT_IF_COLOR_SUPPORTED": {
      // The GBA always supports colour, so the "true" branch is always taken.
      // Compile it inline and drop the "false" branch entirely.
      const trueEvents =
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true;
      out.push(...compileNestedEvents(trueEvents, ctx));
      return true;
    }

    case "EVENT_IF_VALUE": {
      const directOpcode = compareOpcode(args.operator);
      const inverseOpcode = inverseCompareOpcode(args.operator);
      const opcode = directOpcode ?? inverseOpcode;
      if (!opcode) {
        return false;
      }
      compileConditional(
        out,
        {
          opcode,
          variable: parseVariableIndex(args.variable),
          value: clampU8(Number(args.comparator ?? 0)),
          invert: inverseOpcode !== undefined,
        },
        (args.true as GBAScriptEvent[] | undefined) ?? event.children?.true,
        (args.false as GBAScriptEvent[] | undefined) ?? event.children?.false,
        ctx,
      );
      return true;
    }

    case "EVENT_SWITCH": {
      // A switch compares one variable against up to 16 constant cases and
      // runs the first matching arm (or an optional else block).  We compile
      // it as a linear chain of VM_OP_IF_VAR_EQ_CONST checks — no new opcode
      // needed, since that's exactly what the GBA VM already supports.
      //
      // Bytecode shape per arm (value V, body B bytes):
      //   IF_VAR_EQ_CONST var V +3   ; if var == V, skip the jump-over
      //   JUMP  (3 + |B| + 3)        ; var != V → skip this arm + jump-to-end
      //   <body bytes>               ; arm body
      //   JUMP  <offset-to-end>      ; after body, skip remaining arms + else
      // After all arms:
      //   <else body bytes>
      //
      // We build the bodies first, patch jump targets once we know their sizes.
      const varIdx = parseVariableIndex(args.variable);
      const numChoices = Math.max(
        0,
        Math.min(16, Math.floor(Number(args.choices ?? 2))),
      );

      // Collect (value, compiledBody) pairs for each arm.
      type Arm = { value: number; body: number[] };
      const arms: Arm[] = [];
      for (let i = 0; i < numChoices; i++) {
        const rawVal = (args as Record<string, unknown>)[`value${i}`];
        const caseVal = constValueToU8(rawVal) ?? clampU8(i + 1);
        const branchEvents =
          (args as Record<string, unknown>)[`true${i}`] as
          | GBAScriptEvent[]
          | undefined;
        const children =
          event.children?.[`true${i}`] as GBAScriptEvent[] | undefined;
        arms.push({
          value: caseVal,
          body: compileNestedEvents(branchEvents ?? children, ctx),
        });
      }

      const elseEvents =
        (args as Record<string, unknown>).false as
        | GBAScriptEvent[]
        | undefined;
      const elseBody = compileNestedEvents(
        elseEvents ?? event.children?.false,
        ctx,
      );

      // Now emit the chained conditional jumps.
      // We need to patch "jump to end" offsets once we know total remaining size,
      // so we build the full output in a scratch buffer first.
      const scratch: number[] = [];
      // jumpToEndPatches[i] = index in `scratch` of the s16 offset to patch.
      const jumpToEndPatches: number[] = [];

      for (const arm of arms) {
        // IF_VAR_EQ_CONST var value +3  (branch-offset = 3: skip the JUMP below)
        scratch.push(VM_OP_IF_VAR_EQ_CONST, varIdx, arm.value);
        pushS16(scratch, 3);
        // JUMP over (body + trailing jump-to-end)
        // body.length + 3 (for the trailing JUMP + s16)
        const jumpOverOffset = arm.body.length + 3;
        scratch.push(VM_OP_JUMP);
        pushS16(scratch, jumpOverOffset);
        // body
        scratch.push(...arm.body);
        // JUMP to end — offset patched after we know all remaining bytes.
        scratch.push(VM_OP_JUMP);
        jumpToEndPatches.push(scratch.length); // record where the s16 goes
        pushS16(scratch, 0); // placeholder
      }

      // Else body follows immediately.
      const elseStart = scratch.length;
      scratch.push(...elseBody);
      const totalEnd = scratch.length;

      // Patch each jump-to-end with the offset from just after it to totalEnd.
      for (const patchIdx of jumpToEndPatches) {
        const fromAfterOffset = patchIdx + 2; // PC after reading the s16
        const offset = totalEnd - fromAfterOffset;
        patchS16(scratch, patchIdx, offset);
      }
      // Suppress unused-variable lint if elseStart equals totalEnd (no else).
      void elseStart;

      out.push(...scratch);
      return true;
    }

    case "EVENT_CHOICE": {
      const varIndex = parseVariableIndex(args.variable);
      const trueText = String(args.trueText || "Choice A");
      const falseText = String(args.falseText || "Choice B");

      // 1. Emit VM_OP_MENU targeting varIndex with 2 choices: trueText, falseText
      out.push(VM_OP_MENU, varIndex, 2);
      out.push(...encodeString(trueText));
      out.push(...encodeString(falseText));

      // 2. Post-fixup: if result is 2 (Choice B), map it to 0 (false)
      out.push(VM_OP_IF_VAR_EQ_CONST, varIndex, 2);
      pushS16(out, 3);
      out.push(VM_OP_JUMP);
      pushS16(out, 3);
      out.push(VM_OP_SET_CONST, varIndex, 0);

      return true;
    }

    case "EVENT_MENU": {
      // Emit: VM_OP_MENU  varIndex  n_items  "item1\0"  "item2\0"  ...
      // The GBA VM reads all inline strings from the bytecode stream and
      // stores the 1-based selection result (0 = cancelled with B) in var.
      const varIndex = parseVariableIndex(args.variable);
      const rawItems = Number(args.items ?? 2);
      const n = Math.max(1, Math.min(8, Math.floor(rawItems))); // clamp 1..8
      out.push(VM_OP_MENU, varIndex, n);
      for (let i = 1; i <= n; i++) {
        const label = String((args as Record<string, unknown>)[`option${i}`] ?? "");
        out.push(...encodeString(label));
      }
      return true;
    }

    case "EVENT_AWAIT_INPUT": {
      // Wait until any of the specified buttons are pressed.
      // Encoding: VM_OP_AWAIT_INPUT  mask_lo  mask_hi
      const mask = inputMask(args.input);
      // A mask of 0 means no buttons — treat as a no-op so the script
      // doesn't hang forever waiting for a button that can never be pressed.
      if (mask === 0) {
        return true;
      }
      out.push(VM_OP_AWAIT_INPUT, mask & 0xff, (mask >> 8) & 0xff);
      return true;
    }

    case "EVENT_RNG_SEED": {
      // Reseed the PRNG from a hardware entropy source (REG_VCOUNT XOR
      // current state). No operands needed — the VM handles the sampling.
      out.push(VM_OP_SEED_RNG);
      return true;
    }

    case "EVENT_SOUND_PLAY_EFFECT": {
      // Encoding: VM_OP_SOUND_PLAY_EFFECT  sfx_type  param1  param2  duration_frames
      //   sfx_type 0 = beep,  1 = tone,  2 = crash
      // fxhammer (sample-playback) has no GBA PSG equivalent — silently skip.
      const effectType = String(args.type ?? "beep");

      if (effectType === "beep" || effectType === "") {
        const pitch = Math.max(1, Math.min(8, Math.round(Number(args.pitch ?? 4))));
        // GB Studio pitch 1..8 → index 0..7 (1=lowest, 8=highest).
        const pitchIndex = clampU8(pitch - 1);
        const seconds =
          typeof args.duration === "number" ? args.duration : 0.5;
        const durationFrames = clampU8(Math.round(seconds * 60));
        const shouldWait = args.wait !== false;
        out.push(VM_OP_SOUND_PLAY_EFFECT, 0, pitchIndex, 0, durationFrames);
        if (shouldWait && durationFrames > 0) {
          let remaining = durationFrames;
          while (remaining > 0) {
            const chunk = Math.min(remaining, 255);
            out.push(VM_OP_WAIT, chunk);
            remaining -= chunk;
          }
        }
        return true;
      }

      if (effectType === "tone") {
        const freq = Math.max(1, Number(args.frequency ?? 200));
        // GB Studio → GBA period: period = floor(2048 - 131072/freq + 0.5), clamped 0..2047.
        const rawPeriod = Math.round(2048 - 131072 / freq);
        const period = Math.max(0, Math.min(2047, rawPeriod));
        const param1 = (period >> 8) & 0x07;
        const param2 = period & 0xff;
        const seconds =
          typeof args.duration === "number" ? args.duration : 0.5;
        const durationFrames = clampU8(Math.round(seconds * 60));
        const shouldWait = args.wait !== false;
        out.push(VM_OP_SOUND_PLAY_EFFECT, 1, param1, param2, durationFrames);
        if (shouldWait && durationFrames > 0) {
          let remaining = durationFrames;
          while (remaining > 0) {
            const chunk = Math.min(remaining, 255);
            out.push(VM_OP_WAIT, chunk);
            remaining -= chunk;
          }
        }
        return true;
      }

      if (effectType === "crash") {
        const seconds =
          typeof args.duration === "number" ? args.duration : 0.5;
        const durationFrames = clampU8(Math.round(seconds * 60));
        const shouldWait = args.wait !== false;
        out.push(VM_OP_SOUND_PLAY_EFFECT, 2, 0, 0, durationFrames);
        if (shouldWait && durationFrames > 0) {
          let remaining = durationFrames;
          while (remaining > 0) {
            const chunk = Math.min(remaining, 255);
            out.push(VM_OP_WAIT, chunk);
            remaining -= chunk;
          }
        }
        return true;
      }

      // fxhammer or unknown type — no GBA PSG equivalent, silently no-op.
      return true;
    }

    default:
      return false;
  }
}

function compileEvents(
  events: GBAScriptEvent[],
  ctx: GBACompileContext,
  appendEnd: boolean,
): number[] {
  const out: number[] = [];
  for (const event of events) {
    // Disabled events have args.__comment set to a truthy value.
    // EVENT_COMMENT blocks are pure annotations. Both are silently skipped.
    if (event.args?.__comment || event.command === "EVENT_COMMENT") {
      continue;
    }
    const ok = compileEvent(event, out, ctx);
    if (!ok) {
      ctx.warnings(
        `GBA compiler: unsupported event "${event.command}" — skipped`,
      );
    }
  }
  if (appendEnd) {
    out.push(VM_OP_END);
  }
  return out;
}

// Compile a full script event array into a flat GBA VM bytecode array.
// Always terminates with VM_OP_END, even if the script is empty.
export function compileGBAScript(
  events: GBAScriptEvent[],
  ctx: GBACompileContext,
): number[] {
  return compileEvents(events, ctx, true);
}

// Emit a C byte-array literal for the given bytecode.
// symbol: C identifier for the array (e.g. "scene_1_trigger_0_script")
export function emitGBAScriptC(symbol: string, bytecode: number[]): string {
  const bytes = bytecode
    .map((b, i) => {
      if (!Number.isFinite(b)) {
        throw new Error(`Invalid GBA bytecode byte at ${symbol}[${i}]: ${b}`);
      }
      const byte = clampU8(b);
      return `${i % 16 === 0 ? "\n  " : " "}0x${byte.toString(16).padStart(2, "0").toUpperCase()}`;
    })
    .join(",");
  return `static const uint8_t ${symbol}[${bytecode.length}] = {${bytes}\n};`;
}
