// =============================================================================
// Phase 4b — tsc validator self-test
// =============================================================================
// Proves the sandbox catches real Chakra v3 violations (and passes valid v3),
// and reveals exactly WHAT tsc discriminates, before we build the A/B harness.
//
// Usage: npx tsx src/steps/4-generate/test-generation/validator-selftest.ts
// =============================================================================

import { tscValidate } from '../validators/tscValidator.js';

interface Case {
  id: string;
  expect: 'pass' | 'fail';
  code: string;
}

const CASES: Case[] = [
  {
    id: 'v3-correct-button (colorPalette)',
    expect: 'pass',
    code: `import { Button } from "@chakra-ui/react"
export default function C() { return <Button colorPalette="green">Submit</Button> }`,
  },
  {
    id: 'v2-button (colorScheme)',
    expect: 'fail',
    code: `import { Button } from "@chakra-ui/react"
export default function C() { return <Button colorScheme="green">Submit</Button> }`,
  },
  {
    id: 'v2-FormControl imports (removed in v3)',
    expect: 'fail',
    code: `import { FormControl, FormLabel, Input } from "@chakra-ui/react"
export default function C() { return <FormControl><FormLabel>Email</FormLabel><Input/></FormControl> }`,
  },
  {
    id: 'hallucinated component',
    expect: 'fail',
    code: `import { Sparkle } from "@chakra-ui/react"
export default function C() { return <Sparkle glow /> }`,
  },
  {
    id: 'incomplete Checkbox.Root (type-valid but semantically thin)',
    expect: 'pass',
    code: `import { Checkbox } from "@chakra-ui/react"
export default function C() { return <Checkbox.Root>Accept terms</Checkbox.Root> }`,
  },
  {
    id: 'syntax error',
    expect: 'fail',
    code: `import { Button } from "@chakra-ui/react"
export default function C() { return <Button>oops</Button }`,
  },
];

async function main(): Promise<void> {
  console.log('tsc validator self-test (Chakra v3.27.1)\n' + '='.repeat(60));
  let surprises = 0;
  for (const c of CASES) {
    const r = await tscValidate(c.code);
    const got = r.ok ? 'pass' : 'fail';
    const match = got === c.expect ? '✅' : '❌ UNEXPECTED';
    if (got !== c.expect) surprises++;
    console.log(`\n[${match}] ${c.id}`);
    console.log(`   expected ${c.expect}, got ${got} (${r.errorCount} errors)`);
    for (const d of r.diagnostics.slice(0, 3)) console.log(`     ${d}`);
  }
  console.log(`\n${'='.repeat(60)}\nUnexpected outcomes: ${surprises}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
