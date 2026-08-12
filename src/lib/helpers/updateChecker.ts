import { dialog, shell } from "electron";
import semverValid from "semver/functions/valid";
import semverGt from "semver/functions/gt";
import { Octokit } from "@octokit/rest";
import settings from "electron-settings";
import l10n from "shared/lib/lang/l10n";

declare const VERSION: string;

const github = new Octokit();
const oneHour = 60 * 60 * 1000;

const cache = {
  latest: {
    value: "",
    timestamp: 0,
  },
};

const getLatestVersion = async () => {
  const now = new Date().getTime();
  if (cache.latest.timestamp > now) {
    return cache.latest.value;
  }

  const latest = await github.repos.getLatestRelease({
    owner: "chrismaltby",
    repo: "gb-studio",
  });

  if (latest) {
    const version = latest.data.tag_name.split("v").pop() ?? VERSION;
    cache.latest.value = version;
    cache.latest.timestamp = now + oneHour;
    return version;
  }

  return VERSION;
};

const getCurrentVersion = () => {
  return VERSION; /* Comes from webpack.plugins.js */
};

const needsUpdate = (latestVersion: string) => {
  try {
    const currentVersion = getCurrentVersion();
    if (semverValid(currentVersion) && semverValid(latestVersion)) {
      return semverGt(latestVersion, currentVersion);
    }
    return false;
  } catch (e) {
    return false;
  }
};

export const checkForUpdate = async (_force?: boolean) => {
  return;
};
