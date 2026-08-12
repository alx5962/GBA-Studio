const l10n = require("../helpers/l10n").default;

const id = "EVENT_ACTOR_SET_DIRECTION_TO_VALUE";
const groups = ["EVENT_GROUP_ACTOR"];

const autoLabel = (fetchArg) => {
  return l10n("EVENT_ACTOR_SET_DIRECTION_TO_VALUE", {
    actor: fetchArg("actorId"),
    variable: fetchArg("variable"),
  });
};

const fields = [
  {
    key: "actorId",
    label: l10n("ACTOR"),
    type: "actor",
    defaultValue: "$self$",
  },
  {
    key: "variable",
    label: l10n("FIELD_VARIABLE"),
    type: "variable",
    defaultValue: "LAST_VARIABLE",
  },
];

const compile = (input, helpers) => {
  const { actorSetActive, actorSetDirectionToVariable } = helpers;
  actorSetActive(input.actorId);
  actorSetDirectionToVariable(input.variable);
};

module.exports = {
  id,
  groups,
  fields,
  autoLabel,
  compile,
};
