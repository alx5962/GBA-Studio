const l10n = require("../helpers/l10n").default;

const id = "EVENT_IF_ENGINE_FIELD_COMPARE";
const groups = ["EVENT_GROUP_CONTROL_FLOW", "EVENT_GROUP_ENGINE_FIELDS"];

const fields = [
  {
    key: "engineFieldKey",
    label: l10n("FIELD_ENGINE_FIELD"),
    type: "engineField",
  },
  {
    key: "operator",
    type: "operator",
    defaultValue: "==",
  },
  {
    key: "variable",
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
  {
    key: "true",
    type: "events",
  },
  {
    key: "false",
    type: "events",
  },
];

const compile = (input, helpers) => {
  const { engineFieldIfVariable } = helpers;
  const truePath = input.__disableElse ? [] : input.true;
  const falsePath = input.__disableElse ? [] : input.false;
  if (engineFieldIfVariable) {
    engineFieldIfVariable(input.engineFieldKey, input.operator, input.variable, truePath, falsePath);
  }
};

module.exports = {
  id,
  groups,
  fields,
  compile,
};
