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
| EVENT_TEXT_DRAW | ✅ | ✅ `VM_OP_SHOW_TEXT` | 🟡 | ✅ | Mapped to VM_OP_SHOW_TEXT |
| EVENT_SWITCH_SCENE | ✅ | ✅ `VM_OP_LOAD_SCENE` | ✅ | ✅ | Supports entry position (x, y) & direction; fade speed omitted |
| EVENT_SET_VALUE | ✅ | ✅ `VM_OP_SET_CONST` / `VM_OP_COPY_VAR` | ✅ | ❌ | Constant or variable source only |
| EVENT_INC_VALUE | ✅ | ✅ `VM_OP_ADD_CONST` | ✅ | ❌ | |
| EVENT_DEC_VALUE | ✅ | ✅ `VM_OP_SUB_CONST` | ✅ | ❌ | |
| EVENT_VARIABLE_MATH | 🟡 | ✅ add/sub/copy/rnd | ✅ | ❌ | Only `set`/`add`/`sub`/`rnd`; `mul`/`div`/`mod`/bitwise skipped |
| EVENT_WAIT | ✅ | ✅ `VM_OP_WAIT` | ✅ | ❌ | Frame count clamped to u8 (max 255) |
| EVENT_PALETTE_SET_BACKGROUND | 🟡 | ✅ `VM_OP_SET_SCENE_TONE` | 🟡 | ❌ | Maps to a single scene "tone"; no per-palette RGB |
| EVENT_FADE_IN | 🟡 | ✅ `VM_OP_SET_SCENE_TONE` | 🟡 | ✅ | Maps fade in to normal scene tone (0) |
| EVENT_FADE_OUT | 🟡 | ✅ `VM_OP_SET_SCENE_TONE` | 🟡 | ✅ | Maps fade out to dark scene tone (3) |
| EVENT_IF | 🟡 | ✅ `VM_OP_IF_VAR_*` | ✅ | ❌ | Variable-to-constant comparisons only |
| EVENT_IF_TRUE | ✅ | ✅ `VM_OP_IF_VAR_GT_CONST` | ✅ | ❌ | |
| EVENT_IF_FALSE | ✅ | ✅ `VM_OP_IF_VAR_GT_CONST` (inverted) | ✅ | ❌ | |
| EVENT_IF_VALUE | ✅ | ✅ `VM_OP_IF_VAR_{EQ,GT,LT}_CONST` | ✅ | ✅ | eq/ne/gt/lt/gte/lte via direct+inverse opcodes |
| EVENT_GROUP | ✅ | n/a | n/a | ✅ | Inlines child events; purely organisational, no opcode |
| EVENT_IF_COLOR_SUPPORTED | ✅ | n/a | n/a | ✅ | GBA always has colour; true branch inlined at compile time |
| EVENT_IF_INPUT | ✅ | ✅ `VM_OP_IF_INPUT` | ✅ | ✅ | 16-bit key mask; branches on held buttons |
| EVENT_ACTOR_SET_POSITION | ✅ | ✅ `VM_OP_ACTOR_SET_POS` | ✅ | ✅ | u8 coords (tile for iso, pixel for top-down) |
| EVENT_ACTOR_MOVE_RELATIVE | ✅ | ✅ `VM_OP_ACTOR_MOVE_REL` | ✅ | ✅ | signed-byte deltas; instant (non-animated) move |
| EVENT_ACTOR_SET_DIRECTION | 🟡 | ✅ `VM_OP_ACTOR_SET_DIR` | 🟡 | ✅ | Stored on actor; renderer doesn't use it yet |
| EVENT_ACTOR_ACTIVATE | 🟡 | ✅ `VM_OP_ACTOR_SET_HIDDEN` | ✅ | ✅ | Mapped to show (hidden=0) |
| EVENT_ACTOR_DEACTIVATE | 🟡 | ✅ `VM_OP_ACTOR_SET_HIDDEN` | ✅ | ✅ | Mapped to hide (hidden=1) |
| EVENT_CALL_CUSTOM_EVENT | 🟡 | n/a | n/a | ✅ | Inlined at compile time; no parameter remapping yet |

## Missing events (skipped with warning)

These appear in the build log as `unsupported event "…" — skipped`. Grouped
by the phase that will address them.

### Phase 2 — critical

| Event | Notes |
|-------|-------|
| EVENT_CHOICE | Player menu / yes-no; needs textbox cursor + input + branch |

### Phase 3 — actor system (remaining)

| Event | Notes |
|-------|-------|
| EVENT_ACTOR_MOVE_TO | Move actor to target over time, optionally blocking |
| EVENT_ACTOR_SET_STATE | Switch sprite animation state |
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

- **23** events compile today (13 fully ✅, 10 partial 🟡).
- **~10** distinct events are still skipped.
- With input, variables, branching, text, scene changes, and actor
  position/visibility/direction now wired, a basic interactive game (move,
  talk, trigger scripts, branch on input/variables, call shared scripts) is
  buildable end-to-end.
- Remaining high-value gaps: **EVENT_CHOICE** (menus), **EVENT_ACTOR_MOVE_TO**
  (timed movement), **save** (Phase 5), and **audio** (Phase 6).

_Last audited against the build log on 2026-06-09._
