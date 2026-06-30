---
title: Triage & Decisions
description: How to document VEX statements and risk acceptances in ankercode.decisions.yaml.
---

`ankercode.decisions.yaml` is where you document what you decided to do about each finding. It lives in your project root, gets committed to git, and is what makes your reports reproducible and auditable.

## Creating the file

```bash
ankercode init /path/to/your/project
```

This creates a commented template. You can also create it manually — it just needs `vex:` and `riskAcceptances:` keys.

## Two types of decisions

### VEX Statements

A VEX (Vulnerability Exploitability eXchange) statement documents **whether a CVE actually affects your deployment**. This is the most important thing an auditor wants to see — it shows you analyzed the finding, not just ignored it.

```yaml
vex:
  - findingId: "abc123def456abcd"
    status: not_affected
    justification: vulnerable_code_not_in_execute_path
    statement: "Die betroffene Funktion foo() wird in unserem Deployment nicht aufgerufen."
    author: "Max Mustermann"
    timestamp: "2026-06-30T10:00:00.000Z"
```

**`status` values** (OpenVEX):

| Status | Meaning |
|---|---|
| `not_affected` | CVE does not affect your deployment |
| `affected` | CVE affects you and you're working on it |
| `fixed` | You've fixed it (update, patch, workaround) |
| `under_investigation` | Still analyzing |

**`justification` values** (when `status: not_affected`):

| Justification | When to use |
|---|---|
| `component_not_present` | The vulnerable component isn't actually included |
| `vulnerable_code_not_present` | The vulnerable code path doesn't exist in this version |
| `vulnerable_code_not_in_execute_path` | The code exists but is never called in your deployment |
| `vulnerable_code_cannot_be_controlled_by_adversary` | The input that triggers the vulnerability can't be reached externally |
| `inline_mitigations_already_exist` | You have a WAF rule, network control, or other mitigation in place |

### Risk Acceptances

A risk acceptance documents that you know about a finding and have consciously decided to accept the risk — at least until a given date.

```yaml
riskAcceptances:
  - findingId: "def456abc789def0"
    reason: "Paket wird nur in der CI-Pipeline verwendet, nicht im produktiven System deployed."
    acceptedBy: "Max Mustermann"
    expiresAt: "2027-01-01"
```

`expiresAt` is optional. Without it, the acceptance is recorded as unbegrenzt (unlimited) in the report.

## Finding the right findingId

Finding IDs appear in `ankercode/findings.json` under the `id` field. They also appear in the HTML report. Copy the full 16-character hex ID.

```json
{
  "id": "abc123def456abcd",
  "type": "vulnerability",
  "cveId": "CVE-2024-12345",
  ...
}
```

## How decisions affect the report

- **VEX `not_affected`**: Finding is removed from the open CVE list in Section 3. It appears instead in Section 5 (Vulnerability-Handling-Nachweis) with your justification.
- **Risk acceptance**: Finding is removed from the open list. It appears in Section 6 (Akzeptierte Risiken) with your reason and expiry.
- **Everything else**: Finding stays in Section 3.

## Committing

Always commit `ankercode.decisions.yaml`. It is the evidence that makes your compliance story auditable. Without it, the report is just a list of findings with no documented response.
