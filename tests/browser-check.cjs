/* Optional end-to-end validation. No dependencies are needed by the app itself. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const data = require('../study-data.js');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;
  const shotDir = process.env.SCREENSHOT_DIR;
  async function screenshot(name) {
    if (!shotDir) return;
    await fs.mkdir(shotDir, { recursive: true });
    await page.waitForTimeout(250); // Let progress-bar transitions finish before visual QA.
    await page.screenshot({ path: path.join(shotDir, name + '.png'), fullPage: true });
  }
  async function visible(selector) { return page.locator(selector).isVisible(); }
  async function current() {
    const text = await page.locator('#quizQuestion').textContent();
    return data.quizzes.find(q => q.question === text);
  }
  async function select(indices) {
    for (const index of indices) await page.locator(`#options input[value="${index}"]`).check();
  }
  try {
    await page.goto(url);
    await page.locator('#cardText').waitFor();
    assert.match(await page.title(), /ID1206/);
    assert.equal(await page.locator('#flashCount').textContent(), '120');
    assert.equal(await page.locator('#quizCount').textContent(), '74');
    const firstCard = await page.locator('#cardText').textContent();
    await page.locator('#card').click();
    assert.equal(await page.locator('#sideLabel').textContent(), 'Answer');
    assert.equal(await visible('#flashSource'), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#sideLabel').textContent(), 'Question');
    await page.keyboard.press('ArrowRight');
    assert.match(await page.locator('#roundProgress').textContent(), /Card 2 of 120/);
    assert.notEqual(await page.locator('#cardText').textContent(), firstCard);
    const preservedCard = await page.locator('#cardText').textContent();
    await page.locator('#quizMode').click();
    assert.equal(await visible('#quizPanel'), true);
    assert.equal(await visible('#typeFilterLabel'), true);
    assert.equal(await page.locator('#checkButton').isDisabled(), true);

    // Radio replacement and unsent selection survive switching modes.
    await page.locator('#typeFilter').selectOption('single');
    const radios = page.locator('#options input');
    assert.equal(await radios.first().getAttribute('type'), 'radio');
    await radios.nth(0).check();
    await radios.nth(1).check();
    assert.equal(await page.locator('#options input:checked').count(), 1);
    const selected = await page.locator('#options input:checked').getAttribute('value');
    const questionText = await page.locator('#quizQuestion').textContent();
    await page.locator('#flashMode').click();
    assert.equal(await page.locator('#cardText').textContent(), preservedCard);
    await page.locator('#quizMode').click();
    assert.equal(await page.locator('#quizQuestion').textContent(), questionText);
    assert.equal(await page.locator('#options input:checked').getAttribute('value'), selected);

    // Topic/level/type filters compose, including empty selections and recovery.
    await page.locator('#topicFilter').selectOption('os');
    await page.locator('#difficultyFilter').selectOption('application');
    await page.locator('#typeFilter').selectOption('multiple');
    assert.equal(await visible('#emptyPanel'), true);
    assert.equal(await visible('#quizPanel'), false);
    await page.locator('#resetFilters').click();
    assert.equal(await visible('#quizPanel'), true);
    await page.locator('#topicFilter').selectOption('scheduling');
    await page.locator('#difficultyFilter').selectOption('application');
    await page.locator('#typeFilter').selectOption('single');
    assert.equal((await current()).difficulty, 'application');
    assert.equal((await current()).topic, 'scheduling');
    await page.locator('#topicFilter').focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Escape');
    assert.equal(await visible('#quizPanel'), true);
    await page.locator('#topicFilter').selectOption('all');
    await page.locator('#difficultyFilter').selectOption('all');
    await page.locator('#typeFilter').selectOption('all');

    // Exercise every quiz, keeping answer indices valid through shuffled options.
    const seen = new Set();
    const missed = new Set();
    let partialTested = false, wrongSingleTested = false, skipTested = false;
    for (let i = 0; i < data.quizzes.length; i++) {
      const q = await current();
      assert.ok(q, 'Displayed quiz must exist in the source bank');
      assert.equal(seen.has(q.id), false, 'No repeat within a round');
      seen.add(q.id);
      assert.equal(await visible('#feedback'), false);
      assert.equal(await page.locator('#checkButton').isDisabled(), true);
      let skipped = false, wrong = false;
      if (!partialTested && q.type === 'multiple') {
        assert.equal(await page.locator('#options input').first().getAttribute('type'), 'checkbox');
        await select(q.correct.slice(1));
        partialTested = true; wrong = true;
      } else if (!wrongSingleTested && q.type === 'single') {
        await select([q.choices.findIndex((_, index) => !q.correct.includes(index))]);
        wrongSingleTested = true; wrong = true;
      } else if (!skipTested) {
        await select(q.correct);
        skipped = true; skipTested = true;
      } else {
        await select(q.correct);
      }
      if (wrong || skipped) missed.add(q.id);
      if (skipped) await page.locator('#skipButton').click();
      else await page.locator('#checkButton').click();
      assert.equal(await visible('#feedback'), true);
      assert.equal(await page.locator('#explanation').textContent(), q.explanation);
      assert.match(await page.locator('#quizSource').textContent(), new RegExp(data.sources[q.source].file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      assert.equal(await page.locator('#options .correct').count(), q.correct.length);
      assert.equal(await page.locator('#options input:enabled').count(), 0);
      const feedback = await page.locator('#feedbackTitle').textContent();
      assert.equal(feedback === 'Correct', !wrong && !skipped);
      const before = await page.locator('#roundProgress').textContent();
      await page.locator('#quizForm').evaluate(form => form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
      assert.equal(await page.locator('#roundProgress').textContent(), before, 'Submitting twice must not inflate score');
      if (i === 5) await screenshot('quiz-feedback-desktop');
      await page.locator('#nextQuizButton').click();
    }
    assert.equal(seen.size, 74);
    assert.equal(missed.size, 3);
    assert.equal(await visible('#summaryPanel'), true);
    assert.equal(await page.locator('#summaryTitle').textContent(), '71 / 74 correct · 96%');
    assert.equal(await page.locator('.topic-result').count(), 8);
    assert.match(await page.locator('#summaryText').textContent(), /73 answered · 1 skipped/);
    await screenshot('quiz-results-desktop');
    await page.locator('#retryButton').click();
    for (let i = 0; i < missed.size; i++) {
      const q = await current();
      assert.ok(missed.has(q.id), 'Retry round contains only incorrect/skipped questions');
      await select(q.correct);
      await page.locator('#checkButton').click();
      await page.locator('#nextQuizButton').click();
    }
    assert.equal(await page.locator('#summaryTitle').textContent(), '3 / 3 correct · 100%');
    assert.equal(await visible('#retryButton'), false);
    await page.locator('#againButton').click();
    assert.match(await page.locator('#roundProgress').textContent(), /Question 1 of 74/);

    // Extra selections must also fail exact-set scoring.
    await page.locator('#typeFilter').selectOption('multiple');
    const multi = await current();
    await select([...multi.correct, multi.choices.findIndex((_, index) => !multi.correct.includes(index))]);
    await page.locator('#checkButton').click();
    assert.match(await page.locator('#feedbackTitle').textContent(), /Not quite/);
    const correctColor = await page.locator('.option.correct').first().evaluate(el => getComputedStyle(el).backgroundColor);
    const incorrectColor = await page.locator('.option.incorrect').first().evaluate(el => getComputedStyle(el).backgroundColor);
    assert.notEqual(correctColor, incorrectColor, 'Reviewed correct and incorrect options must look distinct');

    // Mobile screens, long text, and exposed feedback should never overflow.
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await screenshot('quiz-feedback-mobile');
    await page.locator('#flashMode').click();
    await page.locator('#topicFilter').selectOption('threads');
    await page.locator('#difficultyFilter').selectOption('application');
    const cardCount = Number(await page.locator('#flashCount').textContent());
    for (let i = 0; i < cardCount; i++) {
      await page.locator('#flipButton').click();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#nextCardButton').click();
    }
    assert.equal(await visible('#summaryPanel'), true);
    assert.match(await page.locator('#summaryTitle').textContent(), /flashcards practiced/);
    await page.locator('#againButton').click();
    await page.locator('#topicFilter').selectOption('all');
    await page.locator('#difficultyFilter').selectOption('all');
    await screenshot('flashcards-mobile');
    await page.setViewportSize({ width: 1200, height: 1000 });
    await screenshot('flashcards-desktop');
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: all 74 quizzes; exact-set scoring; radio/checkbox state; filters; summaries/retry; all flash application cards in Threads; keyboard; mobile layout; no runtime errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
