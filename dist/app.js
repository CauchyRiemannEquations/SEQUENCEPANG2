import { kind, adjacent, stars } from './engine.js';
import { levels, chapters } from './levels.js';
import { GameSession } from './session.js';
import { readProgress, saveProgress } from './progress.js';

const $ = id => document.getElementById(id);
const session = new GameSession(levels);
const modal = $('modal');
let selected = [];
let dragging = false, moved = false, start = -1, sound = false, audio;
let resultOpen = false;
let progress = {};
try { progress = readProgress(localStorage, levels); } catch {}
try { sound = localStorage.getItem('sequenstar-sound') === 'on'; } catch {}

function beep(win = false) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(win ? 660 : 440, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(win ? 1320 : 880, audio.currentTime + .13);
    gain.gain.setValueAtTime(.08, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .25);
    oscillator.start();
    oscillator.stop(audio.currentTime + .26);
  } catch {}
}

function message(text, good = false) {
  $('feedback').textContent = text;
  $('feedback').classList.toggle('good', good);
}

function closeModal() {
  resultOpen = false;
  modal.close();
}

function showHome() {
  closeModal();
  dragging = false;
  selected = [];
  $('home').hidden = false;
  $('game').hidden = true;
  $('home-cleared').textContent = levels.filter(level => progress[level.key] === true).length;
  $('home-total').textContent = `/ ${levels.length}`;
  $('start-game').innerHTML = `${session.status === 'playing' ? '계속하기' : '시작하기'} <span aria-hidden="true">▶</span>`;
}

function showGame() {
  closeModal();
  $('home').hidden = true;
  $('game').hidden = false;
  render();
}

function load(index) {
  session.start(index);
  selected = [];
  dragging = false;
  showGame();
  message('별을 모두 모아 보세요');
}

function render() {
  const { board, moves, index, level } = session;
  $('stage-no').textContent = String(index + 1).padStart(2, '0');
  $('moves').textContent = moves;
  $('stage-title').textContent = level.title;
  $('chapter-label').textContent = chapters.find(c => c.id === level.chapter).name;
  $('lesson').hidden = !level.lesson;
  $('lesson').textContent = level.lesson || '';
  $('board').setAttribute('aria-label', `${level.n}×${level.n} 수열 퍼즐판`);
  $('star-count').textContent = `${stars(level.board) - stars(board)} / ${stars(level.board)}`;
  $('board').style.setProperty('--n', level.n);
  $('board').innerHTML = board.map((cell, i) => cell ? `
    <button class="tile${cell.star ? ' starred' : ''}" data-i="${i}"
      aria-label="${Math.floor(i / level.n) + 1}행 ${i % level.n + 1}열, ${cell.v}${cell.star ? ', 별' : ''}" aria-pressed="false">
      <span>${cell.v}</span>${cell.star ? '<span class="star" aria-hidden="true">★</span>' : ''}
    </button>` : '<div class="empty" aria-hidden="true"></div>').join('');
  paint();
}

function paint() {
  document.querySelectorAll('.tile').forEach(element => {
    const i = +element.dataset.i;
    element.classList.toggle('selected', selected.includes(i));
    element.setAttribute('aria-pressed', String(selected.includes(i)));
  });
  const shell = $('board').parentElement.getBoundingClientRect();
  $('lines').querySelector('polyline').setAttribute('points', selected.map(i => {
    const element = $('board').querySelector(`[data-i="${i}"]`);
    if (!element) return '';
    const bounds = element.getBoundingClientRect();
    return `${bounds.x + bounds.width / 2 - shell.x},${bounds.y + bounds.height / 2 - shell.y}`;
  }).join(' '));
  $('submit').hidden = selected.length < 3 || dragging;
}

function pick(i) {
  if (modal.open || session.status !== 'playing' || !session.board[i]) return;
  if (selected.length > 1 && selected.at(-2) === i) selected.pop();
  else if (!selected.includes(i) && (!selected.length || adjacent(selected.at(-1), i, session.level.n))) selected.push(i);
  paint();
  if (selected.length) {
    const values = selected.map(i => session.board[i].v), sequence = kind(values);
    message(`${values.join(' · ')}${sequence ? ' — ' + sequence : ''}`, !!sequence);
  }
}

