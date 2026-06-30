---
title: ankercode upgrade
description: Update AnkerCode and optionally all scanner dependencies.
---

`ankercode upgrade` pulls the latest version of AnkerCode from git and rebuilds all packages. With `--scanners` it also updates Syft, Trivy, Gitleaks, and Pandoc.

## Usage

```bash
ankercode upgrade [options]
```

## Options

| Option | Description |
|---|---|
| `--scanners` | Also update all scanner dependencies (Syft, Trivy, Gitleaks, Pandoc) |

## Examples

```bash
# Update AnkerCode only
ankercode upgrade

# Update everything including scanners
ankercode upgrade --scanners
```

## What it does

**Without `--scanners`:**
1. `git pull --ff-only` in the AnkerCode repo
2. `pnpm install` to sync dependencies
3. Rebuilds `@ankercode/core`, `@ankercode/report`, `@ankercode/cli`

**With `--scanners`:**
All of the above, plus re-runs `install.sh --scanners-only` which downloads the latest versions of Syft, Trivy, Gitleaks, and Pandoc.

## Pinning vs. latest

By default `upgrade --scanners` installs the **latest** released version of each scanner. This maintains reproducibility within a scan run (versions are recorded in every report) but means different runs may use different scanner versions after an upgrade.

If you need strict reproducibility across time (e.g., for audit comparison), note the scanner versions from your last report before upgrading.

## After upgrading

Run `ankercode --version` to confirm the new version and `ankercode scan` on a test repo to verify the upgrade worked.
