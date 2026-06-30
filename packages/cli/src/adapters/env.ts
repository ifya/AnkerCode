import { homedir } from "os";
import { join } from "path";

export function scannerEnv(): NodeJS.ProcessEnv {
  const extraPaths = [
    join(homedir(), ".local", "bin"),
    "/usr/local/bin",
  ].join(":");
  return {
    ...process.env,
    PATH: `${extraPaths}:${process.env["PATH"] ?? ""}`,
  };
}
