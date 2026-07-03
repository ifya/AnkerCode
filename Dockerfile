# ── Stage 1: Build CLI ────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable

WORKDIR /app

# Layer manifests separately so package installs are cached on code-only changes
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/core/package.json    packages/core/
COPY packages/report/package.json  packages/report/
COPY packages/cli/package.json     packages/cli/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/core    packages/core
COPY packages/report  packages/report
COPY packages/cli     packages/cli

RUN pnpm --filter @ankercode/core   build && \
    pnpm --filter @ankercode/report build && \
    pnpm --filter @ankercode/cli    build

# pnpm deploy creates a clean /deploy with only production runtime deps
# (no devDeps, no TypeScript, no tsup — just dist/ + node_modules)
RUN pnpm deploy --filter @ankercode/cli --prod --legacy /deploy


# ── Stage 2: Download scanner binaries ───────────────────────────────────────
# Separate from the runtime stage so curl never lands in the final image.
# Rebuild this layer only when ARG versions change.
FROM alpine AS scanner-dl

RUN apk add --no-cache curl ca-certificates

ARG SYFT_VERSION=1.46.0
ARG TRIVY_VERSION=0.72.0
ARG GITLEAKS_VERSION=8.30.1
ARG TARGETARCH=amd64

RUN curl -sSfL \
      "https://github.com/anchore/syft/releases/download/v${SYFT_VERSION}/syft_${SYFT_VERSION}_linux_${TARGETARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin syft && \
    chmod +x /usr/local/bin/syft

RUN TRIVY_ARCH="$([ "$TARGETARCH" = "arm64" ] && echo ARM64 || echo 64bit)" && \
    curl -sSfL \
      "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${TRIVY_ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin trivy && \
    chmod +x /usr/local/bin/trivy

RUN GL_ARCH="$([ "$TARGETARCH" = "arm64" ] && echo arm64 || echo x64)" && \
    curl -sSfL \
      "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GL_ARCH}.tar.gz" \
      | tar -xz -C /usr/local/bin gitleaks && \
    chmod +x /usr/local/bin/gitleaks


# ── Stage 3: Runtime ─────────────────────────────────────────────────────────
# curl is NOT here — only the binaries copied from scanner-dl.
# git is needed at runtime: ankercode reads commit SHA + branch from the target repo.
FROM node:22-alpine AS runtime

RUN apk add --no-cache git ca-certificates pandoc

# Scanner binaries only — no curl, no build tools
COPY --from=scanner-dl /usr/local/bin/syft     /usr/local/bin/syft
COPY --from=scanner-dl /usr/local/bin/trivy    /usr/local/bin/trivy
COPY --from=scanner-dl /usr/local/bin/gitleaks /usr/local/bin/gitleaks

# CLI (self-contained: dist/ + commander + @ankercode/core + @ankercode/report)
COPY --from=builder /deploy /app

# Strip the shebang from the bundle — Node's ESM loader only recognises it on
# line 1, but esbuild may inject a legal comment before the banner, pushing
# the shebang to line 2 and causing a SyntaxError. We invoke via `node`
# explicitly so the shebang serves no purpose here.
RUN sed -i '/^#!/d' /app/dist/index.js && \
    ln -s /app/dist/index.js /usr/local/bin/ankercode && \
    chmod +x /app/dist/index.js

# CI convention: mount the repo here
# docker run --rm -v $(pwd):/scan ghcr.io/ifya/ankercode scan /scan
WORKDIR /scan

ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["--help"]
