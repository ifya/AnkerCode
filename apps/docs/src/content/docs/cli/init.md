---
title: ankercode init
description: Create the ankercode.decisions.yaml template in your project.
---

`ankercode init` creates an `ankercode.decisions.yaml` file in your project root with a commented template explaining every field.

## Usage

```bash
ankercode init [path]
```

`path` defaults to the current directory if omitted.

## Example

```bash
ankercode init /path/to/my-project
# Created ankercode.decisions.yaml
```

If the file already exists, the command exits without overwriting it.

## What gets created

```yaml
# AnkerCode — Triage-Entscheidungen
# Committen Sie diese Datei ins Repository. Sie macht Reports reproduzierbar.

vex:
  # Beispiel: CVE als nicht betroffen markieren
  # - findingId: "abc123def456abcd"   # aus findings.json
  #   status: not_affected
  #   justification: vulnerable_code_not_in_execute_path
  #   statement: "Die betroffene Funktion wird in unserem Deployment nicht aufgerufen."
  #   author: "Vorname Nachname"
  #   timestamp: "2026-06-30T10:00:00.000Z"

riskAcceptances:
  # Beispiel: Risiko bewusst akzeptieren
  # - findingId: "def456abc789def0"
  #   reason: "Nur in der Entwicklungsumgebung, nicht in Produktion deployed."
  #   acceptedBy: "Vorname Nachname"
  #   expiresAt: "2027-01-01"
```

## Committing the file

Commit `ankercode.decisions.yaml` to your repository. It is what makes reports reproducible — the same `findings.json` + same `decisions.yaml` always produce the same report. This is the evidence trail.

The generated `ankercode/` folder (reports, findings, SBOM) is gitignored by default. The decisions file is explicitly kept.

## Next step

After running `ankercode scan`, open `ankercode/findings.json` or the HTML report, copy finding IDs for items you want to document, and fill in the decisions file. See [Triage & Decisions](/guides/decisions/) for the full workflow.
