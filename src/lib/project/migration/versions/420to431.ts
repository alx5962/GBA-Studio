/**
 * GBA Studio 4.2.0-r3 → 4.3.1-r1
 *
 * Changes:
 * - Actors gain an optional `isoZ` field (height layer for isometric scenes).
 *   We default it to 0 for any actor that doesn't already have it, ensuring
 *   existing projects open cleanly after the 4.3.1 upgrade.
 */

import { CompressedProjectResources } from "shared/lib/resources/types";
import {
  ProjectResourcesMigration,
  ProjectResourcesMigrationFn,
} from "lib/project/migration/helpers";

export const migrateFrom420r3To431r1Actors: ProjectResourcesMigrationFn = (
  resources,
) => {
  // `resources.scenes` is an array of scene resource objects, each with an
  // `actors` array of actor resource objects. We touch them only if isoZ is
  // absent so existing projects with manually-set isoZ values are not reset.
  const scenes = (resources.scenes ?? []).map((scene: Record<string, unknown>) => {
    const actors = ((scene.actors as Record<string, unknown>[]) ?? []).map(
      (actor) => {
        if (actor.isoZ !== undefined) return actor;
        return { ...actor, isoZ: 0 };
      },
    );
    return { ...scene, actors };
  });

  return { ...resources, scenes } as unknown as CompressedProjectResources;
};

export const migrate420r3To431r1: ProjectResourcesMigration = {
  from: { version: "4.2.0", release: "3" },
  to: { version: "4.3.1", release: "1" },
  migrationFn: migrateFrom420r3To431r1Actors,
};
