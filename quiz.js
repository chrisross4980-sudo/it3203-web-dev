/* Timed quiz grading, countdown, answer review, and retake behavior. */
(() => {
  const durationMs = 10 * 60 * 1000;
  const form = document.querySelector('#http-quiz');
  const timer = document.querySelector('#quiz-timer');
  const startButton = document.querySelector('#start-quiz');
  const submitButton = document.querySelector('#submit-quiz');
  const retakeButton = document.querySelector('#retake-quiz');
  const results = document.querySelector('#quiz-results');
  const fieldsets = [...form.querySelectorAll('fieldset')];
  let startedAt = null;
  let deadline = null;
  let timerId = null;
  let submitted = false;

  // Each item contains the visible question, accepted values, and a safe response formatter.
  const answerLabels = {
    q2: { GET: 'GET', POST: 'POST', DELETE: 'DELETE', PATCH: 'PATCH' },
    q4: { udp: 'QUIC runs over UDP', qpack: 'HTTP/3 uses QPACK', independent: 'QUIC provides independent streams', tcp: 'HTTP/3 uses TCP' },
    q5: { success: 'The request succeeded', redirect: 'The resource moved permanently', 'not-found': 'The requested resource was not found', 'server-error': 'The server encountered an error' },
    q6: { size: 'A response size limit of 60 bytes', freshness: 'A freshness lifetime of 60 seconds', status: 'A status code to return after 60 seconds', retry: 'A retry delay of 60 minutes' },
    q7: { true: 'True', false: 'False' },
    q8: { hpack: 'HPACK', qpack: 'QPACK', gzip: 'GZIP', brotli: 'Brotli' },
    q9: { dns: 'DNS', tls: 'TLS', html: 'HTML', dhcp: 'DHCP' }
  };
  const questions = [
    { name: 'q1', prompt: 'HTTP is an _____ protocol.', correct: 'application', accepts: ['application', 'app'], format: value => value || 'No answer' },
    { name: 'q2', prompt: 'Which method is commonly used to retrieve a resource?', correct: 'GET', format: value => answerLabels.q2[value] || 'No answer' },
    { name: 'q3', prompt: 'HTTP/2 uses _____ to compress header fields.', correct: 'HPACK', accepts: ['hpack'], format: value => value || 'No answer' },
    { name: 'q4', prompt: 'Which statements about HTTP/3 and QUIC are accurate?', correct: ['independent', 'qpack', 'udp'], format: values => values.length ? values.map(value => answerLabels.q4[value]).join('; ') : 'No answer' },
    { name: 'q5', prompt: 'What does the HTTP status code 404 indicate?', correct: 'not-found', format: value => answerLabels.q5[value] || 'No answer' },
    { name: 'q6', prompt: 'In Cache-Control, what does max-age=60 specify?', correct: 'freshness', format: value => answerLabels.q6[value] || 'No answer' },
    { name: 'q7', prompt: 'HTTP requires the server to remember the previous request from a client.', correct: 'false', format: value => answerLabels.q7[value] || 'No answer' },
    { name: 'q8', prompt: 'Which field-compression format is used by HTTP/3?', correct: 'qpack', format: value => answerLabels.q8[value] || 'No answer' },
    { name: 'q9', prompt: 'Which protocol provides encryption for HTTPS?', correct: 'tls', format: value => answerLabels.q9[value] || 'No answer' },
    { name: 'q10', prompt: 'An HTTP response status in the 5xx class indicates a _____ error.', correct: 'server error', accepts: ['server error', 'server-side error', 'server', 'server-side'], format: value => value || 'No answer' }
  ];

  function readAnswer(name) {
    if (name === 'q4') return [...form.querySelectorAll('input[name="q4"]:checked')].map(input => input.value).sort();
    const field = form.elements.namedItem(name);
    if (!field) return '';
    if (field instanceof RadioNodeList) return field.value;
    return field.value.trim();
  }

  function normalized(value) {
    return String(value).trim().toLowerCase().replace(/[.!?]+$/g, '');
  }

  function isCorrect(question, answer) {
    if (Array.isArray(question.correct)) {
      return Array.isArray(answer) && answer.length === question.correct.length && answer.every((value, index) => value === question.correct[index]);
    }
    const accepted = question.accepts || [question.correct];
    return accepted.some(value => normalized(answer) === normalized(value));
  }

  function formatTime(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  function setTimer() {
    const remaining = Math.max(0, deadline - Date.now());
    timer.textContent = formatTime(remaining);
    if (remaining === 0) gradeQuiz(true);
  }

  function beginQuiz() {
    if (startedAt !== null || submitted) return;
    startedAt = Date.now();
    deadline = startedAt + durationMs;
    fieldsets.forEach(fieldset => { fieldset.disabled = false; });
    startButton.hidden = true;
    submitButton.hidden = false;
    submitButton.disabled = false;
    setTimer();
    timerId = window.setInterval(setTimer, 250);
    form.querySelector('input, select')?.focus({ preventScroll: true });
  }

  // Build the feedback with text nodes so typed answers are displayed safely.
  function addText(parent, tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    parent.append(element);
    return element;
  }

  function gradeQuiz(timeExpired = false) {
    if (submitted) return;
    if (startedAt === null) beginQuiz();
    timeExpired = timeExpired || Date.now() >= deadline;
    submitted = true;
    window.clearInterval(timerId);
    const elapsed = Math.min(Date.now() - startedAt, durationMs);
    let score = 0;
    const reviewed = questions.map(question => {
      const answer = readAnswer(question.name);
      const correct = isCorrect(question, answer);
      if (correct) score += 1;
      return { question, answer, correct };
    });

    const passed = score >= 7;
    results.replaceChildren();
    results.hidden = false;
    results.classList.toggle('is-pass', passed);
    results.classList.toggle('is-fail', !passed);
    addText(results, 'p', 'eyebrow', timeExpired ? 'Time limit reached' : 'Quiz complete');
    addText(results, 'h2', 'result-title', passed ? 'Pass - you met the 70% target' : 'Not passed yet - review and try again');
    addText(results, 'p', 'result-score', `Score: ${score} / 10 (${score * 10}%)`);
    addText(results, 'p', 'result-time', `Time spent: ${formatTime(elapsed)}`);
    addText(results, 'p', 'result-summary', passed ? 'Good work. Review any missed answers below.' : 'A score of 7 / 10 is required to pass. Use the explanations below to guide another review.');
    const reviewHeading = addText(results, 'h3', 'review-heading', 'Question-by-question review');
    reviewHeading.id = 'review-heading';
    const list = document.createElement('ol');
    list.className = 'answer-review';
    list.setAttribute('aria-labelledby', 'review-heading');
    reviewed.forEach(({ question, answer, correct }, index) => {
      const item = document.createElement('li');
      item.className = correct ? 'answer-correct' : 'answer-incorrect';
      addText(item, 'span', 'answer-status', correct ? 'Correct' : 'Incorrect');
      addText(item, 'h4', '', `${String(index + 1).padStart(2, '0')}. ${question.prompt}`);
      addText(item, 'p', '', `Question score: ${correct ? 1 : 0} / 1 point`);
      addText(item, 'p', '', `Your answer: ${question.format(answer)}`);
      const expected = Array.isArray(question.correct)
        ? question.correct.map(value => answerLabels.q4[value]).join('; ')
        : (question.correct === 'application' ? 'Application (or app)' : question.correct === 'HPACK' ? 'HPACK' : question.correct === 'server error' ? 'Server (or server-side) error' : question.name === 'q2' ? answerLabels.q2[question.correct] : question.name === 'q5' ? answerLabels.q5[question.correct] : question.name === 'q6' ? answerLabels.q6[question.correct] : question.name === 'q7' ? answerLabels.q7[question.correct] : question.name === 'q8' ? answerLabels.q8[question.correct] : question.name === 'q9' ? answerLabels.q9[question.correct] : question.correct);
      addText(item, 'p', '', `Correct answer: ${expected}`);
      list.append(item);
    });
    results.append(list);
    fieldsets.forEach(fieldset => { fieldset.disabled = true; });
    submitButton.hidden = true;
    retakeButton.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    gradeQuiz(false);
  });
  startButton.addEventListener('click', beginQuiz);
  retakeButton.addEventListener('click', () => {
    window.clearInterval(timerId);
    form.reset();
    startedAt = null;
    deadline = null;
    submitted = false;
    timer.textContent = '10:00';
    results.replaceChildren();
    results.hidden = true;
    results.classList.remove('is-pass', 'is-fail');
    fieldsets.forEach(fieldset => { fieldset.disabled = true; });
    startButton.hidden = false;
    submitButton.hidden = true;
    retakeButton.hidden = true;
    startButton.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();
