---
title: CRA & BSI Overview
description: Key dates, obligations, and how AnkerCode supports your compliance process.
---

:::caution[Not legal advice]
This page provides factual context for software teams. It is not legal advice. Your compliance assessment must be done by a qualified person. AnkerCode produces evidence inputs — a human reviews and signs.
:::

## Key dates

| Date | Event |
|---|---|
| **10 December 2024** | CRA (Regulation EU 2024/2847) entered into force |
| **11 September 2026** | Article 14 reporting obligations apply |
| **11 December 2027** | Full applicability (essential requirements, technical documentation, CE marking) |

## Article 14: Incident and vulnerability reporting (from September 2026)

From September 2026, manufacturers of products with digital elements must report to their national CSIRT (in Germany: **BSI / CERT-Bund**) via ENISA's Single Reporting Platform:

- **24 hours** — early warning for actively exploited vulnerabilities and severe incidents
- **72 hours** — full notification report
- **Final report** — within 14 days

**The key insight:** you cannot file a credible 24-hour report if you don't know what's in your product. The SBOM and vulnerability-handling process that AnkerCode helps you build is what makes that report possible.

## Who is in scope

CRA applies to **manufacturers of products with digital elements** — hardware or software products placed on the EU market with a digital component. Examples:

- IoT devices (smart home, industrial sensors)
- Industrial control systems
- Connected Maschinenbau products
- Embedded software in medical devices
- On-premise software sold to business customers

**Standalone SaaS is currently out of scope** per the Commission's 2026 draft guidance. Only SaaS that functions as a "remote data processing solution" integral to a product is in scope.

## BSI TR-03183

BSI Technical Guideline TR-03183 covers SBOM requirements and references **CycloneDX** and **SPDX** as accepted formats. AnkerCode generates CycloneDX SBOMs via Syft.

## What AnkerCode produces and what it doesn't

| AnkerCode produces | What an auditor needs |
|---|---|
| CycloneDX SBOM (what's in your product) | ✓ |
| CVE inventory with severity (what vulnerabilities exist) | ✓ |
| License inventory | ✓ |
| VEX statements (documented analysis per CVE) | ✓ (you write them, tool structures them) |
| Risk acceptances with expiry + responsible person | ✓ |
| Audit log of all scan runs | ✓ |
| Conformity declaration | ✗ — a human signs this |
| CE marking | ✗ — requires conformity assessment |
| Legal compliance guarantee | ✗ — a lawyer provides this |

## Approved language

AnkerCode and all reports use precise language. Never:
- ~~"CRA-konform"~~
- ~~"compliant with the Cyber Resilience Act"~~

Always:
- **CRA Readiness** — preparedness for CRA obligations
- **Evidence Pack** — the collection of artifacts
- **SBOM Quality Check** — SBOM evaluation
- **Vulnerability-Handling-Nachweis** — documented vulnerability handling evidence
- **Technische Unterstützung für Compliance-Prozesse** — technical support for compliance processes

## The positioning bridge

> "You cannot file a credible 24h report if you don't know what's in your product."

The September 2026 deadline is operational reporting. The December 2027 deadline requires full technical documentation. AnkerCode's evidence — SBOM, component transparency, vulnerability handling records — is what makes a credible report *possible* and what the December 2027 obligations require.
