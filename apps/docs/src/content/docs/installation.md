---
title: Installation
description: Install AnkerCode and all scanner dependencies with a single command.
---

import { Tabs, TabItem } from '@astrojs/starlight/components';

AnkerCode ships a single installer that handles everything: the CLI, all scanner dependencies (Syft, Trivy, Gitleaks, Pandoc), and the global `ankercode` symlink.

## Requirements

- **Linux** (x86_64 or arm64) or **macOS**
- **Node.js v22+** — install via [nvm](https://github.com/nvm-sh/nvm) if needed
- **pnpm** — installed automatically if missing
- `curl`, `tar`, `unzip` — standard on most systems
- **wkhtmltopdf** — for PDF generation (see below)

## One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/ankercode/main/install.sh | bash
```

Or clone first and run locally:

```bash
git clone https://github.com/your-org/ankercode.git ~/ankercode
cd ~/ankercode
bash install.sh
```

The installer:
1. Detects your OS and architecture
2. Downloads and installs **Syft** (SBOM), **Trivy** (CVE + licenses), **Gitleaks** (secrets), **Pandoc** (report rendering) to `~/.local/bin`
3. Installs Node dependencies via pnpm
4. Builds all packages
5. Creates a symlink `~/.local/bin/ankercode → packages/cli/dist/index.js`

## wkhtmltopdf (PDF support)

wkhtmltopdf is required for PDF output. Install it separately:

<Tabs>
  <TabItem label="Debian / Ubuntu">
    ```bash
    sudo apt-get install -y wkhtmltopdf
    ```
  </TabItem>
  <TabItem label="Arch Linux">
    ```bash
    sudo pacman -S wkhtmltopdf
    ```
  </TabItem>
  <TabItem label="macOS">
    ```bash
    brew install wkhtmltopdf
    ```
  </TabItem>
</Tabs>

## Verify installation

```bash
ankercode --version
# AnkerCode v0.1.0

ankercode --help
```

## Keep everything in PATH

The installer places binaries in `~/.local/bin`. Make sure it's in your PATH:

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$HOME/.local/bin:$PATH"
```

## Updating

```bash
ankercode upgrade            # update AnkerCode only
ankercode upgrade --scanners # also update Syft, Trivy, Gitleaks, Pandoc
```
