#!/usr/bin/env bash
# scan.sh — scan and upload AnkerCode fixture repos
#
# Usage:
#   ./scan.sh                          # scan + upload all fixtures
#   ./scan.sh pygoat juice-shop        # only those projects
#   ./scan.sh --no-upload pygoat       # scan only, skip upload
#   ./scan.sh --scan-only              # scan all, skip upload
#
# Environment:
#   ANKERCODE_API_KEY   required for upload (or set via ankercode config)
#   ORG                 override org slug (default: ifya)

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────

CLI="${ANKERCODE_CLI:-/home/alisan/.local/bin/ankercode}"
ORG="${ORG:-ifya}"

# Project name → repo path
declare -A FIXTURES=(
  ["pygoat"]="/home/alisan/projects/AnkerCode/fixtures/pygoat"
  ["nodegoat"]="/home/alisan/projects/AnkerCode/fixtures/nodegoat"
  ["webgoat"]="/home/alisan/projects/AnkerCode/fixtures/webgoat"
  ["juice-shop"]="/home/alisan/projects/AnkerCode/fixtures/juice-shop"
  ["dvna"]="/home/alisan/projects/AnkerCode/fixtures/dvna"
  ["DVWA"]="/home/alisan/projects/fixtures/DVWA"
  ["ajv"]="/home/alisan/projects/fixtures/ajv"
  ["express"]="/home/alisan/projects/fixtures/express"
  ["fastify"]="/home/alisan/projects/fixtures/fastify"
  ["VulnerableApp"]="/home/alisan/projects/fixtures/VulnerableApp"
)

# ── Argument parsing ──────────────────────────────────────────────────────────

DO_UPLOAD=true
TARGETS=()

for arg in "$@"; do
  case "$arg" in
    --no-upload|--scan-only) DO_UPLOAD=false ;;
    --help|-h)
      # Print the top comment block (up to first non-comment line)
      tail -n +2 "$0" | sed -n '/^#/!q; s/^# \?//p'
      exit 0
      ;;
    -*)
      echo "Unknown flag: $arg  (try --help)"
      exit 1
      ;;
    *)
      TARGETS+=("$arg")
      ;;
  esac
done

# Default to all fixtures if none specified
if [ ${#TARGETS[@]} -eq 0 ]; then
  mapfile -t TARGETS < <(printf '%s\n' "${!FIXTURES[@]}" | sort)
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
RESET='\033[0m'

PASS=0
FAIL=0
SKIP=0
RESULTS=()

hr() { printf "${DIM}%s${RESET}\n" "────────────────────────────────────────────────────────────"; }

# ── Main loop ─────────────────────────────────────────────────────────────────

echo ""
echo "AnkerCode fixture runner"
echo "  CLI : $CLI"
echo "  Org : $ORG"
echo "  Upload: $([ "$DO_UPLOAD" = true ] && echo yes || echo no)"
hr

for name in "${TARGETS[@]}"; do
  dir="${FIXTURES[$name]:-}"

  echo ""
  printf "${CYAN}▶  %s${RESET}\n" "$name"

  # ── Validate ──────────────────────────────────────────────────────────────
  if [ -z "$dir" ]; then
    printf "   ${RED}✗${RESET} Unknown fixture '%s'\n" "$name"
    printf "   ${DIM}Known: %s${RESET}\n" "${!FIXTURES[*]}"
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL  $name  (unknown fixture)")
    continue
  fi

  if [ ! -d "$dir" ]; then
    printf "   ${YELLOW}⚠${RESET}  Directory not found, skipping: %s\n" "$dir"
    SKIP=$((SKIP + 1))
    RESULTS+=("SKIP  $name  (directory missing)")
    continue
  fi

  # ── Maven cache warm-up (prevents Trivy 429 from Maven Central) ───────────
  if [ -f "$dir/pom.xml" ] && command -v mvn &>/dev/null; then
    printf "   ${DIM}↳ Maven project detected, resolving dependencies into ~/.m2 cache…${RESET}\n"
    if mvn -f "$dir/pom.xml" dependency:resolve -q --batch-mode 2>/dev/null; then
      printf "   ${DIM}↳ Maven cache warm${RESET}\n"
    else
      printf "   ${YELLOW}⚠${RESET}  mvn dependency:resolve failed (scan will still run — may hit 429)\n"
    fi
  fi

  # ── Scan ──────────────────────────────────────────────────────────────────
  scan_ok=true
  if ! "$CLI" scan "$dir" --project "$name" 2>&1; then
    printf "   ${RED}✗${RESET} Scan failed\n"
    scan_ok=false
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL  $name  (scan failed)")
  fi

  # ── Upload ────────────────────────────────────────────────────────────────
  if [ "$scan_ok" = true ] && [ "$DO_UPLOAD" = true ]; then
    if ! "$CLI" upload --org "$ORG" --project "$name" "$dir" 2>&1; then
      printf "   ${RED}✗${RESET} Upload failed\n"
      FAIL=$((FAIL + 1))
      RESULTS+=("FAIL  $name  (upload failed)")
    else
      PASS=$((PASS + 1))
      RESULTS+=("PASS  $name")
    fi
  elif [ "$scan_ok" = true ]; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS  $name  (scan only)")
  fi
done

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
hr
echo ""
printf "Results:\n"
for r in "${RESULTS[@]}"; do
  case "$r" in
    PASS*)  printf "  ${GREEN}✓${RESET}  %s\n" "${r#PASS  }" ;;
    FAIL*)  printf "  ${RED}✗${RESET}  %s\n"  "${r#FAIL  }" ;;
    SKIP*)  printf "  ${YELLOW}–${RESET}  %s\n" "${r#SKIP  }" ;;
  esac
done

echo ""
printf "  ${GREEN}%d passed${RESET}  " "$PASS"
[ "$FAIL" -gt 0 ] && printf "${RED}%d failed${RESET}  " "$FAIL"
[ "$SKIP" -gt 0 ] && printf "${YELLOW}%d skipped${RESET}  " "$SKIP"
printf "\n\n"

[ "$FAIL" -eq 0 ]
