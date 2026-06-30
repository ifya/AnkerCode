#!/usr/bin/env bash
set -euo pipefail

# ─── colours ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${BLUE}  →${RESET} $*"; }
success() { echo -e "${GREEN}  ✓${RESET} $*"; }
warn()    { echo -e "${YELLOW}  !${RESET} $*"; }
die()     { echo -e "${RED}  ✗${RESET} $*" >&2; exit 1; }

# ─── mode ───────────────────────────────────────────────────────────────────
SCANNERS_ONLY=false
for arg in "$@"; do
  [[ "$arg" == "--scanners-only" ]] && SCANNERS_ONLY=true
done

if [[ "$SCANNERS_ONLY" == true ]]; then
  echo -e "\n${BOLD}AnkerCode — Scanner Update${RESET}"
else
  echo -e "\n${BOLD}AnkerCode — Installer${RESET}"
fi
echo -e "──────────────────────────────────────────\n"

# ─── detect OS ──────────────────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$ARCH" in x86_64) ARCH="amd64" ;; aarch64|arm64) ARCH="arm64" ;; esac

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

# ─── helpers ────────────────────────────────────────────────────────────────
has() { command -v "$1" &>/dev/null; }

latest_github_tag() {
  curl -fsSL "https://api.github.com/repos/$1/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4
}

ensure_path() {
  local shell_rc
  if [[ "$SHELL" == *zsh ]]; then shell_rc="$HOME/.zshrc"
  else shell_rc="$HOME/.bashrc"; fi

  local line='export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm/bin:$PATH"'
  if ! grep -qF "$HOME/.local/bin" "$shell_rc" 2>/dev/null; then
    echo "" >> "$shell_rc"
    echo "# AnkerCode" >> "$shell_rc"
    echo "$line" >> "$shell_rc"
    warn "PATH updated in $shell_rc — run: source $shell_rc"
  fi
  export PATH="$BIN_DIR:$HOME/.local/share/pnpm/bin:$PATH"
}

# ─── node ≥ 18 ──────────────────────────────────────────────────────────────
if ! has node; then
  die "Node.js ≥ 18 is required. Install it from https://nodejs.org and re-run."
fi
NODE_VER=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
[[ "$NODE_VER" -ge 18 ]] || die "Node.js 18+ required (found $NODE_VER). Please upgrade."
success "Node.js $(node --version)"

# ─── pnpm ───────────────────────────────────────────────────────────────────
if ! has pnpm && [[ ! -f "$HOME/.local/share/pnpm/bin/pnpm" ]]; then
  info "Installing pnpm..."
  curl -fsSL https://get.pnpm.io/install.sh | SHELL="$(which bash)" bash - &>/dev/null
fi
export PATH="$HOME/.local/share/pnpm/bin:$PATH"
success "pnpm $(pnpm --version)"

# ─── syft ───────────────────────────────────────────────────────────────────
if ! has syft; then
  info "Installing Syft (SBOM)..."
  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh \
    | sh -s -- -b "$BIN_DIR" &>/dev/null
fi
success "syft $("$BIN_DIR/syft" --version 2>/dev/null | grep -o '[0-9]*\.[0-9]*\.[0-9]*' | head -1)"

# ─── trivy ──────────────────────────────────────────────────────────────────
if ! has trivy; then
  info "Installing Trivy (CVE + license scanner)..."
  curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
    | sh -s -- -b "$BIN_DIR" &>/dev/null
fi
success "trivy $("$BIN_DIR/trivy" --version 2>/dev/null | grep -o '[0-9]*\.[0-9]*\.[0-9]*' | head -1)"

# ─── gitleaks ───────────────────────────────────────────────────────────────
if ! has gitleaks; then
  info "Installing Gitleaks (secret scanner)..."
  TAG=$(latest_github_tag gitleaks/gitleaks)
  VER="${TAG#v}"
  case "$OS" in
    Linux)  FILE="gitleaks_${VER}_linux_x64.tar.gz" ;;
    Darwin) FILE="gitleaks_${VER}_darwin_${ARCH}.tar.gz" ;;
    *) die "Unsupported OS: $OS" ;;
  esac
  curl -sSfL "https://github.com/gitleaks/gitleaks/releases/download/${TAG}/${FILE}" \
    | tar -xz -C "$BIN_DIR" gitleaks
