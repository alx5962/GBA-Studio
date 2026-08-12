const l10n = require("../helpers/l10n").default;

const id = "EVENT_PLATFORMER_DETACH_PLATFORM";
const groups = ["EVENT_GROUP_CONTROL_FLOW"];

const autoLabel = () => {
  return l10n("EVENT_PLATFORMER_DETACH_PLATFORM");
};

const fields = [];

const compile = () => {};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
