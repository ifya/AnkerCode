import { execFile } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import type { SbomRef } from "@ankercode/core";
import { scannerEnv } from "./env.js";

const exec = promisify(execFile);

export async function runSyft(targetPath: string, outputDir: string): Promise<SbomRef> {
  const sbomPath = join(outputDir, "sbom.cyclonedx.json");

  await exec("syft", ["scan", targetPath, "-o", `cyclonedx-json=${sbomPath}`, "--quiet"], {
    env: scannerEnv(),
    maxBuffer: 100 * 1024 * 1024,
  });

  const content = readFileSync(sbomPath);
  const hash = createHash("sha256").update(content).digest("hex");

  return { format: "CycloneDX", path: sbomPath, hash };
}
