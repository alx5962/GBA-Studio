const l10n = require("../helpers/l10n").default;

const id = "EVENT_COPY_VALUE";
const groups = ["EVENT_GROUP_VARIABLES"];

const autoLabel = (fetchArg) => {
  return l10n("EVENT_COPY_VALUE_LABEL", {
    variable: fetchArg("variable"),
    otherVariable: fetchArg("otherVariable"),
  });
};

const fields = [
  {
    key: "variable",
    label: l10n("FIELD_SET_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
  {
    key: "otherVariable",
    label: l10n("FIELD_TO_VALUE_OF_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
];

const compile = (input, helpers) => {
  const { variableCopy } = helpers;
  if (variableCopy) {
    variableCopy(input.variable, input.otherVariable);
  }
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