function commit() {
  if (modal.open || !selected.length) return;
  const result = session.play(selected);
  selected = [];
  if (!result) {
    paint();
    message('등차·등비수열 3개 이상을 연결해 주세요');
    return;
  }
  beep();
  render();
  message(`${result.sequence} 팡!`, true);
  if (result.status === 'cleared') {
    progress[session.level.key] = true;
    try { saveProgress(localStorage, progress); } catch {}
    beep(true);
    showResult(true);
  } else if (result.status === 'failed') showResult(false);
}

function show(content, isResult = false) {
  dragging = false;
  selected = [];
  if (!$('game').hidden) paint();
  resultOpen = isResult;
  $('close-modal').hidden = isResult;
  $('modal-content').innerHTML = content;
  if (!modal.open) modal.showModal();
}

function showResult(won) {
  const finalStage = session.index === levels.length - 1;
  show(`<div class="result-content ${won ? 'cleared' : 'failed'}">
    <div class="result-stage">STAGE ${String(session.index + 1).padStart(2, '0')}</div>
    <div class="result-symbol" aria-hidden="true">${won ? '★ ★ ★' : '☆'}</div>
    <h2 id="modal-title">${won ? '성공!' : '실패!'}</h2>
    <p>${won ? '별을 모두 모았어요.' : (session.moves === 0 ? '남은 횟수를 모두 썼어요.' : '더 이상 연결할 수 없어요.')}</p>
    <button class="primary" id="result-action">${won ? (finalStage ? '스테이지 선택' : '다음 스테이지') : '재도전'}</button>
    <button class="secondary" id="result-home">메인으로</button>
  </div>`, true);
  $('result-action').onclick = () => {
    if (won) {
      if (finalStage) { showHome(); picker(); }
      else load(session.index + 1);
    } else if (session.retry()) {
      selected = [];
      showGame();
      message('숫자 3개 이상을 이어 보세요');
    }
  };
  $('result-home').onclick = showHome;
}

function picker(activeChapter = session.level.chapter) {
  const chapter = chapters.find(c => c.id === activeChapter) || chapters[0];
  const chapterLevels = levels.filter(level => level.chapter === chapter.id);
  const cleared = chapterLevels.filter(level => progress[level.key]).length;
  show(`<div class="eyebrow">CHAPTER SELECT</div><h2 id="modal-title">별을 따라, 한 걸음씩</h2>
    <div class="chapter-tabs" role="group" aria-label="챕터 선택">${chapters.map((c,i) =>
      `<button data-chapter="${c.id}" aria-label="${i+1}장 ${c.name}" aria-pressed="${c.id === chapter.id}"><span aria-hidden="true">${c.symbol}</span> ${String(i+1).padStart(2,'0')}</button>`).join('')}</div>
    <div class="chapter-summary"><div><h3>${chapter.name}</h3><p>${chapter.subtitle}</p></div><strong>${cleared}<small> / ${chapterLevels.length}</small></strong></div>
    <div class="level-grid">${chapterLevels.map(level =>
      `<button data-stage="${level.id-1}" aria-label="스테이지 ${level.id}, ${level.title}${progress[level.key] ? ', 완료' : ''}" class="${level.id-1 === session.index ? 'current ' : ''}${progress[level.key] ? 'done' : ''}">
        ${String(level.id).padStart(2,'0')}<small aria-hidden="true">${progress[level.key] ? '★' : '·'}</small></button>`).join('')}</div>`);
  $('modal-content').querySelectorAll('[data-stage]').forEach(button => button.onclick = () => load(+button.dataset.stage));
  $('modal-content').querySelectorAll('[data-chapter]').forEach(button => button.onclick = () => picker(button.dataset.chapter));
}

