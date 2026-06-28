// =============================================================================
// Hardening Item 2 — render validator self-test
// =============================================================================
// Proves the headless render gate discriminates: a valid v3 component MOUNTS
// (non-empty DOM, no error); components that throw on render, render blank, or
// fail to bundle are caught. Run this before wiring the gate into the harness —
// it's the "does the mechanism work" check (esbuild + Playwright + Chakra v3).
//
// Usage: npx tsx src/steps/4-generate/test-generation/render-selftest.ts
// (requires Playwright Chromium installed — same browser the crawler uses.)
// =============================================================================

import { RenderValidator } from '../validators/renderValidator.js';

interface Case {
  id: string;
  expect: 'pass' | 'fail';
  code: string;
}

const CASES: Case[] = [
  {
    id: 'valid-v3-button (mounts)',
    expect: 'pass',
    code: `import { Button } from "@chakra-ui/react";
export default function C() { return <Button colorPalette="green">Submit</Button>; }`,
  },
  {
    id: 'composed-v3-checkbox (mounts)',
    expect: 'pass',
    code: `import { Checkbox } from "@chakra-ui/react";
export default function C() {
  return (
    <Checkbox.Root>
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label>Accept</Checkbox.Label>
    </Checkbox.Root>
  );
}`,
  },
  {
    id: 'throws-on-render',
    expect: 'fail',
    code: `import { Box } from "@chakra-ui/react";
export default function C() { throw new Error("boom on render"); return <Box />; }`,
  },
  {
    id: 'runtime-throw (tsc-blind)',
    expect: 'fail',
    code: `import { Box } from "@chakra-ui/react";
export default function C() {
  const data = JSON.parse("not json"); // throws at render; tsc is blind to it
  return <Box>{data.label}</Box>;
}`,
  },
  {
    id: 'renders-blank (null)',
    expect: 'fail',
    code: `export default function C() { return null; }`,
  },
  {
    id: 'bundle-error (missing export)',
    expect: 'fail',
    code: `import { NotARealComponent } from "@chakra-ui/react";
export default function C() { return <NotARealComponent />; }`,
  },
];

async function main(): Promise<void> {
  const validator = new RenderValidator();
  let allOk = true;
  console.log('='.repeat(80));
  console.log('RENDER VALIDATOR SELF-TEST (esbuild + Playwright + Chakra v3)');
  console.log('='.repeat(80));
  try {
    for (const c of CASES) {
      const r = await validator.validate(c.code);
      const got: 'pass' | 'fail' = r.ok ? 'pass' : 'fail';
      const correct = got === c.expect;
      allOk = allOk && correct;
      const mark = correct ? 'OK ' : 'XX ';
      const detail = r.ok ? '' : `  (${r.error?.slice(0, 80) ?? ''})`;
      console.log(`${mark} ${c.id.padEnd(40)} expect=${c.expect} got=${got}${detail}`);
    }
  } finally {
    await validator.close();
  }
  console.log('='.repeat(80));
  console.log(allOk ? 'SELF-TEST PASSED — render gate discriminates correctly.' : 'SELF-TEST FAILED.');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
