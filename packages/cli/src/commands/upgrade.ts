import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { realpathSync, existsSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { scannerEnv } from "../adapters/env.js";

const exec = promisify(execFile);

function repoRoot(): string {
  // Resolve symlink: ~/.local/bin/ankercode → .../packages/cli/dist/index.js
  // Go up: dist/ → cli/ → packages/ → repo root
  const self = realpathSync(fileURLToPath(import.meta.url));
  return resolve(self, "..", "..", "..", "..", "..");
}

async function currentVersion(root: string): Promise<string> {
  try {
    const { stdout } = await exec("git", ["-C", root, "rev-parse", "--short", "HEAD"]);
    return stdout.trim();
  } catch {
    return "unknown";
  }
}

async function pullLatest(root: string): Promise<boolean> {
  const { stdout } = await exec("git", ["-C", root, "pull", "--ff-only"], {
    env: scannerEnv(),
  });
  return !stdout.includes("Already up to date.");
}

function runInstallScript(root: string, scannersOnly: boolean): Promise<void> {
  return new Promise((res, rej) => {
    const script = join(root, "install.sh");
    const args = scannersOnly ? ["--scanners-only"] : [];
    const child = spawn("bash", [script, ...args], {
      stdio: "inherit",
      env: { ...scannerEnv(), ANKERCODE_UPGRADE: "1" },
    });
    child.on("close", (code) => (code === 0 ? res() : rej(new Error(`install.sh exited ${code}`))));
  });
}

async function rebuild(root: string): Promise<void> {
  const pnpm = join(process.env["HOME"] ?? "", ".local", "share", "pnpm", "bin", "pnpm");
  const bin = existsSync(pnpm) ? pnpm : "pnpm";
  const env = scannerEnv();

  process.stdout.write("  Building @ankercode/core...");
  await exec(bin, ["--filter", "@ankercode/core", "build"], { cwd: root, env });
  console.log(" done");

  process.stdout.write("  Building @ankercode/report...");
  await exec(bin, ["--filter", "@ankercode/report", "build"], { cwd: root, env });
  console.log(" done");

  process.stdout.write("  Building @ankercode/cli...");
  await exec(bin, ["--filter", "@ankercode/cli", "build"], { cwd: root, env });
  console.log(" done");
}

export interface UpgradeOptions {
  scanners: boolean;
}

export async function runUpgrade(opts: UpgradeOptions): Promise<void> {
  let root: string;
  try {
    root = repoRoot();
  } catch {
    console.error("Error: could not locate AnkerCode repository. Is the binary a symlink to the repo?");
    process.exit(1);
  }

  console.log(`\nAnkerCode upgrade`);
  console.log(`Repo : ${root}`);

  const before = await currentVersion(root);
  console.log(`Commit before : ${before}\n`);

  console.log("Pulling latest...");
  let updated: boolean;
  try {
    updated = await pullLatest(root);
  } catch (err) {
    console.error(`  git pull failed: ${(err as Error).message}`);
    console.error("  If you have local changes, stash them first: git stash");
    process.exit(1);
  }

  if (!updated) {
    console.log("  Already up to date.");
    if (!opts.scanners) {
      console.log();
      return;
    }
  } else {
    const after = await currentVersion(root);
    console.log(`  Updated ${before} → ${after}\n`);

    console.log("Installing dependencies...");
    const pnpm = join(process.env["HOME"] ?? "", ".local", "share", "pnpm", "bin", "pnpm");
    const bin = existsSync(pnpm) ? pnpm : "pnpm";
    await exec(bin, ["install", "--silent"], { cwd: root, env: scannerEnv() });

    console.log("\nRebuilding...");
    await rebuild(root);
  }

  if (opts.scanners) {
    console.log("\nUpdating scanners...");
    try {
      await runInstallScript(root, true);
    } catch (err) {
      console.error(`  Scanner update failed: ${(err as Error).message}`);
    }
  }

  console.log("\nDone. AnkerCode is up to date.\n");
}
