import fs from 'fs';
import path from 'path';

// Get most recent file
const artifactsDir = './artifacts/raw-json';
const files = fs.readdirSync(artifactsDir)
  .map(f => ({ name: f, time: fs.statSync(path.join(artifactsDir, f)).mtime }))
  .sort((a, b) => b.time - a.time);

const latestFile = files[0].name;
const data = JSON.parse(fs.readFileSync(path.join(artifactsDir, latestFile), 'utf8'));

console.log('Component:', data.componentName);
console.log('Total examples:', data.codeExamples?.length || 0);
console.log('\n' + '='.repeat(60));
console.log('SCORE DISTRIBUTION:');
console.log('='.repeat(60));

const examples = data.codeExamples || [];
examples.sort((a, b) => a.score - b.score);

examples.forEach((ex, i) => {
  console.log(`\nExample ${i + 1}:`);
  console.log(`  Score: ${ex.score}, Complexity: ${ex.complexity}`);
  console.log(`  Length: ${ex.code.length} chars, Lines: ${ex.code.split('\n').length}`);
  const preview = ex.code.substring(0, 120).replace(/\n/g, ' ').replace(/\s+/g, ' ');
  console.log(`  Preview: ${preview}${ex.code.length > 120 ? '...' : ''}`);
});

console.log('\n' + '='.repeat(60));
console.log('COMPLEXITY SUMMARY:');
console.log('='.repeat(60));

const byComplexity = {
  trivial: examples.filter(e => e.complexity === 'trivial'),
  basic: examples.filter(e => e.complexity === 'basic'),
  intermediate: examples.filter(e => e.complexity === 'intermediate'),
  advanced: examples.filter(e => e.complexity === 'advanced'),
};

Object.entries(byComplexity).forEach(([level, items]) => {
  if (items.length > 0) {
    const scores = items.map(e => e.score);
    console.log(`${level.toUpperCase()}: ${items.length} examples (scores: ${Math.min(...scores)}-${Math.max(...scores)})`);
  }
});
