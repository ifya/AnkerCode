---
title: Quick Start
description: Go from zero to a German PDF compliance report in under five minutes.
---

This guide gets you from a fresh install to a full Evidence Report on a real repository.

## 1. Install AnkerCode

```bash
bash install.sh
```

See [Installation](/installation/) for full details.

## 2. (Optional) Initialize triage decisions

If this is the first time you're scanning a project, create the decisions file:

```bash
ankercode init /path/to/your/project
```

This creates `ankercode.decisions.yaml` in your project root. Commit this file — it makes your reports reproducible. You can leave it empty for now and fill it in after you see the findings.

## 3. Run the full check

```bash
ankercode check /path/to/your/project
```

This runs all scanners and generates PDF, HTML, and DOCX reports in one step.

Output:

```
AnkerCode check — /path/to/your/project
  Scanning... ✓
  Wrote findings.json (47 findings)
  Wrote sbom.cyclonedx.json
  Generating PDF... → ankercode/report-2026-06-30.pdf
  Generating HTML... → ankercode/report-2026-06-30.html
  Generating DOCX... → ankercode/report-2026-06-30.docx
```

## 4. Open the report

```bash
xdg-open /path/to/your/project/ankercode/report-2026-06-30.pdf   # Linux
open /path/to/your/project/ankercode/report-2026-06-30.pdf        # macOS
```

The report contains seven sections in German:
1. **Zusammenfassung** — key metrics at a glance
2. **SBOM-Zusammenfassung** — CycloneDX SBOM reference + hash
3. **Schwachstellen** — all CVEs grouped by severity (Critical → Info)
4. **Lizenz-Risiko** — license inventory
5. **Vulnerability-Handling-Nachweis** — your VEX statements
6. **Akzeptierte Risiken** — documented risk acceptances
7. **Methodik** — scanner versions used (for reproducibility)

## 5. Triage findings

Open `ankercode/findings.json` or the HTML report and copy finding IDs for anything you want to document. Then edit `ankercode.decisions.yaml`:

```yaml
vex:
  - findingId: "abc123def456abcd"
    status: not_affected
    justification: vulnerable_code_not_in_execute_path
    statement: "Die betroffene Funktion wird in unserem Deployment nicht aufgerufen."
    author: "Vorname Nachname"
    timestamp: "2026-06-30T10:00:00.000Z"

riskAcceptances:
  - findingId: "def456abc789def0"
    reason: "Nur in der Entwicklungsumgebung vorhanden."
    acceptedBy: "Vorname Nachname"
    expiresAt: "2027-01-01"
```

Regenerate the report — it now includes your documented decisions:

```bash
ankercode report /path/to/your/project --pdf
```

## What gets written to disk

Everything is written under `ankercode/` inside your project:

```
your-project/
  ankercode/
    findings.json           ← normalized findings (all scanners)
    sbom.cyclonedx.json     ← CycloneDX SBOM from Syft
    audit.jsonl             ← append-only audit log
    report-2026-06-30.pdf   ← German Evidence Report
    report-2026-06-30.html  ← standalone HTML version
    report-2026-06-30.docx  ← Word version
  ankercode.decisions.yaml  ← your triage decisions (commit this)
```

The `ankercode/` folder (except `ankercode.decisions.yaml`) is gitignored by default. Commit the decisions file and the reports you want to keep.
