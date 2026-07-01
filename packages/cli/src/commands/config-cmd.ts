import { readConfig, writeConfig, configPath } from "../config.js";

export async function runConfig(
  action: "set" | "get" | "show",
  keyName?: string,
  value?: string
): Promise<void> {
  if (action === "show" || (!keyName && action !== "set")) {
    const cfg = readConfig();
    console.log(`Konfigurationsdatei: \x1b[2m${configPath()}\x1b[0m`);
    console.log();
    console.log(`  url:    ${cfg.url    ?? "\x1b[2m(nicht gesetzt)\x1b[0m"}`);
    console.log(`  apiKey: ${cfg.apiKey ? cfg.apiKey.slice(0, 18) + "…" : "\x1b[2m(nicht gesetzt)\x1b[0m"}`);
    return;
  }

  if (action === "get") {
    const cfg = readConfig();
    const val = keyName === "url" ? cfg.url : keyName === "key" ? cfg.apiKey : undefined;
    if (val === undefined) {
      console.error(`Unbekannte Option: ${keyName}`);
      process.exit(1);
    }
    console.log(val ?? "");
    return;
  }

  if (action === "set") {
    if (!keyName || !value) {
      console.error("Verwendung: ankercode config set <url|key> <wert>");
      process.exit(1);
    }
    const allowed = ["url", "key"];
    if (!allowed.includes(keyName)) {
      console.error(`Unbekannte Option: ${keyName}. Erlaubt: ${allowed.join(", ")}`);
      process.exit(1);
    }
    writeConfig(keyName === "url" ? { url: value } : { apiKey: value });
    console.log(`\x1b[32m✓\x1b[0m ${keyName} gesetzt`);
    console.log(`  Gespeichert in: \x1b[2m${configPath()}\x1b[0m`);
  }
}
