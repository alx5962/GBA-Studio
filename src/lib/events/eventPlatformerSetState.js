const l10n = require("../helpers/l10n").default;

const id = "EVENT_PLATFORMER_SET_STATE";
const groups = ["EVENT_GROUP_ENGINE_FIELDS"];

const labelsMap = {
  fall: l10n("FIELD_FALL_STATE"),
  ground: l10n("FIELD_GROUND_STATE"),
  jump: l10n("FIELD_JUMP_STATE"),
  dash: l10n("FIELD_DASH_STATE"),
  ladder: l10n("FIELD_LADDER_STATE"),
  wall: l10n("FIELD_WALL_STATE"),
  knockback: l10n("FIELD_KNOCKBACK_STATE"),
  blank: l10n("FIELD_BLANK_STATE"),
  run: l10n("FIELD_RUN_STATE"),
  float: l10n("FIELD_FLOAT_STATE"),
};

const autoLabel = (_, input) => {
  return l10n("EVENT_PLATFORMER_STATE_SET_LABEL", {
    state: labelsMap[input.state] || l10n("FIELD_FALL_STATE"),
  });
};

const fields = [
  {
    key: "state",
    label: l10n("FIELD_STATE"),
    type: "select",
    defaultValue: "fall",
    options: Object.entries(labelsMap),
  },
];

const compile = (input, helpers) => {
  const { _setConstMemInt8 } = helpers;
  if (_setConstMemInt8) {
    _setConstMemInt8("plat_next_state", input.state);
  }
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
