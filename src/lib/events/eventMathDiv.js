const l10n = require("../helpers/l10n").default;

const id = "EVENT_MATH_DIV";
const groups = ["EVENT_GROUP_MATH"];

const fields = [
  {
    key: "vectorX",
    label: l10n("FIELD_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
  {
    key: "value",
    label: l10n("FIELD_VALUE"),
    type: "number",
    defaultValue: 2,
  },
];

const compile = (input, helpers) => {
  const { variableDiv } = helpers;
  if (variableDiv) {
    variableDiv(input.vectorX, input.value);
  }
};

module.exports = {
  id,
  groups,
  fields,
  compile,
};
