---
title: ankercode scan
description: Run one or more scanners and write normalized findings + SBOM to disk.
---

`ankercode scan` runs scanners against a repository and normalizes all results into a single `findings.json` plus a `sbom.cyclonedx.json`. By default all scanners run. Use flags to run only what you need.

## Usage

```bash
ankercode scan [path] [options]
```

`path` defaults to the current directory if omitted.

## Options

| Option | Scanner | What it does |
|---|---|---|
| `--sbom` | Syft | Generates CycloneDX SBOM only |
| `--vulns` | Trivy | CVE vulnerability findings only |
| `--licenses` | Trivy | License inventory only |
| `--secrets` | Gitleaks | Secret / credential detection only |
| `--code` | Semgrep | Code-level deprecation & anti-patterns *(Phase 1)* |
| `--project <name>` | — | Override the project name in findings metadata |

If **none** of the scan flags are given, all available scanners run (equivalent to `ankercode check`).

## Examples

```bash
# Run everything (default)
ankercode scan

# SBOM only
ankercode scan . --sbom

# CVEs only — fast, good for CI on every commit
ankercode scan . --vulns

# Licenses only
ankercode scan . --licenses

# Secrets only — lightest scan, runs in seconds
ankercode scan . --secrets

# Combine flags freely
ankercode scan . --vulns --secrets

# Full scan with a custom project name
ankercode scan /path/to/my-product --project "MyProduct v2.1"
```

## Output

Files are written to `<path>/ankercode/`:

| File | Created when |
|---|---|
| `findings.json` | Always |
| `sbom.cyclonedx.json` | `--sbom` or no flags |
| `audit.jsonl` | Always (appended) |

## Scanner matrix

| Flag | Scanner | Pinned version | Finding types produced |
|---|---|---|---|
| `--sbom` | Syft | 1.46.0 | SBOM reference only |
| `--vulns` | Trivy | 0.72.0 | `vulnerability` |
| `--licenses` | Trivy | 0.72.0 | `license` |
| `--secrets` | Gitleaks | 8.30.1 | `secret` |
| `--code` | Semgrep | Phase 1 | `deprecated` *(coming soon)* |

## CI/CD usage

Modular flags map naturally to separate CI jobs:

```yaml
# Run secrets check on every commit — fast
- run: ankercode scan --secrets

# Run CVE scan nightly
- run: ankercode scan --vulns

# Full scan + report before a release
- run: ankercode check
```

GitLab and GitHub CI templates are planned for Phase 1.

## Finding ID stability

Every finding gets a stable 16-character SHA-256 ID derived from `(type, packageName, packageVersion, ruleId)`. The same finding always gets the same ID across runs — this makes VEX statements in `ankercode.decisions.yaml` durable.
