---
title: ankercode report
description: Generate a German-language Evidence Report from existing findings.
---

`ankercode report` takes `findings.json` and `ankercode.decisions.yaml` from a previous scan and renders them into a German-language Evidence Report.

## Usage

```bash
ankercode report [path] [options]
```

`path` defaults to the current directory if omitted. It must contain an `ankercode/findings.json` file (created by `ankercode scan`).

## Options

| Option | Description |
|---|---|
| `--pdf` | Generate PDF (requires wkhtmltopdf) |
| `--html` | Generate standalone HTML |
| `--docx` | Generate Word document |
| `--output <file>` | Override output file path (single format only) |

If none of `--pdf`, `--html`, `--docx` are given, all three formats are generated.

## Examples

```bash
# Generate all formats
ankercode report

# PDF only
ankercode report . --pdf

# HTML only with custom output path
ankercode report . --html --output /tmp/my-report.html
```

## Report pipeline

Internally the report engine:
1. Loads `findings.json` (from `ankercode scan`)
2. Loads `ankercode.decisions.yaml` (VEX statements + risk acceptances)
3. Renders a German Markdown document using the template engine
4. Passes Markdown → Pandoc → wkhtmltopdf (PDF), Pandoc (HTML/DOCX)

## Output filenames

Reports are written to `<path>/ankercode/` with the current date:

```
ankercode/report-2026-06-30.pdf
ankercode/report-2026-06-30.html
ankercode/report-2026-06-30.docx
```

## Reproducibility

Re-running `ankercode report` on the same `findings.json` + `ankercode.decisions.yaml` always produces the same output. The scanner versions used in the original scan are embedded in the report under **Section 7: Methodik**.
