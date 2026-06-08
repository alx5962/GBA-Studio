# GBA Script Backend

The current GBA build path is a native GBA prototype backend. It deliberately skips GB Studio's GB VM assembly backend and emits GBA-compatible C scene records plus a small bytecode bootstrap script.

## Why This Exists

GB Studio's normal event compiler emits GBDK/GB VM assembly. Those files contain directives and macros such as:

- `.module`
- `.area`
- `vm_push_const`
- `vm_call_far`
- `vm_idle`
- `vm_stop`

That output is valid for the GB Studio VM toolchain, but it is not ARM assembly and cannot be assembled by devkitARM. Adding include paths for `vm.i` would not fix the core issue because the instruction set and runtime model are different.

## Current Prototype Behavior

For GBA builds, the compiler currently:

- avoids the GB VM event assembly backend
- emits `src/data/gba_scene_data.c`
- emits `include/data/gba_scene_data.h`
- serializes every project scene into native `gba_scene_def_t` records
- serializes collision arrays for the engine's Mode 0 proof renderer
- emits a bootstrap bytecode script that loads the configured start scene
- warns: `GBA VM runtime is minimal: scene records load, full GB Studio script events are still pending.`

The runtime now has a minimal bytecode loop supporting:

- `VM_OP_END`
- `VM_OP_LOAD_SCENE`
- `VM_OP_SET_SCENE_TONE`
- `VM_OP_WAIT`

This is enough to prove that project scenes are compiled into the GBA ROM and loaded by the native GBA engine. It is not yet full GB Studio event compatibility.

## Required Long-Term Backend

The real backend should translate GB Studio events into a GBA runtime boundary:

```text
GB Studio events
  -> intermediate script representation
  -> GBA runtime calls in C or ARM assembly
  -> devkitARM build
```

Initial supported operations should be deliberately small:

- idle
- stop
- call custom script
- actor reference
- button checks, including L/R
- scene transition placeholder

GBA builds must never pass `.module`, `.area`, or `vm_*` GB VM assembly into devkitARM.
