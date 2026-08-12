const l10n = require("../helpers/l10n").default;

const id = "EVENT_LOOP_WHILE_EXPRESSION";
const groups = ["EVENT_GROUP_CONTROL_FLOW"];

const autoLabel = () => {
  return l10n("EVENT_LOOP_WHILE_EXPRESSION");
};

const fields = [
  {
    key: "expression",
    label: l10n("FIELD_EXPRESSION"),
    type: "textarea",
    defaultValue: "",
  },
  {
    key: "true",
    type: "events",
  },
];

const compile = (input, helpers) => {
  const { loopWhileExpression } = helpers;
  if (loopWhileExpression) {
    loopWhileExpression(input.expression, input.true);
  }
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
