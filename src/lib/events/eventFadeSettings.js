const l10n = require("../helpers/l10n").default;

const id = "EVENT_FADE_SETTINGS";
const groups = ["EVENT_GROUP_SCREEN"];

const autoLabel = () => {
  return l10n("EVENT_FADE_SETTINGS");
};

const fields = [
  {
    key: "speed",
    label: l10n("FIELD_SPEED"),
    type: "number",
    min: 1,
    max: 10,
    defaultValue: 2,
  },
];

const compile = (input, helpers) => {
  const { fadeIn, fadeOut } = helpers;
  // Fade settings setup speed configuration
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
