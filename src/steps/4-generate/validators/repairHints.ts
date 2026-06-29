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

// Pass E: heuristic hints for the residual NON-rename failure classes Pass D
// isolated (icon-as-child, string-token coercion). Unlike V2_SMELLS these are
// structural/typographic, so they match code shape (and, for coercion, the tsc
// diagnostic) rather than a v2 token. Deliberately narrow to avoid false
// positives:
//   - icon: any `icon={<...}` JSX icon prop (IconButton). leftIcon/rightIcon are
//     already V2_SMELLS and already work (Pass D), so they're NOT re-matched here
//     (the `\bicon=` word boundary excludes `leftIcon=`/`rightIcon=`); `icon={var}`
//     with no JSX literal is also excluded (the `<` requirement). Pass G broadened
//     this from the original self-closing-only `icon={<X/>}` form to also catch a
//     non-self-closing icon like `icon={<span>Show</span>}` (the password-input case).
//   - coercion: `value`/`defaultValue` assigned a numeric literal — but ONLY
//     emitted when tsc actually complains "...not assignable to type 'string'",
//     so legitimately-numeric props (e.g. a Slider value) are left alone. `gap`/
//     `spacing` are intentionally excluded: numeric tokens are VALID in v3 (and
//     `spacing` is already a rename smell).
const ICON_AS_PROP = /\bicon=\{\s*</;
const NUMERIC_TOKEN = /\b(?:defaultValue|value)=\{\s*-?\d+(?:\.\d+)?\s*\}/;
const WANTS_STRING = /not assignable to type '"?string"?'/;

const ICON_HINT =
  'The `icon={...}` prop was removed in Chakra v3 — pass the icon as a direct child instead, ' +
  'e.g. <IconButton aria-label="..."><YourIcon /></IconButton>.';
const COERCION_HINT =
  'A numeric literal was given where Chakra v3 types the prop as a string (e.g. NumberInput.Root / ' +
  "PinInput.Root `value`/`defaultValue`). Quote it: defaultValue=\"0\" instead of defaultValue={0}.";

// Pass G: the one reliable landmine failure (`password-input`) is STRUCTURAL, not
// a rename — the model wraps an <Input> plus a toggle <IconButton> as TWO children
// of <InputGroup>, which in v3 takes a SINGLE Input child (tsc: TS2746 "expects a
// single child"; runtime: "React.Children.only ... single React element child").
// The fix is the `endElement`/`startElement` prop. Gated on the TS2746 diagnostic
// (or the removed v2 InputRightElement/InputLeftElement components) so it only
// fires on the genuine multi-child shape, never on a correct single-child InputGroup.
const INPUTGROUP = /\bInputGroup\b/;
const V2_INPUT_ELEMENTS = /\bInput(?:Right|Left)Element\b/;
const SINGLE_CHILD_DIAG = /TS2746|single child/;

const INPUTGROUP_HINT =
  'Chakra v3 `InputGroup` accepts a SINGLE `Input` child — it cannot wrap multiple children. ' +
  'Move any trailing control (a visibility-toggle IconButton, icon, or addon) into the `endElement` ' +
  'prop (or `startElement` for a leading one), e.g. ' +
  '<InputGroup endElement={<IconButton aria-label="Toggle" variant="ghost"><Icon /></IconButton>}>' +
  '<Input type="password" /></InputGroup>. The v2 InputRightElement / InputLeftElement components were removed.';

/**
 * Build surgical migration hints from (a) the curated V2_SMELLS rename map and
 * (b) the Pass E heuristics. `diagnostics` (the raw tsc error lines) gate the
 * coercion hint so it only fires when the compiler actually demands a string.
 * Empty array = no known drift, repair falls back to raw tsc errors (Pass C).
 */
export function buildRepairHints(code: string, diagnostics: string[] = []): string[] {
  const hints = V2_SMELLS.filter((s) => s.pattern.test(code)).map(
    (s) => `Legacy v2 "${s.id}" is removed in Chakra v3 — use "${s.v3}" instead.`
  );

  if (ICON_AS_PROP.test(code)) hints.push(ICON_HINT);
  if (NUMERIC_TOKEN.test(code) && diagnostics.some((d) => WANTS_STRING.test(d))) {
    hints.push(COERCION_HINT);
  }
  // Pass G: structural InputGroup multi-child → endElement.
  if (
    V2_INPUT_ELEMENTS.test(code) ||
    (INPUTGROUP.test(code) && diagnostics.some((d) => SINGLE_CHILD_DIAG.test(d)))
  ) {
    hints.push(INPUTGROUP_HINT);
  }

  return hints;
}
