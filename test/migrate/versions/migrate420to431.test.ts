import { migrateFrom420r3To431r1Actors } from "lib/project/migration/versions/420to431";
import { CompressedProjectResources } from "shared/lib/resources/types";
import { dummyCompressedProjectResources } from "../../dummydata";

type AnyActors = Array<Record<string, unknown>>;

function makeInput(scenes: unknown[]): CompressedProjectResources {
  return {
    ...dummyCompressedProjectResources,
    scenes: scenes as CompressedProjectResources["scenes"],
  };
}

describe("migrateFrom420r3To431r1Actors", () => {
  test("should add isoZ: 0 to actors that do not have it", () => {
    const input = makeInput([
      {
        id: "scene1",
        actors: [
          { id: "a1", x: 3, y: 4 },
          { id: "a2", x: 7, y: 2 },
        ],
      },
    ]);
    const output = migrateFrom420r3To431r1Actors(input);
    const actors = (output.scenes[0] as unknown as { actors: AnyActors }).actors;
    expect(actors[0].isoZ).toBe(0);
    expect(actors[1].isoZ).toBe(0);
  });

  test("should not overwrite isoZ when already set", () => {
    const input = makeInput([
      {
        id: "scene1",
        actors: [{ id: "a1", x: 3, y: 4, isoZ: 2 }],
      },
    ]);
    const output = migrateFrom420r3To431r1Actors(input);
    const actors = (output.scenes[0] as unknown as { actors: AnyActors }).actors;
    expect(actors[0].isoZ).toBe(2);
  });

  test("should handle scenes with no actors", () => {
    const input = makeInput([{ id: "scene1", actors: [] }]);
    const output = migrateFrom420r3To431r1Actors(input);
    const actors = (output.scenes[0] as unknown as { actors: AnyActors }).actors;
    expect(actors).toHaveLength(0);
  });
});
