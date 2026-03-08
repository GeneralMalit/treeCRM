import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function updateLockfileVersion(lockfile, version) {
  lockfile.version = version;

  if (lockfile.packages && lockfile.packages[""]) {
    lockfile.packages[""].version = version;
  }

  return lockfile;
}

function syncReadmeVersion(readme, version) {
  return readme
    .replace(/treeCRM-v\d+\.\d+\.\d+/g, `treeCRM-v${version}`)
    .replace(/Current app version: `\d+\.\d+\.\d+`/g, `Current app version: \`${version}\``)
    .replace(/Footer text: `\(c\) 2026 treeCRM by General Malit - v\d+\.\d+\.\d+`/g, `Footer text: \`(c) 2026 treeCRM by General Malit - v${version}\``);
}

async function main() {
  const rootPackagePath = path.join(repoRoot, "package.json");
  const backendPackagePath = path.join(repoRoot, "backend", "package.json");
  const frontendPackagePath = path.join(repoRoot, "frontend", "package.json");
  const backendLockPath = path.join(repoRoot, "backend", "package-lock.json");
  const frontendLockPath = path.join(repoRoot, "frontend", "package-lock.json");
  const readmePath = path.join(repoRoot, "README.md");

  const rootPackage = await readJson(rootPackagePath);
  const version = rootPackage.version;

  for (const packagePath of [backendPackagePath, frontendPackagePath]) {
    const packageJson = await readJson(packagePath);
    packageJson.version = version;
    await writeJson(packagePath, packageJson);
  }

  for (const lockPath of [backendLockPath, frontendLockPath]) {
    const lockfile = await readJson(lockPath);
    await writeJson(lockPath, updateLockfileVersion(lockfile, version));
  }

  const readme = await readFile(readmePath, "utf8");
  await writeFile(readmePath, syncReadmeVersion(readme, version), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
