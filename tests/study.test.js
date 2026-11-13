const test = require('node:test');
const assert = require('node:assert/strict');
const data = require('../study-data.js');
const core = require('../study-core.js');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

test('all study entries have unique IDs, supported topics, difficulty and valid PDF references', () => {
  const all = [...data.flashcards, ...data.quizzes];
  assert.equal(new Set(all.map(q => q.id)).size, all.length);
  assert.equal(data.flashcards.length, 120);
  assert.equal(data.quizzes.length, 74);
  for (const q of all) {
    assert.ok(data.topics.some(t => t.id === q.topic), q.id);
    assert.ok(['foundation', 'application'].includes(q.difficulty), q.id);
    assert.ok(q.question.trim(), q.id);
    assert.ok(data.sources[q.source], q.id);
    assert.ok(q.pages.length, q.id);
    assert.ok(q.pages.every(p => Number.isInteger(p) && p > 0 && p <= data.sources[q.source].pages), q.id);
    if (q.answer) assert.ok(q.answer.trim(), q.id);
  }
});
test('every quiz has a coherent answer key and explanation', () => {
  for (const q of data.quizzes) {
    assert.equal(q.choices.length, 4, q.id);
    assert.equal(new Set(q.choices).size, q.choices.length, q.id);
    assert.ok(q.explanation.trim(), q.id);
    assert.ok(q.correct.length > 0 && q.correct.length < q.choices.length, q.id);
    assert.equal(new Set(q.correct).size, q.correct.length, q.id);
    assert.ok(q.correct.every(i => Number.isInteger(i) && i >= 0 && i < q.choices.length), q.id);
    assert.equal(q.type, q.correct.length > 1 ? 'multiple' : 'single', q.id);
    assert.equal(core.isCorrect(q, q.correct), true, q.id);
    assert.equal(core.isCorrect(q, []), false, q.id);
    if (q.type === 'multiple') assert.equal(core.isCorrect(q, q.correct.slice(1)), false, q.id);
    assert.equal(core.isCorrect(q, [...q.correct, q.choices.findIndex((_, i) => !q.correct.includes(i))]), false, q.id);
  }
});
test('all topics support both levels and both quiz types', () => {
  for (const topic of data.topics) {
    for (const difficulty of ['foundation', 'application']) {
      assert.ok(core.filterBank(data.flashcards, { topics: [topic.id], difficulty }).length, topic.id);
      assert.ok(core.filterBank(data.quizzes, { topics: [topic.id], difficulty }).length, topic.id);
    }
    for (const type of ['single', 'multiple']) assert.ok(core.filterBank(data.quizzes, { topics: [topic.id], type }).length);
  }
});
test('shuffle does not mutate its input or lose, duplicate or invent entries', () => {
  const original = [...data.quizzes];
  const shuffled = core.shuffle(original, () => 0.37);
  assert.deepEqual(original, data.quizzes);
  assert.deepEqual([...shuffled].sort((a,b) => a.id.localeCompare(b.id)), [...original].sort((a,b) => a.id.localeCompare(b.id)));
  assert.notDeepEqual(shuffled.map(q => q.id), original.map(q => q.id));
  assert.deepEqual(core.shuffle([]), []);
});
test('one response per question is recorded, including skipped questions', () => {
  const q = data.quizzes.find(q => q.type === 'multiple');
  const round = core.createRound([q]);
  assert.equal(core.recordResponse(round, [...q.correct].reverse()), true);
  assert.equal(round.responses[0].correct, true);
  assert.equal(core.recordResponse(round, []), false);
  assert.equal(round.responses.length, 1);
  const skipped = core.createRound([q]);
  core.recordResponse(skipped, q.correct, true);
  assert.equal(skipped.responses[0].correct, false);
  assert.equal(skipped.responses[0].skipped, true);
});
test('filters compose and unsupported combinations return an empty list', () => {
  const filtered = core.filterBank(data.quizzes, { topics: ['scheduling'], difficulty: 'application', type: 'single' });
  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(q => q.topic === 'scheduling' && q.difficulty === 'application' && q.type === 'single'));
  assert.equal(core.filterBank(data.quizzes, { topics: ['missing-topic'] }).length, 0);
});
test('multiple topics are combined as a union and an empty selection returns no questions', () => {
  const filtered = core.filterBank(data.flashcards, { topics: ['vm', 'memory'] });
  assert.equal(filtered.length, 32);
  assert.ok(filtered.every(q => ['vm', 'memory'].includes(q.topic)));
  assert.equal(core.filterBank(data.quizzes, { topics: [] }).length, 0);
  assert.equal(core.filterBank(data.quizzes).length, data.quizzes.length);
  const foundation = core.filterBank(data.quizzes, { topics: ['vm', 'memory'], difficulty: 'foundation', type: 'multiple' });
  assert.ok(foundation.length);
  assert.ok(foundation.every(q => ['vm', 'memory'].includes(q.topic) && q.type === 'multiple' && q.difficulty === 'foundation'));
});
test('navigation preserves question state, answer order and grade without duplicate scoring', () => {
  const round = core.createRound(data.quizzes.slice(0, 2));
  assert.equal(core.moveRound(round, -1), false);
  const question = round.questions[0];
  const firstState = core.currentState(round);
  const options = firstState.options;
  core.recordResponse(round, question.correct);
  core.moveRound(round, 1);
  const second = core.currentState(round);
  second.selected = [1];
  core.moveRound(round, -1);
  assert.equal(core.currentState(round), firstState);
  assert.equal(core.currentState(round).options, options);
  assert.equal(core.currentState(round).submitted, true);
  assert.equal(core.recordResponse(round, []), false);
  assert.equal(round.responses.length, 1);
  core.moveRound(round, 1);
  assert.deepEqual(core.currentState(round).selected, [1]);
  core.moveRound(round, 1);
  assert.equal(round.position, round.questions.length);
  assert.equal(core.moveRound(round, 1), false);
  core.moveRound(round, -1);
  assert.equal(core.currentState(round), second);
  const flash = core.createRound(data.flashcards.slice(0, 2));
  core.currentState(flash).showingAnswer = true;
  core.moveRound(flash, 1);
  assert.equal(core.currentState(flash).showingAnswer, false);
  core.moveRound(flash, -1);
  assert.equal(core.currentState(flash).showingAnswer, true);
});
test('every linked source exists, and links identify the exact one-based PDF pages', () => {
  for (const q of [...data.flashcards, ...data.quizzes]) {
    const links = core.sourceLinks(q, data.sources);
    assert.equal(links.length, q.pages.length);
    links.forEach((link, index) => {
      const [file, hash] = link.href.split('#');
      assert.equal(hash, `page=${q.pages[index]}`);
      const absolute = path.resolve(__dirname, '..', decodeURIComponent(file));
      assert.equal(fs.readFileSync(absolute).subarray(0, 4).toString(), '%PDF');
    });
  }
});
test('all 22 migrated course files match their original SHA-256 hashes', () => {
  const manifestPath = path.resolve(__dirname, '../data/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(manifest.length, 22);
  for (const item of manifest) {
    const bytes = fs.readFileSync(path.resolve(__dirname, '../data', item.file));
    assert.equal(bytes.length, item.bytes, item.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.file);
  }
});
