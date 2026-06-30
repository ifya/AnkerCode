export const reportCss = `
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a2e;
  --color-muted: #6b7280;
  --color-border: #e5e7eb;
  --color-accent: #1e3a5f;
  --color-critical: #dc2626;
  --color-high: #ea580c;
  --color-medium: #d97706;
  --color-low: #2563eb;
  --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg);
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem 2.5rem;
}

/* Cover */
header.title-block {
  border-bottom: 3px solid var(--color-accent);
  margin-bottom: 2.5rem;
  padding-bottom: 1.5rem;
}
header.title-block p.title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-accent);
  margin: 0 0 0.25rem;
}
header.title-block p.subtitle,
header.title-block p.author,
header.title-block p.date {
  font-size: 0.95rem;
  color: var(--color-muted);
  margin: 0.1rem 0;
}

/* Headings */
h1 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.35rem;
  margin-top: 2.5rem;
}
h2 {
  font-size: 1rem;
  font-weight: 600;
  margin-top: 1.75rem;
  color: var(--color-text);
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  margin: 1rem 0;
}
th {
  background: var(--color-accent);
  color: #fff;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-weight: 600;
}
td {
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}
tr:nth-child(even) td { background: #f9fafb; }

/* Code / mono */
code {
  font-family: var(--font-mono);
  font-size: 0.82em;
  background: #f3f4f6;
  padding: 0.1em 0.35em;
  border-radius: 3px;
}

/* Blockquote — used for the disclaimer */
blockquote {
  border-left: 4px solid var(--color-accent);
  margin: 1.5rem 0;
  padding: 0.75rem 1rem;
  background: #f0f4f8;
  color: var(--color-muted);
  font-size: 0.875rem;
}
blockquote p { margin: 0; }

/* Print */
@media print {
  body { max-width: 100%; padding: 1cm 1.5cm; font-size: 11pt; }
  h1 { page-break-after: avoid; }
  h2 { page-break-after: avoid; }
  table { page-break-inside: avoid; }
  blockquote { page-break-inside: avoid; }
}
`;
