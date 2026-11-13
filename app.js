(function () {
  'use strict';
  const { topics, sources, flashcards, quizzes } = globalThis.ID1206_DATA;
  const { shuffle, filterBank, createRound, recordResponse } = globalThis.StudyCore;
  const $ = id => document.getElementById(id);
  const labels = Object.fromEntries(topics.map(topic => [topic.id, topic.label]));
  const levelLabel = { foundation: 'Foundation', application: 'Application' };
  let mode = 'flash';
  const rounds = { flash: null, quiz: null };

  function filters(forMode = mode) {
    return { topic: $('topicFilter').value, difficulty: $('difficultyFilter').value,
      type: forMode === 'quiz' ? $('typeFilter').value : 'all' };
  }
  function pool(forMode = mode) {
    return filterBank(forMode === 'flash' ? flashcards : quizzes, filters(forMode));
  }
  function sourceText(question) {
    return `Source: ${sources[question.source].file} · ${question.pages.length === 1 ? 'p.' : 'pp.'} ${question.pages.join(', ')}`;
  }
  function metaText(question) {
    return `${labels[question.topic]} · ${levelLabel[question.difficulty]}`;
  }
  function startRound(questions = pool()) {
    rounds[mode] = createRound(questions);
    prepareQuestion();
    render();
  }
  function prepareQuestion() {
    const round = rounds[mode];
    round.showingAnswer = false;
    round.selected = [];
    round.submitted = false;
    round.skipped = false;
    const question = round.questions[round.position];
    if (mode === 'quiz' && question) {
      // Preserve original indices so answer keys stay valid after option shuffling.
      round.options = shuffle(question.choices.map((text, index) => ({ text, index })));
    }
  }
  function renderCounts() {
    $('flashCount').textContent = pool('flash').length;
    $('quizCount').textContent = pool('quiz').length;
  }
  function render() {
    const round = rounds[mode];
    const total = round.questions.length;
    const complete = total > 0 && round.position >= total;
    $('flashPanel').hidden = mode !== 'flash' || !total || complete;
    $('quizPanel').hidden = mode !== 'quiz' || !total || complete;
    $('summaryPanel').hidden = !complete;
    $('emptyPanel').hidden = total !== 0;
    $('typeFilterLabel').hidden = mode !== 'quiz';
    $('flashMode').setAttribute('aria-pressed', String(mode === 'flash'));
    $('quizMode').setAttribute('aria-pressed', String(mode === 'quiz'));
    $('restartButton').disabled = total === 0;
    $('progressFill').style.width = `${total ? (round.position / total) * 100 : 0}%`;
    const score = round.responses.filter(response => response.correct).length;
    const scoreText = mode === 'quiz' && round.responses.length ? ` · ${score}/${round.responses.length} correct` : '';
    $('roundProgress').textContent = !total ? 'No matching questions' : complete ? `Round finished${scoreText}` :
      `${mode === 'flash' ? 'Card' : 'Question'} ${round.position + 1} of ${total}${scoreText}`;
    renderCounts();
    if (complete) renderSummary(round);
    else if (total && mode === 'flash') renderFlash(round);
    else if (total) renderQuiz(round);
  }
  function renderFlash(round) {
    const question = round.questions[round.position];
    $('cardMeta').textContent = metaText(question);
    $('sideLabel').textContent = round.showingAnswer ? 'Answer' : 'Question';
    $('cardText').textContent = round.showingAnswer ? question.answer : question.question;
    $('cardHint').textContent = round.showingAnswer ? 'Click to see the question again' : 'Click to reveal the answer';
    $('card').classList.toggle('answer', round.showingAnswer);
    $('card').setAttribute('aria-label', `${round.showingAnswer ? 'Answer' : 'Question'}: ${round.showingAnswer ? question.answer : question.question}. ${round.showingAnswer ? 'Show question' : 'Reveal answer'}.`);
    $('flashSource').textContent = sourceText(question);
    $('flashSource').hidden = !round.showingAnswer;
    $('flipButton').textContent = round.showingAnswer ? 'Show question' : 'Show answer';
    $('nextCardButton').textContent = round.position === round.questions.length - 1 ? 'Finish round →' : 'Next card →';
  }
  function renderQuiz(round) {
    const question = round.questions[round.position];
    $('quizMeta').textContent = metaText(question);
    $('quizType').textContent = question.type === 'multiple' ? 'Multiple answers' : 'Single answer';
    $('quizQuestion').textContent = question.question;
    $('selectionHint').textContent = question.type === 'multiple' ? 'Select all that apply. There may be more than one correct answer.' : 'Choose one answer.';
    $('quizFieldset').setAttribute('aria-describedby', 'selectionHint');
    $('options').replaceChildren();
    round.options.forEach(option => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      input.name = 'answer';
      input.value = option.index;
      input.checked = round.selected.includes(option.index);
      input.disabled = round.submitted;
      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = option.text;
      label.append(input, text);
      if (round.submitted) {
        label.classList.add('reviewed');
        const correct = question.correct.includes(option.index);
        const selectedWrong = input.checked && !correct;
        label.classList.toggle('correct', correct);
        label.classList.toggle('incorrect', selectedWrong);
        if (correct || selectedWrong) {
          const result = document.createElement('span');
          result.className = 'option-result';
          result.textContent = correct ? (input.checked ? '✓ Correct' : 'Correct answer') : 'Your answer';
          label.append(result);
        }
      }
      input.addEventListener('change', () => {
        round.selected = [...$('options').querySelectorAll('input:checked')].map(element => Number(element.value));
        $('checkButton').disabled = round.selected.length === 0;
      });
      $('options').append(label);
    });
    $('feedback').hidden = !round.submitted;
    if (round.submitted) {
      const response = round.responses[round.responses.length - 1];
      $('feedback').className = `feedback ${response.correct ? 'good' : 'bad'}`;
      $('feedbackTitle').textContent = response.skipped ? 'Skipped · review the answer' : response.correct ? 'Correct' : 'Not quite · review the answer';
      $('explanation').textContent = question.explanation;
      $('quizSource').textContent = sourceText(question);
    }
    $('checkButton').hidden = round.submitted;
    $('checkButton').disabled = round.selected.length === 0;
    $('skipButton').hidden = round.submitted;
    $('nextQuizButton').hidden = !round.submitted;
    $('nextQuizButton').textContent = round.position === round.questions.length - 1 ? 'See results →' : 'Next question →';
  }
  function renderSummary(round) {
    const isQuiz = mode === 'quiz';
    const correct = round.responses.filter(response => response.correct).length;
    const skipped = round.responses.filter(response => response.skipped).length;
    const total = round.questions.length;
    $('summaryTitle').textContent = isQuiz ? `${correct} / ${total} correct · ${Math.round(correct / total * 100)}%` : `${total} flashcards practiced`;
    $('summaryText').textContent = isQuiz ?
      `${total - skipped} answered · ${skipped} skipped. ${correct === total ? 'All correct this round.' : 'Review the explanations and give the missed questions another try.'}` :
      'You reached the end of this selection. Start a fresh shuffled round whenever you’re ready.';
    $('retryButton').hidden = !isQuiz || correct === total;
    $('resultTopics').replaceChildren();
    if (isQuiz) {
      topics.forEach(topic => {
        const responses = round.responses.filter(response => response.topic === topic.id);
        if (!responses.length) return;
        const row = document.createElement('div');
        row.className = 'topic-result';
        const label = document.createElement('span');
        const result = document.createElement('span');
        label.textContent = topic.label;
        result.textContent = `${responses.filter(response => response.correct).length} / ${responses.length} correct`;
        row.append(label, result);
        $('resultTopics').append(row);
      });
    }
  }
  function flipCard() {
    const round = rounds.flash;
    if (mode !== 'flash' || !round.questions[round.position]) return;
    round.showingAnswer = !round.showingAnswer;
    renderFlash(round);
  }
  function nextQuestion() {
    const round = rounds[mode];
    if (!round.questions[round.position] || (mode === 'quiz' && !round.submitted)) return;
    round.position++;
    prepareQuestion();
    render();
    if (round.position === round.questions.length) $('summaryTitle').focus();
    else if (mode === 'quiz') $('options').querySelector('input')?.focus();
  }
  function submitQuiz(skipped = false) {
    const round = rounds.quiz;
    if (mode !== 'quiz' || (!skipped && round.selected.length === 0)) return;
    if (!recordResponse(round, round.selected, skipped)) return;
    render();
    $('nextQuizButton').focus();
  }
  function switchMode(nextMode) {
    mode = nextMode;
    if (!rounds[mode]) startRound();
    else render();
  }
  function resetRounds() {
    rounds.flash = null;
    rounds.quiz = null;
    startRound();
  }

  topics.forEach(topic => {
    const option = document.createElement('option');
    option.value = topic.id;
    option.textContent = topic.label;
    $('topicFilter').append(option);
  });
  Object.values(sources).forEach(source => {
    const item = document.createElement('li');
    item.textContent = source.file;
    $('sourceList').append(item);
  });
  $('bankSize').textContent = `${flashcards.length} cards\n${quizzes.length} quiz questions`;
  $('scopeNote').textContent = `${topics.length} topics · Based on your supplied ID1206 materials · Shuffled without repeats within a round`;
  $('flashMode').addEventListener('click', () => switchMode('flash'));
  $('quizMode').addEventListener('click', () => switchMode('quiz'));
  $('topicFilter').addEventListener('change', resetRounds);
  $('difficultyFilter').addEventListener('change', resetRounds);
  $('typeFilter').addEventListener('change', () => { rounds.quiz = null; startRound(); });
  $('restartButton').addEventListener('click', () => startRound());
  $('card').addEventListener('click', flipCard);
  $('flipButton').addEventListener('click', flipCard);
  $('nextCardButton').addEventListener('click', nextQuestion);
  $('quizForm').addEventListener('submit', event => { event.preventDefault(); submitQuiz(); });
  $('skipButton').addEventListener('click', () => submitQuiz(true));
  $('nextQuizButton').addEventListener('click', nextQuestion);
  $('againButton').addEventListener('click', () => startRound());
  $('retryButton').addEventListener('click', () => {
    const missed = new Set(rounds.quiz.responses.filter(response => !response.correct).map(response => response.id));
    startRound(rounds.quiz.questions.filter(question => missed.has(question.id)));
  });
  $('resetFilters').addEventListener('click', () => {
    $('topicFilter').value = 'all';
    $('difficultyFilter').value = 'all';
    $('typeFilter').value = 'all';
    resetRounds();
  });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || mode !== 'flash' || $('flashPanel').hidden) return;
    // Selects and text inputs keep their native navigation. Buttons handle Space natively.
    if (event.target.closest('input,select,textarea,summary,[contenteditable]')) return;
    if (event.key === ' ' && !event.target.closest('button')) { event.preventDefault(); flipCard(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); nextQuestion(); }
  });
  startRound();
})();