fi
success "gitleaks $("$BIN_DIR/gitleaks" version 2>/dev/null)"

# ─── pandoc ─────────────────────────────────────────────────────────────────
if ! has pandoc; then
  info "Installing Pandoc (report renderer)..."
  TAG=$(latest_github_tag jgm/pandoc)
  VER="${TAG#v}"
  case "$OS" in
    Linux)  FILE="pandoc-${VER}-linux-amd64.tar.gz" ;;
    Darwin) FILE="pandoc-${VER}-arm64-macOS.zip" ;;
    *) die "Unsupported OS: $OS" ;;
  esac
  TMP="$(mktemp -d)"
  curl -sSfL "https://github.com/jgm/pandoc/releases/download/${TAG}/${FILE}" \
    -o "$TMP/pandoc.archive"
  if [[ "$FILE" == *.zip ]]; then
    unzip -q "$TMP/pandoc.archive" -d "$TMP"
  else
    tar -xzf "$TMP/pandoc.archive" -C "$TMP"
  fi
  find "$TMP" -name "pandoc" -type f -exec cp {} "$BIN_DIR/pandoc" \;
  chmod +x "$BIN_DIR/pandoc"
  rm -rf "$TMP"
fi
success "pandoc $("$BIN_DIR/pandoc" --version 2>/dev/null | head -1 | grep -o '[0-9]*\.[0-9]*')"

# ─── wkhtmltopdf ────────────────────────────────────────────────────────────
if ! has wkhtmltopdf; then
  info "Installing wkhtmltopdf (PDF engine)..."
  if [[ "$OS" == "Linux" ]] && has apt-get; then
    sudo apt-get install -y -q wkhtmltopdf 2>/dev/null \
      || warn "Could not install wkhtmltopdf automatically. Run: sudo apt install wkhtmltopdf"
  elif [[ "$OS" == "Darwin" ]] && has brew; then
    brew install --cask wkhtmltopdf &>/dev/null \
      || warn "Could not install wkhtmltopdf. Run: brew install --cask wkhtmltopdf"
  else
    warn "Install wkhtmltopdf manually: https://wkhtmltopdf.org/downloads.html"
  fi
fi
if has wkhtmltopdf; then
  success "wkhtmltopdf $(wkhtmltopdf --version 2>/dev/null | grep -o '[0-9]*\.[0-9]*\.[0-9]*' | head -1)"
fi

# ─── build AnkerCode (skipped in --scanners-only mode) ──────────────────────
if [[ "$SCANNERS_ONLY" == false ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$SCRIPT_DIR"

  info "Installing dependencies..."
  pnpm install --silent

  info "Building packages..."
  pnpm --filter @ankercode/core build --silent 2>/dev/null || pnpm --filter @ankercode/core build
  pnpm --filter @ankercode/report build --silent 2>/dev/null || pnpm --filter @ankercode/report build
  pnpm --filter @ankercode/cli build --silent 2>/dev/null || pnpm --filter @ankercode/cli build

  # ─── link binary ────────────────────────────────────────────────────────────
  ln -sf "$SCRIPT_DIR/packages/cli/dist/index.js" "$BIN_DIR/ankercode"
  chmod +x "$BIN_DIR/ankercode"

  ensure_path

  echo ""
  echo -e "${BOLD}${GREEN}Done.${RESET}"
  echo -e "  Run ${BOLD}ankercode --help${RESET} to get started."
  echo -e "  (You may need to run ${BOLD}source ~/.zshrc${RESET} or open a new terminal first.)\n"
else
  echo ""
  echo -e "${BOLD}${GREEN}Scanners updated.${RESET}\n"
fi
