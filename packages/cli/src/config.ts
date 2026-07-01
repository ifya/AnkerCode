import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR  = join(homedir(), ".ankercode");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface AnkerConfig {
  url?:    string;
  apiKey?: string;
}

export function readConfig(): AnkerConfig {
  const file: AnkerConfig = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      Object.assign(file, JSON.parse(readFileSync(CONFIG_FILE, "utf8")));
    } catch {
      // ignore malformed config
    }
  }
  const result: AnkerConfig = {};
  const url    = process.env.ANKERCODE_URL    ?? file.url;
  const apiKey = process.env.ANKERCODE_API_KEY ?? file.apiKey;
  if (url)    result.url    = url;
  if (apiKey) result.apiKey = apiKey;
  return result;
}

export function writeConfig(patch: Partial<AnkerConfig>): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  const current = existsSync(CONFIG_FILE)
    ? JSON.parse(readFileSync(CONFIG_FILE, "utf8"))
    : {};
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...patch }, null, 2));
}

export function configPath(): string {
  return CONFIG_FILE;
}
