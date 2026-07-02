---
title: Introduction
description: What AnkerCode is, what it does, and what it deliberately doesn't do.
---

AnkerCode is a **local-first CRA/BSI compliance evidence layer** for German software teams. It runs existing open-source scanners on your machine, normalizes the results into an open-format evidence model, and produces audit-ready German-language compliance reports.

**Source code never leaves your machine by default.** Only normalized findings, SBOMs, hashes, and package metadata may leave — and only when you explicitly opt in. Trivy runs with `--offline-scan`, which prevents it from sending package names or coordinates to Maven Central, PyPI, npm, or any external registry during a scan.

---

## What problem it solves

The EU Cyber Resilience Act (CRA) requires manufacturers of products with digital elements to maintain a Software Bill of Materials, handle vulnerabilities systematically, and be able to file a 24-hour incident report from September 2026. Full applicability begins December 2027.

Most companies in German Mittelstand — Maschinenbau, IoT, Industrie 4.0, MedTech — don't have a dedicated security team. They have a CTO, a dev team, and a growing pile of compliance questions from customers and auditors.

AnkerCode gives them two commands to go from "I have a repository" to "I have a PDF I can show my auditor."

---

## What it is not

AnkerCode is **not a scanner**. It wraps [Syft](https://github.com/anchore/syft), [Trivy](https://github.com/aquasecurity/trivy), [Gitleaks](https://github.com/gitleaks/gitleaks), and (from Phase 1) [Semgrep](https://github.com/semgrep/semgrep) for code-level deprecation analysis. Its value is normalization, prioritization, and evidence packaging, not CVE detection.

AnkerCode is **not a compliance certificate**. It produces inputs for your compliance process. A human is responsible for reviewing and signing the evidence.

AnkerCode is **not a SaaS platform** (yet). Phase 0 is a CLI that runs on your machine. A dashboard is planned for Phase 1 once design partners need cross-run history.

---

## The two core commands

```bash
# 1. Scan + generate all reports in one step
ankercode check /path/to/your/project

# 2. Or run them separately
ankercode scan /path/to/your/project
ankercode report /path/to/your/project --pdf
```

The result: a `ankercode/` folder inside your project containing `findings.json`, `sbom.cyclonedx.json`, and a dated PDF report in German.

---

## Language and compliance framing

AnkerCode uses precise language around compliance. You will never see the phrase "Mit AnkerCode sind Sie CRA-konform." The approved framing:

- **CRA Readiness** — not "CRA compliance"
- **Evidence Pack** — the collection of artifacts produced
- **SBOM Quality Check** — evaluation of your Software Bill of Materials
- **Vulnerability-Handling-Nachweis** — documented evidence of your vulnerability handling process
- **Technische Unterstützung für Compliance-Prozesse** — technical support for compliance processes

A tool produces inputs. A human decides and signs.
