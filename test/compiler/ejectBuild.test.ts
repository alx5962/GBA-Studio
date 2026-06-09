jest.mock("rimraf", () => {
  const rimrafMock = jest.fn();
  return rimrafMock;
});

import rimraf from "rimraf";
import { removeBuildFolder } from "../../src/lib/compiler/ejectBuild";

const mockedRimraf = rimraf as unknown as jest.Mock;

beforeEach(() => {
  mockedRimraf.mockReset();
});

test("removeBuildFolder retries transient Windows lock errors", async () => {
  const busyError = Object.assign(new Error("busy"), { code: "EBUSY" });
  mockedRimraf
    .mockImplementationOnce((_path, callback) => callback(busyError))
    .mockImplementationOnce((_path, callback) => callback(undefined));

  await expect(removeBuildFolder("C:\\tmp\\_gbsbuild")).resolves.toBeUndefined();
  expect(mockedRimraf).toHaveBeenCalledTimes(2);
});

test("removeBuildFolder does not retry non-lock errors", async () => {
  const missingPermissionError = Object.assign(new Error("denied"), {
    code: "EACCES",
  });
  mockedRimraf.mockImplementationOnce((_path, callback) =>
    callback(missingPermissionError),
  );

  await expect(removeBuildFolder("C:\\tmp\\_gbsbuild")).rejects.toBe(
    missingPermissionError,
  );
  expect(mockedRimraf).toHaveBeenCalledTimes(1);
});
