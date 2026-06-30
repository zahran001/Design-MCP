// =============================================================================
// Step 4 (hardening Item 2): headless RENDER validator for generated components
// =============================================================================
// The runtime-correctness oracle tsc can't be. `tsc` proves a component is
// TYPE-valid; it says nothing about whether the component actually MOUNTS and
// produces DOM. A component can be tsc-ok + smell-free + composition-complete and
// still throw on render (bad hook usage, a required context missing, a runtime
// prop constraint). This validator catches exactly that gap.
//
// Mechanism (esbuild + Playwright, both already in the toolchain):
//   1. Wrap the component's default export in a Chakra v3 provider + error
//      boundary harness  (ChakraProvider value={defaultSystem} — verified against
//      the pinned @chakra-ui/react@3.27.1, NOT emitted from memory).
//   2. Bundle harness + component (imports resolve to the repo's real
//      @chakra-ui/react + react) into one browser IIFE with esbuild.
//   3. Mount it in a real Chromium page and assert: no uncaught error, no
//      console.error on mount, and the root produced non-empty DOM.
//
// A real browser (not jsdom) because Chakra v3 leans on ResizeObserver /
// matchMedia / portals that jsdom lacks — complex components (ColorPicker,
// Dialog) would false-fail under jsdom.
//
// Like tscValidator, this ALWAYS resolves — a render failure is data, not an
// exception. Expect render-pass rate <= tsc-pass rate; that gap is the find.
// =============================================================================

import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import { chromium, type Browser } from 'playwright';

const RENDER_DIR = path.join(process.cwd(), 'gen-sandbox', 'render');
const COMPONENT_FILE = path.join(RENDER_DIR, 'Component.tsx');
const ENTRY_FILE = path.join(RENDER_DIR, 'index.tsx');

export interface RenderResult {
  /** true when the component mounted with no error and produced non-empty DOM. */
  ok: boolean;
  /** Human-readable failure reason (bundle error, thrown error, or blank render). */
  error?: string;
}

// The generated component's EXPORT shape varies run to run — default export,
// named export, or NONE (DeepSeek often emits a bare `const Demo = ...` with no
// export). A missing export is a generation style choice, NOT a render failure, so
// resolve the entry import accordingly. Mirrors web/src/lib/sandbox.ts so the eval
// render-check and the UI's Sandpack preview agree on what "renders" means.
function resolveEntry(code: string): { code: string; importLine: string } {
  // Case A — already a default export.
  if (/\bexport\s+default\b/.test(code)) {
    return { code, importLine: "import Component from './Component';" };
  }
  // Case B — a named export of a PascalCase binding.
  const namedExport =
    code.match(/\bexport\s+(?:function|const|class)\s+([A-Z]\w*)/)?.[1] ??
    code.match(/\bexport\s*\{\s*([A-Z]\w*)/)?.[1];
  if (namedExport) {
    return { code, importLine: `import { ${namedExport} as Component } from './Component';` };
  }
  // Case C — no export: default-export the last top-level PascalCase declaration
  // (the main component is conventionally defined after any helpers).
  const decls = [...code.matchAll(/\b(?:function|const)\s+([A-Z]\w*)/g)].map((m) => m[1]);
  const name = decls[decls.length - 1];
  if (name) {
    return {
      code: `${code}\n\nexport default ${name};\n`,
      importLine: "import Component from './Component';",
    };
  }
  // Nothing we can identify — let the bundle/mount surface the failure honestly.
  return { code, importLine: "import Component from './Component';" };
}

// Mount harness. An error boundary turns a render throw into a recorded flag
// (deterministic) rather than only an async window error; we ALSO listen for
// pageerror / console.error in Playwright as a backstop. Built with NODE_ENV
// "production" so React's dev-only console warnings don't masquerade as errors.
function entrySource(importLine: string): string {
  return `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
${importLine}

class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) {
    window.__renderError = String((error && error.stack) || error);
  }
  render() {
    if (this.state.error) return null;
    return this.props.children;
  }
}

try {
  const root = createRoot(document.getElementById('root'));
  root.render(
    React.createElement(ChakraProvider, { value: defaultSystem },
      React.createElement(Boundary, null, React.createElement(Component)))
  );
} catch (e) {
  window.__renderError = String((e && e.stack) || e);
}
`;
}

/**
 * Render validator with a reusable browser. Launch once, validate many, close
 * once — a Chromium launch (~300ms) per component would dominate an A/B run, so
 * the eval harnesses should hold a single instance. `gen-sandbox/render/` temp
 * files are reused (single-threaded), so do NOT run two instances concurrently.
 */
export class RenderValidator {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch();
    }
    return this.browser;
  }

  /** Mount the component headless. Always resolves; a failure is data. */
  async validate(componentCode: string): Promise<RenderResult> {
    // 1. Bundle. esbuild resolves @chakra-ui/react / react from the entry file's
    //    location, so the temp files must live inside the repo tree.
    let bundled: string;
    try {
      const { code, importLine } = resolveEntry(componentCode);
      fs.mkdirSync(RENDER_DIR, { recursive: true });
      fs.writeFileSync(COMPONENT_FILE, code, 'utf8');
      fs.writeFileSync(ENTRY_FILE, entrySource(importLine), 'utf8');
      const result = await esbuild.build({
        entryPoints: [ENTRY_FILE],
        bundle: true,
        write: false,
        format: 'iife',
        platform: 'browser',
        jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        logLevel: 'silent',
      });
      bundled = result.outputFiles[0].text;
    } catch (e) {
      // A bundle failure (e.g. importing a symbol that doesn't exist) is a real
      // render-blocking defect, not an infrastructure error — report it as such.
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `bundle failed: ${msg.split('\n')[0]}` };
    }

    // 2. Mount in a real browser and collect runtime signals.
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => pageErrors.push(e.message || String(e)));

    try {
      await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>');
      await page.addScriptTag({ content: bundled });
      // Let mount effects flush.
      await page.waitForTimeout(150);

      const boundaryError = (await page.evaluate(
        () => (window as unknown as { __renderError?: string }).__renderError ?? null
      )) as string | null;
      const rootHtml = await page.evaluate(
        () => document.getElementById('root')?.innerHTML ?? ''
      );

      const firstError =
        boundaryError ??
        pageErrors[0] ??
        consoleErrors[0] ??
        (rootHtml.trim() === '' ? 'rendered empty DOM (root has no content)' : undefined);

      return firstError ? { ok: false, error: firstError } : { ok: true };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * One-shot convenience mirroring `tscValidate(code)` — launches a browser,
 * validates once, closes. For batch use (the A/B harness) instantiate
 * `RenderValidator` directly and reuse it across components.
 */
export async function renderValidate(componentCode: string): Promise<RenderResult> {
  const validator = new RenderValidator();
  try {
    return await validator.validate(componentCode);
  } finally {
    await validator.close();
  }
}
