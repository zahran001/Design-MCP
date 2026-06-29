// =============================================================================
// Browser smoke test for the full-stack UI (TESTING_FULLSTACK.md section 3)
// =============================================================================
// Drives the RUNNING Vite dev server with Playwright (chromium, already installed
// for the render validator). Soft assertions: each case is wrapped so one flaky
// step doesn't abort the run; results + screenshots are printed/saved for review.
//
// Prereqs: backend (`npm run serve`) and frontend (`cd web && npm run dev`) both
// up. Run from the REPO ROOT so `playwright` resolves (it's a root dependency):
//
//   node web/e2e/ui-smoke.mjs
//
// Env: BASE_URL (default http://localhost:5173), HEADED=1 to watch it.
// Note: each case spends one real OpenAI generation; the run makes ~5 calls.
// =============================================================================

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const record = (id, ok, note) => {
  results.push({ id, ok, note });
  console.log(`${ok ? 'PASS' : 'WARN'}  ${id}  ${note}`);
};

/** Click Generate and wait for the /api/generate response; retry once on 429. */
async function generate(page) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const waitResp = page.waitForResponse((r) => r.url().includes('/api/generate'), {
      timeout: 120_000,
    });
    await page.getByRole('button', { name: 'Generate' }).click();
    const resp = await waitResp;
    if (resp.status() === 429) {
      const retry = Number(resp.headers()['retry-after'] || 5) + 1;
      console.log(`  (rate-limited; waiting ${retry}s)`);
      await page.waitForTimeout(retry * 1000);
      continue;
    }
    // Let React render the report (tsc badge appears) before reading.
    await page.locator('.chakra-badge').first().waitFor({ timeout: 30_000 }).catch(() => {});
    return resp.status();
  }
  return 429;
}

/** All Chakra badge labels currently on the page. */
const badges = (page) => page.locator('.chakra-badge').allInnerTexts();

/** The generated component source (first <pre> = the Prism code view). */
const code = (page) => page.locator('pre').first().innerText();

async function run() {
  const browser = await chromium.launch({ headless: !process.env.HEADED });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // --- 3.1 held-out example: live preview + green badges ---
    try {
      const heading = await page
        .getByRole('heading', { name: /Chakra v3 Component Generator/ })
        .isVisible();
      await page.getByRole('button', { name: /Welcome back/ }).click();
      await generate(page);
      const b = await badges(page);
      const previewFrame = await page.locator('iframe').count();
      await page.screenshot({ path: join(SHOTS, '3.1-heldout.png'), fullPage: true });
      const tscOk = b.some((t) => /tsc ✓/.test(t));
      record(
        '3.1',
        heading && tscOk && previewFrame > 0,
        `heading=${heading} preview-iframe=${previewFrame > 0} badges=[${b.join(' | ')}]`
      );
    } catch (e) {
      record('3.1', false, `threw: ${e.message}`);
    }

    // --- 3.2 landmine prompt renders; badges are server-truthful ---
    let landmineCode = '';
    try {
      await page.locator('textarea').fill('a green submit button');
      await generate(page);
      const b = await badges(page);
      landmineCode = await code(page);
      await page.screenshot({ path: join(SHOTS, '3.2-landmine.png'), fullPage: true });
      const smell = b.find((t) => /v2-smells|no v2 smells/.test(t)) || '(no smell badge)';
      record('3.2', /tsc ✓|tsc ✗/.test(b.join(' ')), `smell-badge="${smell}" badges=[${b.join(' | ')}]`);
    } catch (e) {
      record('3.2', false, `threw: ${e.message}`);
    }

    // --- 3.3 grounding toggle visibly degrades output ---
    try {
      // Toggle the Switch off via its label, confirm via the hidden checkbox.
      await page.getByText(/Grounded in retrieved docs/).click();
      const checked = await page.locator('input[type=checkbox]').first().isChecked();
      await generate(page);
      const b = await badges(page);
      await page.screenshot({ path: join(SHOTS, '3.3-ungrounded.png'), fullPage: true });
      const ungrounded = b.some((t) => /^ungrounded$/.test(t));
      record(
        '3.3',
        !checked && ungrounded,
        `switch-off=${!checked} ungrounded-badge=${ungrounded} badges=[${b.join(' | ')}]`
      );
    } catch (e) {
      record('3.3', false, `threw: ${e.message}`);
    }

    // --- 3.4 regenerate varies (non-determinism) ---
    try {
      // Toggle back on, regenerate the landmine, compare source to 3.2.
      await page.getByText(/Grounded in retrieved docs/).click();
      await generate(page);
      const again = await code(page);
      const differs = again.trim() !== landmineCode.trim();
      record('3.4', true, `output ${differs ? 'differs from' : 'matches'} the earlier run (either is valid)`);
    } catch (e) {
      record('3.4', false, `threw: ${e.message}`);
    }

    // --- 3.5 out-of-corpus: low scores / weak-grounding signal ---
    try {
      await page.locator('textarea').fill('a candlestick stock chart');
      await generate(page);
      const b = await badges(page);
      // Expand the Grounded-in panel to read the top similarity score.
      await page.getByRole('button', { name: /Grounded in \d+ retrieved chunks/ }).click().catch(() => {});
      const body = await page.locator('body').innerText();
      const topScore = body.match(/score (\d+\.\d+)/)?.[1] ?? 'n/a';
      const warned = /weak grounding/i.test(body);
      await page.screenshot({ path: join(SHOTS, '3.5-out-of-corpus.png'), fullPage: true });
      record(
        '3.5',
        true,
        `top-score=${topScore} weak-grounding-warning=${warned} (warning expected only after the fix) badges=[${b.join(' | ')}]`
      );
    } catch (e) {
      record('3.5', false, `threw: ${e.message}`);
    }

    // 3.6 (backend down -> inline error box) needs the API stopped; left to the
    // operator since `npm run serve` runs in a separate terminal.
    record('3.6', null, 'skipped — requires stopping the backend (operator-run)');
  } finally {
    await browser.close();
  }

  console.log(`\nScreenshots: ${SHOTS}`);
  const failed = results.filter((r) => r.ok === false);
  if (failed.length) {
    console.log(`\n${failed.length} case(s) need attention.`);
    process.exitCode = 1;
  }
}

run().catch((e) => {
  console.error('fatal:', e);
  process.exit(1);
});
