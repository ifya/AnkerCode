<div align="center">
  <img src="assets/logo.png" alt="AnkerCode" width="140" />

  <h1>AnkerCode</h1>

  <p><strong>Ruhe vor dem Audit.</strong></p>

  <p>
    Local-first CRA &amp; BSI compliance evidence for German software teams.<br/>
    Two commands. One PDF. Zero data leaves your machine.
  </p>

  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-1e3a5f?style=flat-square" alt="version" />
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js&logoColor=white" alt="node" />
    <img src="https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square" alt="license" />
    <img src="https://img.shields.io/badge/local--first-no%20upload%20by%20default-1e3a5f?style=flat-square" alt="local-first" />
  </p>

  <p>
    <a href="https://docs.ankercode.io"><strong>📖 docs.ankercode.io</strong></a>
  </p>
</div>

---

## What it does

AnkerCode runs battle-tested open-source scanners on your repository, normalizes the results into a structured evidence model, and produces an **audit-ready German-language compliance report** — all without your source code ever leaving the machine.

```
ankercode scan   →  SBOM (CycloneDX) + findings.json
ankercode report →  German PDF  /  HTML  /  DOCX
```

Built for **German Mittelstand** software teams — Maschinenbau, IoT/Industrie 4.0, MedTech — who need to demonstrate CRA Readiness and BSI TR-03183 alignment without standing up a platform or hiring a dedicated security team.

---

## Why AnkerCode

| Without AnkerCode | With AnkerCode |
|---|---|
| Manual CVE tracking in spreadsheets | Automated scan with every release |
| No SBOM → blocked at customer audit | CycloneDX SBOM generated in seconds |
| Legal asks "what's in your product?" → panic | Evidence pack ready to hand over |
| Expensive consultant for every report | €0 per report after setup |
| Code sent to cloud scanners | Source stays on your machine, always |

> **CRA Article 14** reporting obligations apply from **11 September 2026**. You cannot file a credible 24h vulnerability report if you don't know what's in your product. AnkerCode builds that knowledge continuously.

---

## Quick Start

**Requirements:** Node.js ≥ 18, Git

```zsh
git clone https://github.com/ifyagaming/ankercode.git
cd ankercode
./install.sh
```

The installer handles everything — Syft, Trivy, Gitleaks, Pandoc, wkhtmltopdf, and the CLI itself. Supports Linux and macOS.

**Then scan your project:**

```zsh
# 1. Scan
ankercode scan /path/to/your/project --project my-product

# 2. (Optional) Triage — mark false positives, accept risks
ankercode init /path/to/your/project
# → edit ankercode.decisions.yaml

# 3. Generate the report
ankercode report /path/to/your/project --pdf --html --docx
```

Open `ankercode/report-YYYY-MM-DD.pdf`. Done.

**Staying up to date:**

```zsh
ankercode upgrade               # pull latest AnkerCode + rebuild
ankercode upgrade --scanners    # also update Syft, Trivy, Gitleaks, Pandoc
```

---

## Report Sections

Every generated report contains:

| # | Section | Content |
|---|---|---|
| 1 | **Zusammenfassung** | KPIs — total findings, critical/high CVEs open, secrets, accepted risks |
| 2 | **SBOM-Zusammenfassung** | CycloneDX reference, SHA-256 hash, component count |
| 3 | **Top-5 Priorisierte Risiken** | Highest-severity open vulnerabilities with remediation guidance |
| 4 | **Lizenz-Risiko** | All detected licenses grouped by SPDX identifier |
| 5 | **Vulnerability-Handling-Nachweis** | VEX statements — your signed decisions per CVE |
| 6 | **Akzeptierte Risiken** | Risk acceptances with author, reason, expiry |
| 7 | **Methodik & Scanner-Versionen** | Pinned scanner versions for reproducibility + disclaimer |

---

## Under the Hood

AnkerCode wraps — never reimplements — the best open-source scanners:

| Scanner | Purpose | Output |
|---|---|---|
| [Syft](https://github.com/anchore/syft) | SBOM generation | CycloneDX JSON |
| [Trivy](https://github.com/aquasecurity/trivy) | CVE detection + license scanning | Findings |
| [Gitleaks](https://github.com/gitleaks/gitleaks) | Secret detection | Findings |
| [Pandoc](https://pandoc.org) + wkhtmltopdf | Report rendering | PDF / HTML / DOCX |

The normalized **evidence data model** (`@ankercode/core`) is the durable asset — open formats throughout: [CycloneDX](https://cyclonedx.org), [OpenVEX](https://openvex.dev), [SARIF](https://sarifweb.azurewebsites.net).

---

## Decisions & Triage

AnkerCode separates *scanning* from *human judgment*. After a scan, create a `ankercode.decisions.yaml` at your project root:

```yaml
vex:
  - findingId: "8517dab0c1fdf5b1"
    status: not_affected
    justification: vulnerable_code_not_in_execute_path
    statement: "This package only runs on macOS build agents, never in production."
    author: "Jane Doe"
    timestamp: "2026-06-30T12:00:00Z"

riskAcceptances:
  - findingId: "f66b579fb1bcc03a"
    reason: "Build-time only dependency, not present in production runtime."
    acceptedBy: "Jane Doe"
    expiresAt: "2026-12-31"
```

Commit this file. It makes every report **reproducible** from source — same repo + same scanner versions + same decisions = identical evidence pack.

---

## Monorepo Structure

```
ankercode/
  packages/
    core/     @ankercode/core   — evidence data model (Zod schemas, types, hashing)
    cli/      @ankercode/cli    — ankercode scan | report | init
    report/   @ankercode/report — German template engine + Pandoc rendering
  assets/                       — logo and static assets
```

---

## Local-First Guarantees

- **Source code never leaves your machine.** Only normalized findings metadata, SBOMs, and hashes are involved — and only locally.
- **No telemetry.** No analytics, no phone-home, no beacons.
- **Deterministic evidence.** Pinned scanner versions ensure the same inputs always produce the same outputs.
- **Air-gap ready.** No network calls during scan or report generation.

---

## Regulatory Context

AnkerCode produces *technical inputs* to compliance processes. It does not certify or assert CRA conformity — a qualified human reviews and signs the evidence.

| Regulation | Relevance |
|---|---|
| CRA (EU) 2024/2847 | In force 10 Dec 2024. Full applicability 11 Dec 2027. |
| CRA Article 14 | Incident reporting obligations from **11 Sep 2026** |
| BSI TR-03183 | SBOM requirements — CycloneDX and SPDX referenced |

---

## Roadmap

- [x] Phase 0 — CLI + scanner adapters + German PDF report
- [ ] Phase 1 — Code-level analysis (Semgrep: deprecated APIs, security anti-patterns, file + line + fix) + history dashboard (Next.js + Supabase) + VS Code extension
- [ ] Phase 2 — Policy engine + on-prem Docker package + audit trail

> Phase 1 starts when the first design partners need history across runs.

---

## License

AGPL-3.0-only © [Ifya](https://github.com/ifya)

Free to use, study, and modify. If you run AnkerCode as a network service (SaaS, hosted tool, API), you must release your modifications under the same license. Commercial use without open sourcing requires a separate agreement.

---

<div align="center">
  <sub>Built for teams who need <em>Ruhe vor dem Audit</em>.</sub>
</div>
