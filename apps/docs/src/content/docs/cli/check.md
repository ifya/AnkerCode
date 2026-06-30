---
title: ankercode check
description: Scan a repository and generate all reports in a single command.
---

`ankercode check` is the all-in-one command. It runs all scanners and generates PDF, HTML, and DOCX reports in a single step.

## Usage

```bash
ankercode check [path] [options]
```

`path` defaults to the current directory if omitted.

## Options

| Option | Description |
|---|---|
| `--project <name>` | Override the project name used in the report header. Defaults to the directory name. |
| `--pdf` | Generate PDF only (skips HTML and DOCX) |
| `--html` | Generate HTML only |
| `--docx` | Generate DOCX only |

If none of `--pdf`, `--html`, `--docx` are given, all three formats are generated.

## Examples

```bash
# Scan current directory, generate all formats
ankercode check

# Scan a specific path
ankercode check /path/to/my-product

# Use a custom project name in the report
ankercode check . --project "MyProduct v2.1"

# PDF only
ankercode check . --pdf
```

## What it does

Internally `check` runs [`ankercode scan`](/cli/scan/) (all scanners) followed by [`ankercode report`](/cli/report/). It is equivalent to:

```bash
ankercode scan /path/to/project   # runs --sbom --vulns --licenses --secrets
ankercode report /path/to/project --pdf --html --docx
```

If you want finer control — for example running only CVE and secret scans without generating a report — use `ankercode scan` directly with the appropriate flags.

## Output

All files are written to `<path>/ankercode/`:

```
ankercode/
  findings.json
  sbom.cyclonedx.json
  audit.jsonl
  report-YYYY-MM-DD.pdf
  report-YYYY-MM-DD.html
  report-YYYY-MM-DD.docx
```

## Requirements

- wkhtmltopdf must be installed for `--pdf` (or when no format flag is given)
- Syft, Trivy, and Gitleaks must be installed (done by `install.sh`)
