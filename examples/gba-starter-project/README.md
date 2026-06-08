# GBA Starter Project

This template is a GBA-format conversion of the bundled GB Studio starter project.

Conversion rules:

- Backgrounds are scaled with nearest-neighbor pixel scaling.
- GB 20x18 tile scenes become GBA-friendly 30x20 tile scenes.
- Wider/taller sample maps keep their relative size while expanding to GBA tile proportions.
- Project resource metadata is updated to match the scaled PNG dimensions.

Current GBA runtime caveat: the native GBA VM is still incomplete, so this is an editor/compiler/template fixture until full scene and VM playback lands.
