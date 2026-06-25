// =============================================================================
// Smell-guided repair hints (Pass D / 5.3b — the compiler-ergonomics fix)
// =============================================================================
// Pass C proved compiler-feedback self-correction fails because TypeScript's
// JSX-prop error is COARSE: a wrong attribute yields one aggregate
// `TS2322: Type '{ ...whole props object... }' is not assignable to XProps`
// that never names the offending prop, so the model can't localize the fix.
//
// This translates that coarse signal into surgical, actionable instructions by
// reusing the curated V2_SMELLS map (which already carries the v3 replacement on
// every entry). It is the SAME telemetry the v2-smell diagnostic uses — no new
// knowledge base — repurposed as a repair cheat sheet.
//
// NOTE (deliberate, for the 2x2): this is the v2->v3 rename map. Feeding it into
// a repair prompt is a curated-knowledge injection. The harness runs it as an
// orthogonal repair-mode factor (raw vs hinted) so the pure baseline (raw) is
// preserved; see run-ab.ts.
// =============================================================================

import { V2_SMELLS } from './v2SmellDetector.js';

/**
 * Build one surgical migration hint per v2 smell present in the code. Empty
 * array when no known v2 drift is detected (then the repair runs on the raw tsc
 * diagnostics alone, exactly like Pass C).
 */
export function buildRepairHints(code: string): string[] {
  return V2_SMELLS.filter((s) => s.pattern.test(code)).map(
    (s) => `Legacy v2 "${s.id}" is removed in Chakra v3 — use "${s.v3}" instead.`
  );
}
