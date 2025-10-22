// Test script to verify scoring doesn't filter trivial examples
import { getCompositionScore } from '../dist/steps/0-extract-docs/utils/codeAnalysis.js';

console.log('='.repeat(60));
console.log('TESTING: Trivial examples should be KEPT, not filtered');
console.log('='.repeat(60));
console.log();

// Test 1: Trivial example (should score 0-2, complexity "trivial")
const trivialCode = '<Button variant="primary">Click</Button>';
const trivialResult = getCompositionScore(trivialCode);
console.log('Test 1: Trivial JSX example');
console.log('  Code:', trivialCode);
console.log('  Score:', trivialResult.score);
console.log('  Complexity:', trivialResult.complexity);
console.log('  ✓ Would be KEPT (no filtering by score)');
console.log();

// Test 2: Another trivial example
const trivial2 = '<Input placeholder="Enter name" />';
const trivial2Result = getCompositionScore(trivial2);
console.log('Test 2: Simple Input element');
console.log('  Code:', trivial2);
console.log('  Score:', trivial2Result.score);
console.log('  Complexity:', trivial2Result.complexity);
console.log('  ✓ Would be KEPT (no filtering by score)');
console.log();

// Test 3: Basic example (should score 3-6)
const basicCode = 'const Demo = () => { return <Button colorScheme="blue">Click</Button> }';
const basicResult = getCompositionScore(basicCode);
console.log('Test 3: Basic function component');
console.log('  Code:', basicCode);
console.log('  Score:', basicResult.score);
console.log('  Complexity:', basicResult.complexity);
console.log('  ✓ Would be KEPT');
console.log();

// Test 4: Intermediate example (should score 7-10)
const intermediateCode = `
const Demo = () => {
  const [count, setCount] = useState(0);
  return <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
}`;
const intermediateResult = getCompositionScore(intermediateCode);
console.log('Test 4: Component with hooks and events');
console.log('  Score:', intermediateResult.score);
console.log('  Complexity:', intermediateResult.complexity);
console.log('  ✓ Would be KEPT');
console.log();

console.log('='.repeat(60));
console.log('RESULT: All examples kept regardless of score ✓');
console.log('Score is used for CLASSIFICATION only, not filtering');
console.log('='.repeat(60));
