import { readFileSync, writeFileSync } from "fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { minAppVersion } = manifest;

let targetVersion = process.argv[2];

if (!targetVersion) {
	const currentVersion = manifest.version;
	const [major, minor, patch] = currentVersion.split(".").map(Number);
	targetVersion = `${major}.${minor}.${patch + 1}`;
	console.log(`No version argument provided. Auto-bumping patch version: ${currentVersion} -> ${targetVersion}`);
} else {
	console.log(`Version argument provided. Bumping to: ${targetVersion}`);
}

// update manifest.json
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t"));

// update versions.json with target version and minAppVersion from manifest.json
const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
versions[targetVersion] = minAppVersion;
writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));

// update package.json
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = targetVersion;
writeFileSync("package.json", JSON.stringify(pkg, null, "\t"));

import { execSync } from "child_process";

try {
	execSync("git add manifest.json versions.json package.json");
	execSync(`git commit -m "chore(release): ${targetVersion}"`);
	execSync(`git tag -a ${targetVersion} -m "chore(release): ${targetVersion}"`);
	console.log(`Committed and tagged version ${targetVersion}`);
} catch (e) {
	console.error("Git operations failed:", e.message);
	process.exit(1);
}
