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
  function filterBank(bank, { topic = 'all', difficulty = 'all', type = 'all' } = {}) {
    return bank.filter(q => (topic === 'all' || q.topic === topic) &&
      (difficulty === 'all' || q.difficulty === difficulty) && (type === 'all' || q.type === type));
  }
  function isCorrect(question, selected) {
    const unique = [...new Set(selected)];
    return unique.length === question.correct.length && unique.every(index => question.correct.includes(index));
  }
  function createRound(bank) {
    return { questions: shuffle(bank), position: 0, responses: [], showingAnswer: false, selected: [], submitted: false };
  }
  function recordResponse(round, selected, skipped = false) {
    if (round.submitted || !round.questions[round.position]) return false;
    const question = round.questions[round.position];
    round.responses.push({ id: question.id, topic: question.topic, correct: !skipped && isCorrect(question, selected), skipped });
    round.submitted = true;
    return true;
  }
  const api = { shuffle, filterBank, isCorrect, createRound, recordResponse };
  root.StudyCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
