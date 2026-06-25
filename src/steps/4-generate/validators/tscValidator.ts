// =============================================================================
// Step 4 (Phase 4b): tsc validator for generated components
// =============================================================================
// Type-checks a generated TSX component against the REAL Chakra v3 types
// (@chakra-ui/react@3.27.1, matching the crawled docs). The Chakra type
// definitions ARE the canonical v3 spec — including the universal style-prop
// system — so tsc authoritatively catches hallucinated components/props and
// wrong value types without the false positives a props-table check would hit.
//
// It writes the component to gen-sandbox/generated.tsx and runs the sandbox
// tsconfig. Note: tsc proves TYPE validity, not semantic completeness (an
// incomplete-but-type-valid Checkbox.Root still passes) — query satisfaction is
// graded separately by the LLM judge.
// =============================================================================

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const SANDBOX_DIR = path.join(process.cwd(), 'gen-sandbox');
const GEN_FILE = path.join(SANDBOX_DIR, 'generated.tsx');
const TSCONFIG = path.join(SANDBOX_DIR, 'tsconfig.json');

export interface TscResult {
  /** true when tsc reported zero errors. */
  ok: boolean;
  errorCount: number;
  /** Raw `error TS####` diagnostic lines (file-relative). */
  diagnostics: string[];
}

const ERROR_LINE = /error TS\d+/;

/**
 * Type-check a generated component. Always resolves (never throws): a tsc
 * failure is data, not an exception.
 */
export function tscValidate(componentCode: string): Promise<TscResult> {
  fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  fs.writeFileSync(GEN_FILE, componentCode, 'utf8');

  return new Promise((resolve) => {
    execFile(
      'npx',
      ['tsc', '-p', TSCONFIG, '--pretty', 'false'],
      { cwd: process.cwd(), shell: true, maxBuffer: 10 * 1024 * 1024 },
      (_err, stdout, stderr) => {
        const out = `${stdout || ''}${stderr || ''}`;
        const diagnostics = out
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => ERROR_LINE.test(l));
        resolve({ ok: diagnostics.length === 0, errorCount: diagnostics.length, diagnostics });
      }
    );
  });
}
