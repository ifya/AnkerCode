// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ankercode.io',
  integrations: [
    starlight({
      title: 'AnkerCode',
      description: 'Local-first CRA & BSI compliance evidence for German software teams.',
      logo: {
        src: './src/assets/logo.png',
        alt: 'AnkerCode',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ifya/AnkerCode' },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'introduction' },
            { label: 'Installation', slug: 'installation' },
            { label: 'Quick Start', slug: 'quick-start' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'ankercode check', slug: 'cli/check' },
            { label: 'ankercode scan', slug: 'cli/scan' },
            { label: 'ankercode report', slug: 'cli/report' },
            { label: 'ankercode init', slug: 'cli/init' },
            { label: 'ankercode upgrade', slug: 'cli/upgrade' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Triage & Decisions', slug: 'guides/decisions' },
            { label: 'Supported Languages', slug: 'guides/languages' },
            { label: 'Report Structure', slug: 'guides/report-structure' },
          ],
        },
        {
          label: 'Compliance Context',
          items: [
            { label: 'CRA & BSI Overview', slug: 'compliance/cra-bsi' },
            { label: 'Evidence Model', slug: 'compliance/evidence-model' },
          ],
        },
      ],
    }),
  ],
});
