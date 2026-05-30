# GBA Script Backend

The current GBA build path is a proof build. It deliberately skips GB Studio VM script assembly and emits a minimal GBA-compatible C proof scene instead.

## Why This Exists

GB Studio's normal event compiler emits GBDK/GB VM assembly. Those files contain directives and macros such as:

- `.module`
- `.area`
- `vm_push_const`
- `vm_call_far`
- `vm_idle`
- `vm_stop`

That output is valid for the GB Studio VM toolchain, but it is not ARM assembly and cannot be assembled by devkitARM. Adding include paths for `vm.i` would not fix the core issue because the instruction set and runtime model are different.

## Current Proof-Build Behavior

For GBA builds, the compiler currently:

- avoids the GB VM event assembly backend
- emits `src/data/gba_proof_scene.c`
- shows a placeholder Mode 3 screen
- warns: `GBA proof build: GB Studio VM scripts are currently skipped.`

This is enough to prove the repo can create a non-empty `.gba` file once devkitPro/devkitARM is installed.

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
