const l10n = require("../helpers/l10n").default;

const id = "EVENT_CODE";
const groups = ["EVENT_GROUP_CONTROL_FLOW"];

const autoLabel = () => {
  return l10n("EVENT_CODE");
};

const fields = [
  {
    key: "code",
    label: l10n("FIELD_CODE"),
    type: "textarea",
    defaultValue: "",
  },
];

const compile = (input, helpers) => {
  const { gbvmScript } = helpers;
  if (gbvmScript) {
    gbvmScript(input.code);
  }
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