function settings() {
  const playing = !$('game').hidden;
  show(`<div class="eyebrow">SEQUENSTAR</div><h2 id="modal-title">설정</h2>
    <div class="settings-list">
      <button id="settings-sound" aria-pressed="${sound}">효과음 <span>${sound ? '켜짐' : '꺼짐'}</span></button>
      ${playing ? '<button id="settings-restart">다시하기 <span>↻</span></button><button id="settings-home">메인화면 <span>⌂</span></button>' : ''}
      <button id="settings-help">게임 방법 <span>?</span></button>
    </div>${playing ? '<p class="settings-note">메인화면으로 나가도 현재 판은 유지돼요.</p>' : ''}`);
  $('settings-sound').onclick = () => { sound = !sound; try { localStorage.setItem('sequenstar-sound', sound ? 'on' : 'off'); } catch {} beep(); settings(); };
  if (playing) {
    $('settings-restart').onclick = () => { session.restart(); showGame(); message('처음부터 다시 시작해요'); };
    $('settings-home').onclick = showHome;
  }
  $('settings-help').onclick = help;
}

function help() {
  show(`<h2 id="modal-title">게임 방법</h2>
    <p>이웃한 숫자 <b>3개 이상</b>을 누른 채로 이으세요. 대각선도 가능해요.</p>
    <p><b>등차</b>　1 → 3 → 5<br><b>등비</b>　2 → 4 → 8</p>
    <p>남은 횟수 안에 <b>★ 별을 모두</b> 모으면 성공! 타일이 사라지면 위의 타일이 내려와요. 새 타일은 생기지 않아요.</p>
    <p>횟수를 다 쓰거나 연결할 수열이 없으면 실패예요. 실패 화면에서 재도전할 수 있어요.</p>
    <p>설정 메뉴에서 다시하기와 메인화면 이동을 할 수 있어요.</p>
    <p>시간제한은 없어요. 잘못된 연결은 횟수를 줄이지 않아요.</p>
    <p>키보드: Tab으로 이동하고 Space로 선택한 다음 ‘선택 완료’를 누르세요.</p>`);
}

$('board').addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || session.status !== 'playing') return;
  const tile = event.target.closest('[data-i]');
  if (!tile) return;
  event.preventDefault();
  start = +tile.dataset.i;
  dragging = true;
  moved = false;
  selected = [];
  pick(start);
  $('board').setPointerCapture(event.pointerId);
});
$('board').addEventListener('pointermove', event => {
  if (!dragging || !event.isPrimary) return;
  const tile = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-i]');
  if (tile && $('board').contains(tile)) {
    const i = +tile.dataset.i;
    if (i !== start) moved = true;
    pick(i);
  }
});
$('board').addEventListener('pointerup', event => {
  if (!dragging || !event.isPrimary) return;
  dragging = false;
  if (moved) commit();
  else { selected = []; paint(); message('누른 채로 숫자 3개 이상을 이으세요'); }
});
$('board').addEventListener('pointercancel', () => {
  dragging = false;
  selected = [];
  paint();
  message('선택을 취소했어요');
});
$('board').addEventListener('click', event => {
  if (event.detail !== 0) return;
  const tile = event.target.closest('[data-i]');
  if (tile) pick(+tile.dataset.i);
});
$('board').addEventListener('keydown', event => {
  if (event.key === 'Escape') { selected = []; paint(); }
  if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); commit(); }
});
$('submit').onclick = commit;
$('start-game').onclick = () => {
  if (session.status === 'playing') { showGame(); message('숫자 3개 이상을 이어 보세요'); }
  else { const next = levels.findIndex(level => !progress[level.key]); load(next === -1 ? 0 : next); }
};
$('game-settings').onclick = settings;
$('home-settings').onclick = settings;
$('stage-picker').onclick = () => picker();
$('close-modal').onclick = closeModal;
modal.addEventListener('cancel', event => { if (resultOpen) event.preventDefault(); });
$('home-help').onclick = help;
window.addEventListener('resize', () => { if (!$('game').hidden) paint(); });
showHome();
