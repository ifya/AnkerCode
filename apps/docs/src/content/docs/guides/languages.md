---
title: Supported Languages
description: Which programming languages and ecosystems AnkerCode can scan.
---

AnkerCode's scanning is powered by Syft (SBOM) and Trivy (CVE + licenses). Detection is based on **manifest files and lockfiles** — the scanners don't need to compile or execute your code.

## Full support

These ecosystems are detected automatically when a lockfile is present:

| Language | Package Manager | Manifest file |
|---|---|---|
| JavaScript / TypeScript | npm | `package-lock.json` |
| JavaScript / TypeScript | Yarn | `yarn.lock` |
| JavaScript / TypeScript | pnpm | `pnpm-lock.yaml` |
| Python | pip | `requirements.txt` |
| Python | Pipenv | `Pipfile.lock` |
| Python | Poetry | `poetry.lock` |
| Java / Kotlin | Maven | `pom.xml` |
| Java / Kotlin | Gradle | `build.gradle` |
| Go | Go modules | `go.sum`, `go.mod` |
| Rust | Cargo | `Cargo.lock` |
| Ruby | Bundler | `Gemfile.lock` |
| PHP | Composer | `composer.lock` |
| .NET / C# | NuGet | `packages.lock.json`, `.csproj` |
| Swift | Swift PM | `Package.resolved` |
| Dart / Flutter | pub | `pubspec.lock` |
| Scala | Maven / sbt | `pom.xml` |
| Elixir | Mix | `mix.lock` |

## Partial support

These ecosystems are supported but with limitations:

| Language | Condition |
|---|---|
| C / C++ | Only if using **Conan** (`conan.lock`) or **vcpkg** (`vcpkg.json`). Raw CMake/Make projects without a package manager: no dependency detection. |
| Erlang | `rebar.lock` only |

## Not supported

These are relevant gaps for the Mittelstand target market:

| Gap | Notes |
|---|---|
| C / C++ without a package manager | Embedded, Maschinenbau, and automotive codebases frequently vendor dependencies as source. No lockfile = no SBOM coverage. |
| AUTOSAR / Classic MISRA C | Automotive embedded — no OSS scanner covers this space. |
| PLC / IEC 61131 | Industrial control (Siemens, Beckhoff) — completely out of scope for all current scanners. |

## What this means for your project

If your product has a **web backend or cloud component** in any of the fully supported languages: full CVE, license, and SBOM coverage.

If your product includes **embedded firmware in bare-metal C**: the firmware layer will not appear in the SBOM. This is an honest limitation to discuss upfront during a readiness check — not a surprise in the report.

A combined product (e.g. Node.js backend + embedded C firmware) gets full coverage for the software layer and partial coverage for the firmware. AnkerCode will clearly reflect what was scanned and what was not in Section 7 (Methodik) of the report.
