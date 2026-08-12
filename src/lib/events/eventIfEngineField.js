const l10n = require("../helpers/l10n").default;

const id = "EVENT_IF_ENGINE_FIELD";
const groups = ["EVENT_GROUP_CONTROL_FLOW", "EVENT_GROUP_ENGINE_FIELDS"];

const autoLabel = (fetchArg) => {
  return l10n("EVENT_IF_ENGINE_FIELD_LABEL", {
    engineField: fetchArg("engineFieldKey"),
    operator: fetchArg("operator"),
    value: fetchArg("value"),
  });
};

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
    key: "value",
    type: "number",
    defaultValue: 0,
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
  const { engineFieldIfValue } = helpers;
  const truePath = input.__disableElse ? [] : input.true;
  const falsePath = input.__disableElse ? [] : input.false;
  if (engineFieldIfValue) {
    engineFieldIfValue(input.engineFieldKey, input.operator, input.value, truePath, falsePath);
  }
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
