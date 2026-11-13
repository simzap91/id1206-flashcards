/* Shared, dependency-free study logic. Also exported for Node's built-in tests. */
(function (root) {
  'use strict';
  function shuffle(items, random = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function filterBank(bank, { topics = null, difficulty = 'all', type = 'all' } = {}) {
    return bank.filter(q => (topics === null || topics.includes(q.topic)) &&
      (difficulty === 'all' || q.difficulty === difficulty) && (type === 'all' || q.type === type));
  }
  function isCorrect(question, selected) {
    const unique = [...new Set(selected)];
    return unique.length === question.correct.length && unique.every(index => question.correct.includes(index));
  }
  function createRound(bank) {
    const questions = shuffle(bank);
    return { questions, position: 0, responses: [], states: questions.map(q => ({
      showingAnswer: false, selected: [], submitted: false,
      options: q.choices ? shuffle(q.choices.map((text, index) => ({ text, index }))) : []
    })) };
  }
  function currentState(round) {
    return round.states[round.position];
  }
  function moveRound(round, delta) {
    const position = Math.max(0, Math.min(round.questions.length, round.position + delta));
    if (position === round.position) return false;
    round.position = position;
    return true;
  }
  function recordResponse(round, selected, skipped = false) {
    const state = currentState(round);
    if (!state || state.submitted) return false;
    const question = round.questions[round.position];
    round.responses.push({ id: question.id, topic: question.topic, correct: !skipped && isCorrect(question, selected), skipped });
    state.selected = [...selected];
    state.submitted = true;
    return true;
  }
  function sourceLinks(question, sources) {
    const source = sources[question.source];
    return question.pages.map(page => ({
      label: `p. ${page}`, href: `data/${encodeURIComponent(source.file)}#page=${page}`,
      title: `Open ${source.file}, page ${page}`
    }));
  }
  const api = { shuffle, filterBank, isCorrect, createRound, currentState, moveRound, recordResponse, sourceLinks };
  root.StudyCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
