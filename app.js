(function () {
  'use strict';
  const { topics, sources, flashcards, quizzes } = globalThis.ID1206_DATA;
  const { filterBank, createRound, currentState, moveRound, recordResponse, sourceLinks } = globalThis.StudyCore;
  const $ = id => document.getElementById(id);
  const labels = Object.fromEntries(topics.map(topic => [topic.id, topic.label]));
  const levelLabel = { foundation: 'Foundation', application: 'Application' };
  let mode = 'flash';
  const rounds = { flash: null, quiz: null };
  let selectedTopics = new Set(topics.map(topic => topic.id));

  function filters(forMode = mode) {
    return { topics: [...selectedTopics], difficulty: $('difficultyFilter').value,
      type: forMode === 'quiz' ? $('typeFilter').value : 'all' };
  }
  function pool(forMode = mode) {
    return filterBank(forMode === 'flash' ? flashcards : quizzes, filters(forMode));
  }
  function renderSource(container, question) {
    container.replaceChildren(`Source: ${sources[question.source].file} · `);
    sourceLinks(question, sources).forEach((source, index) => {
      if (index) container.append(' · ');
      const link = document.createElement('a');
      link.href = source.href;
      link.textContent = source.label;
      link.setAttribute('aria-label', source.title);
      link.target = '_blank';
      link.rel = 'noopener';
      container.append(link);
    });
  }
  function metaText(question) {
    return `${labels[question.topic]} · ${levelLabel[question.difficulty]}`;
  }
  function startRound(questions = pool()) {
    rounds[mode] = createRound(questions);
    render();
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
    const state = currentState(round);
    $('cardMeta').textContent = metaText(question);
    $('sideLabel').textContent = state.showingAnswer ? 'Answer' : 'Question';
    $('cardText').textContent = state.showingAnswer ? question.answer : question.question;
    $('cardHint').textContent = state.showingAnswer ? 'Click to see the question again' : 'Click to reveal the answer';
    $('card').classList.toggle('answer', state.showingAnswer);
    $('card').setAttribute('aria-label', `${state.showingAnswer ? 'Answer' : 'Question'}: ${state.showingAnswer ? question.answer : question.question}. ${state.showingAnswer ? 'Show question' : 'Reveal answer'}.`);
    renderSource($('flashSource'), question);
    $('flashSource').hidden = !state.showingAnswer;
    $('flipButton').textContent = state.showingAnswer ? 'Show question' : 'Show answer';
    $('previousCardButton').disabled = round.position === 0;
    $('nextCardButton').textContent = round.position === round.questions.length - 1 ? 'Finish round →' : 'Next card →';
  }
  function renderQuiz(round) {
    const question = round.questions[round.position];
    const state = currentState(round);
    $('quizMeta').textContent = metaText(question);
    $('quizType').textContent = question.type === 'multiple' ? 'Multiple answers' : 'Single answer';
    $('quizQuestion').textContent = question.question;
    $('selectionHint').textContent = question.type === 'multiple' ? 'Select all that apply. There may be more than one correct answer.' : 'Choose one answer.';
    $('quizFieldset').setAttribute('aria-describedby', 'selectionHint');
    $('options').replaceChildren();
    state.options.forEach(option => {
      const label = document.createElement('label');
      label.className = 'option';
      const input = document.createElement('input');
      input.type = question.type === 'multiple' ? 'checkbox' : 'radio';
      input.name = 'answer';
      input.value = option.index;
      input.checked = state.selected.includes(option.index);
      input.disabled = state.submitted;
      const text = document.createElement('span');
      text.className = 'option-text';
      text.textContent = option.text;
      label.append(input, text);
      if (state.submitted) {
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
        state.selected = [...$('options').querySelectorAll('input:checked')].map(element => Number(element.value));
        $('checkButton').disabled = state.selected.length === 0;
      });
      $('options').append(label);
    });
    $('feedback').hidden = !state.submitted;
    if (state.submitted) {
      const response = round.responses.find(response => response.id === question.id);
      $('feedback').className = `feedback ${response.correct ? 'good' : 'bad'}`;
      $('feedbackTitle').textContent = response.skipped ? 'Skipped · review the answer' : response.correct ? 'Correct' : 'Not quite · review the answer';
      $('explanation').textContent = question.explanation;
      renderSource($('quizSource'), question);
    }
    $('checkButton').hidden = state.submitted;
    $('checkButton').disabled = state.selected.length === 0;
    $('skipButton').hidden = state.submitted;
    $('nextQuizButton').hidden = !state.submitted;
    $('previousQuizButton').disabled = round.position === 0;
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
    $('backToLastButton').textContent = isQuiz ? '← Back to last question' : '← Back to last card';
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
    const state = currentState(round);
    state.showingAnswer = !state.showingAnswer;
    renderFlash(round);
  }
  function nextQuestion() {
    const round = rounds[mode];
    if (!round.questions[round.position] || (mode === 'quiz' && !currentState(round).submitted)) return;
    moveRound(round, 1);
    render();
    if (round.position === round.questions.length) $('summaryTitle').focus();
    else focusQuestion();
  }
  function focusQuestion() {
    if (mode === 'flash') $('card').focus();
    else if (currentState(rounds.quiz).submitted) $('nextQuizButton').focus();
    else $('options').querySelector('input')?.focus();
  }
  function previousQuestion() {
    if (!moveRound(rounds[mode], -1)) return;
    render();
    focusQuestion();
  }
  function submitQuiz(skipped = false) {
    const round = rounds.quiz;
    const state = round && currentState(round);
    if (mode !== 'quiz' || !state || (!skipped && state.selected.length === 0)) return;
    if (!recordResponse(round, state.selected, skipped)) return;
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

  function syncTopics() {
    const selected = topics.filter(topic => selectedTopics.has(topic.id));
    $('topicSummaryText').textContent = selected.length === topics.length ? 'All topics' :
      selected.length === 0 ? 'Select topics' : selected.length === 1 ? selected[0].label : `${selected.length} topics selected`;
    $('topicSummary').title = selected.map(topic => topic.label).join(', ');
    $('topicOptions').querySelectorAll('input').forEach(input => { input.checked = selectedTopics.has(input.value); });
  }
  function setTopics(ids) {
    selectedTopics = new Set(ids);
    syncTopics();
    resetRounds();
  }
  topics.forEach(topic => {
    const label = document.createElement('label');
    label.className = 'topic-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = topic.id;
    input.checked = true;
    const text = document.createElement('span');
    text.textContent = topic.label;
    label.append(input, text);
    input.addEventListener('change', () => {
      if (input.checked) selectedTopics.add(topic.id);
      else selectedTopics.delete(topic.id);
      syncTopics();
      resetRounds();
    });
    $('topicOptions').append(label);
  });
  Object.values(sources).forEach(source => {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `data/${encodeURIComponent(source.file)}`;
    link.textContent = source.file;
    link.target = '_blank';
    link.rel = 'noopener';
    item.append(link);
    $('sourceList').append(item);
  });
  $('bankSize').textContent = `${flashcards.length} cards\n${quizzes.length} quiz questions`;
  $('scopeNote').textContent = `${topics.length} topics · Based on your supplied ID1206 materials · Shuffled without repeats within a round`;
  $('flashMode').addEventListener('click', () => switchMode('flash'));
  $('quizMode').addEventListener('click', () => switchMode('quiz'));
  $('selectAllTopics').addEventListener('click', () => setTopics(topics.map(topic => topic.id)));
  $('clearTopics').addEventListener('click', () => setTopics([]));
  $('difficultyFilter').addEventListener('change', resetRounds);
  $('typeFilter').addEventListener('change', () => { rounds.quiz = null; startRound(); });
  $('restartButton').addEventListener('click', () => startRound());
  $('card').addEventListener('click', flipCard);
  $('flipButton').addEventListener('click', flipCard);
  $('nextCardButton').addEventListener('click', nextQuestion);
  $('previousCardButton').addEventListener('click', previousQuestion);
  $('previousQuizButton').addEventListener('click', previousQuestion);
  $('backToLastButton').addEventListener('click', previousQuestion);
  $('quizForm').addEventListener('submit', event => { event.preventDefault(); submitQuiz(); });
  $('skipButton').addEventListener('click', () => submitQuiz(true));
  $('nextQuizButton').addEventListener('click', nextQuestion);
  $('againButton').addEventListener('click', () => startRound());
  $('retryButton').addEventListener('click', () => {
    const missed = new Set(rounds.quiz.responses.filter(response => !response.correct).map(response => response.id));
    startRound(rounds.quiz.questions.filter(question => missed.has(question.id)));
  });
  $('resetFilters').addEventListener('click', () => {
    selectedTopics = new Set(topics.map(topic => topic.id));
    syncTopics();
    $('difficultyFilter').value = 'all';
    $('typeFilter').value = 'all';
    resetRounds();
  });
  document.addEventListener('click', event => {
    if (!$('topicPicker').contains(event.target)) $('topicPicker').open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && $('topicPicker').open) {
      $('topicPicker').open = false;
      $('topicSummary').focus();
      return;
    }
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || $('topicPicker').open || $('emptyPanel').hidden === false) return;
    // Selects and text inputs keep their native navigation. Buttons handle Space natively.
    if (event.target.closest('input,select,textarea,summary,[contenteditable]')) return;
    if (event.key === ' ' && mode === 'flash' && !$('flashPanel').hidden && !event.target.closest('button,a')) { event.preventDefault(); flipCard(); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); previousQuestion(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); nextQuestion(); }
  });
  startRound();
})();
