# GBA VM Event Compatibility

This document tracks how GB Studio script events map onto the GBA VM
(`compileGBAEvents.ts` → `vm.h` opcodes → `vm.c` execution → `engine.c`
runtime). It is the source of truth for Phase 1 of the GB Studio
compatibility effort.

## Status legend

| Mark | Meaning |
|------|---------|
| ✅ Supported | Compiles, executes in the VM, and behaves correctly at runtime |
| 🟡 Partial | Works for a subset of arguments/modes; some paths are skipped |
| 🟫 Stubbed | Recognised but emits a no-op / placeholder |
| ❌ Missing | Not recognised by the compiler; skipped with a warning |

## Column meaning

- **Compiler** — handled in `src/lib/compiler/compileGBAEvents.ts`
- **VM** — opcode defined in `appData/engine/gbavm/include/vm.h` and dispatched in `src/vm.c`
- **Engine** — runtime side-effect wired in `src/engine.c`
- **Tests** — automated coverage exists

## Supported / in-progress events

| Event | Compiler | VM | Engine | Tests | Notes |
|-------|----------|----|--------|-------|-------|
| EVENT_END | ✅ | ✅ `VM_OP_END` | ✅ | ❌ | Terminates script thread |
| EVENT_TEXT | ✅ | ✅ `VM_OP_SHOW_TEXT` | 🟡 | ❌ | Renders first two wrapped lines; no paging/avatars/inline codes |
| EVENT_SWITCH_SCENE | ✅ | ✅ `VM_OP_LOAD_SCENE` | ✅ | ❌ | No fade / entry-position/direction args yet |
| EVENT_SET_VALUE | ✅ | ✅ `VM_OP_SET_CONST` / `VM_OP_COPY_VAR` | ✅ | ❌ | Constant or variable source only |
| EVENT_INC_VALUE | ✅ | ✅ `VM_OP_ADD_CONST` | ✅ | ❌ | |
| EVENT_DEC_VALUE | ✅ | ✅ `VM_OP_SUB_CONST` | ✅ | ❌ | |
| EVENT_VARIABLE_MATH | 🟡 | ✅ add/sub/copy/rnd | ✅ | ❌ | Only `set`/`add`/`sub`/`rnd`; `mul`/`div`/`mod`/bitwise skipped |
| EVENT_WAIT | ✅ | ✅ `VM_OP_WAIT` | ✅ | ❌ | Frame count clamped to u8 (max 255) |
| EVENT_PALETTE_SET_BACKGROUND | 🟡 | ✅ `VM_OP_SET_SCENE_TONE` | 🟡 | ❌ | Maps to a single scene "tone"; no per-palette RGB |
| EVENT_IF | 🟡 | ✅ `VM_OP_IF_VAR_*` | ✅ | ❌ | Variable-to-constant comparisons only |
| EVENT_IF_TRUE | ✅ | ✅ `VM_OP_IF_VAR_GT_CONST` | ✅ | ❌ | |
| EVENT_IF_FALSE | ✅ | ✅ `VM_OP_IF_VAR_GT_CONST` (inverted) | ✅ | ❌ | |
| EVENT_IF_VALUE | ✅ | ✅ `VM_OP_IF_VAR_{EQ,GT,LT}_CONST` | ✅ | ✅ | eq/ne/gt/lt/gte/lte via direct+inverse opcodes |
| EVENT_GROUP | ✅ | n/a | n/a | ✅ | Inlines child events; purely organisational, no opcode |
| EVENT_IF_COLOR_SUPPORTED | ✅ | n/a | n/a | ✅ | GBA always has colour; true branch inlined at compile time |

## Missing events (skipped with warning)

These appear in the build log as `unsupported event "…" — skipped`. Grouped
by the phase that will address them.

### Phase 2 — critical

| Event | Notes |
|-------|-------|
| EVENT_CHOICE | Player menu / yes-no; needs textbox cursor + input + branch |
| EVENT_CALL_CUSTOM_EVENT | Invoke reusable script with parameter passing (also Phase 7) |
| EVENT_IF_INPUT | Branch on held/pressed buttons |

### Phase 3 — actor system

| Event | Notes |
|-------|-------|
| EVENT_ACTOR_SET_POSITION | Set actor x/y (tile or pixel) |
| EVENT_ACTOR_MOVE_TO | Move actor to target, optionally blocking |
| EVENT_ACTOR_MOVE_RELATIVE | Move by delta |
| EVENT_ACTOR_SET_DIRECTION | Face up/down/left/right |
| EVENT_ACTOR_SET_STATE | Switch sprite animation state |
| EVENT_ACTOR_ACTIVATE | Enable/disable actor |
| EVENT_ACTOR_PUSH | Push actor in facing direction |
| EVENT_ACTOR_EMOTE | Show emote bubble above actor |
| EVENT_PLATFORMER_STATE_SET | Platformer-specific; lower priority |

### Phase 4 — conditionals

| Event | Notes |
|-------|-------|
| EVENT_IF_ACTOR_AT_POSITION | Branch on actor at tile |
| EVENT_IF_ACTOR_RELATIVE_TO_ACTOR | Branch on relative position of two actors |

### Phase 5 — save system

| Event | Notes |
|-------|-------|
| EVENT_SAVE_DATA | SRAM save: variables, flags, scene, player position |

### Phase 6 — audio

| Event | Notes |
|-------|-------|
| EVENT_MUSIC_PLAY | Start track |
| EVENT_MUSIC_STOP | Stop track |
| EVENT_SOUND_PLAY_EFFECT | One-shot SFX |

## Summary

- **15** events compile today (10 fully ✅, 5 partial 🟡).
- **~18** distinct events are still skipped.
- Highest-leverage features for playability: **EVENT_CHOICE**,
  **EVENT_CALL_CUSTOM_EVENT**, and the **actor** events (Phase 3), since the
  Adventure/Dialogue templates lean on them heavily.

_Last audited against the build log on 2026-06-09._
