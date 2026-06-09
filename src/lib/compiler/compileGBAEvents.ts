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
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parseVariableIndex(variable: unknown): number {
  const variableId = String(variable ?? "0");
  const numericPart = variableId.replace(/[^0-9]/g, "");
  return clampU8(parseInt(numericPart || "0", 10));
}

function scriptValueVariableIndex(value: unknown): number | undefined {
  if (!value || typeof value !== "object" || !("type" in value)) {
    return undefined;
  }

  const scriptValue = value as { type?: unknown; value?: unknown };
  if (scriptValue.type !== "variable") {
    return undefined;
  }

  return parseVariableIndex(scriptValue.value);
}

function constValueToU8(value: unknown): number | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return clampU8(Number(value));
  }

  if (!value || typeof value !== "object" || !("type" in value)) {
    return 0;
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
  if (!condition || typeof condition !== "object") {
    return undefined;
  }

  const scriptValue = condition as {
    type?: unknown;
    value?: unknown;
    valueA?: unknown;
    valueB?: unknown;
  };

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
  if (!opcode) {
    return undefined;
  }

  const variable = scriptValueVariableIndex(scriptValue.valueA);
  const value = constValueToU8(scriptValue.valueB);
  if (variable === undefined || value === undefined) {
    ctx.warnings(
      `GBA compiler: EVENT_IF only supports variable-to-constant comparisons — skipped`,
    );
    return undefined;
  }

  return {
    opcode,
    variable,
    value,
    invert: inverseOpcode !== undefined,
  };
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
      const frames = clampU8(Number(args.frames ?? 1));
      out.push(VM_OP_WAIT, frames);
      return true;
    }

    case "EVENT_PALETTE_SET_BACKGROUND": {
      const tone = clampU8(
        Number(args.tone ?? args.palette ?? args.palette0 ?? 0),
      );
      out.push(VM_OP_SET_SCENE_TONE, tone);
      return true;
    }

    case "EVENT_IF": {
      const condition = conditionFromScriptValue(args.condition, ctx);
      if (!condition) {
        return false;
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

    case "EVENT_GROUP": {
      // A group is purely organisational — inline its children in order.
      const children =
        (args.true as GBAScriptEvent[] | undefined) ??
        event.children?.true ??
        [];
      out.push(...compileNestedEvents(children, ctx));
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
