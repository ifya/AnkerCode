import { existsSync, writeFileSync } from "fs";
import { resolve, join } from "path";
import { DECISIONS_TEMPLATE } from "@ankercode/report";

export async function runInit(targetPath: string): Promise<void> {
  const target = resolve(targetPath);
  const decisionsPath = join(target, "ankercode.decisions.yaml");

  if (existsSync(decisionsPath)) {
    console.log(`Bereits vorhanden: ${decisionsPath}`);
    console.log("Nichts geändert.");
    return;
  }

  writeFileSync(decisionsPath, DECISIONS_TEMPLATE, "utf8");
  console.log(`\nErstellt: ${decisionsPath}`);
  console.log("Tragen Sie VEX-Aussagen und akzeptierte Risiken ein, dann erneut `ankercode report` ausführen.\n");
}
