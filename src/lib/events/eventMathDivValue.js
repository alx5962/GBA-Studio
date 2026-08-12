const l10n = require("../helpers/l10n").default;

const id = "EVENT_MATH_DIV_VALUE";
const groups = ["EVENT_GROUP_MATH"];

const fields = [
  {
    key: "vectorX",
    label: l10n("FIELD_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
  {
    key: "vectorY",
    label: l10n("FIELD_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
];

const compile = (input, helpers) => {
  const { variableDiv } = helpers;
  if (variableDiv) {
    variableDiv(input.vectorX, input.vectorY);
  }
};

module.exports = {
  id,
  groups,
  fields,
  compile,
};
