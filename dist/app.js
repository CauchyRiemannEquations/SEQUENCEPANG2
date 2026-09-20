import { kind, adjacent, stars } from './engine.js';
import { levels } from './levels.js';
import { GameSession } from './session.js';
import { readProgress, saveProgress, restoreRun, saveRun, nextStageIndex } from './progress.js';

const $ = id => document.getElementById(id);
let session;
try { session = restoreRun(localStorage, levels); } catch {}
session ||= new GameSession(levels);
const modal = $('modal');
let selected = [];
let dragging = false, moved = false, start = -1, sound = false, audio;
let resultOpen = false;
let progress = {};
try { progress = readProgress(localStorage, levels); } catch {}
try { sound = (localStorage.getItem('sequencepang2-sound') ?? localStorage.getItem('sequenstar-sound')) === 'on'; } catch {}
function persistRun() { try { saveRun(localStorage, session); } catch {} }

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
  const next = ['playing', 'failed'].includes(session.status) ? session.index : nextStageIndex(levels, progress);
  $('resume-note').textContent = session.status === 'playing' || next > 0 ? `STAGE ${String(next + 1).padStart(2, '0')}에서 이어서` : (levels.every(l => progress[l.key]) ? '모든 별을 모았어요! 다시 도전해 볼까요?' : '첫 번째 별을 만나러 가요');
}

function showGame() {
  closeModal();
  $('home').hidden = true;
  $('game').hidden = false;
  render();
}

function load(index) {
  session.start(index);
  persistRun();
  selected = [];
  dragging = false;
  showGame();
  message('별을 모두 모아 보세요');
}

function render(previousBoard) {
  const { board, moves, index, level } = session;
  $('stage-no').textContent = String(index + 1).padStart(2, '0');
  $('moves').textContent = moves;
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
  if (previousBoard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const tile of $('board').querySelectorAll('[data-i]')) {
      const i = +tile.dataset.i, before = previousBoard.findIndex(c => c?.id === board[i].id);
      const rows = Math.floor(i / level.n) - Math.floor(before / level.n);
      if (before >= 0 && rows > 0) {
        const gap = parseFloat(getComputedStyle($('board')).gap) || 0;
        tile.style.setProperty('--fall-y', `${-rows * (tile.offsetHeight + gap)}px`);
        tile.classList.add('falling');
      }
    }
  }
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
  const previousBoard = session.board;
  const result = session.play(selected);
  selected = [];
  if (!result) {
    paint();
    message('등차·등비수열 3개 이상을 연결해 주세요');
    return;
  }
  beep();
  render(previousBoard);
  message(`${result.sequence} 팡!`, true);
  if (result.status === 'cleared') {
    progress[session.level.key] = true;
    try { saveProgress(localStorage, progress); } catch {}
    beep(true);
    showResult(true);
  } else if (result.status === 'failed') showResult(false);
  persistRun();
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
    <p>${won ? (finalStage ? '50개의 스테이지, 모든 별을 모았어요!' : '별을 모두 모았어요.') : (session.moves === 0 ? '남은 횟수를 모두 썼어요.' : '더 이상 연결할 수 없어요.')}</p>
    <button class="primary" id="result-action">${won ? (finalStage ? '처음부터 다시 즐기기' : '다음 스테이지') : '재도전'}</button>
    <button class="secondary" id="result-home">메인으로</button>
  </div>`, true);
  $('result-action').onclick = () => {
    if (won) {
      if (finalStage) load(0);
      else load(session.index + 1);
    } else if (session.retry()) {
      persistRun();
      selected = [];
      showGame();
      message('숫자 3개 이상을 이어 보세요');
    }
  };
  $('result-home').onclick = showHome;
}

function settings() {
  const playing = !$('game').hidden;
  show(`<h2 id="modal-title">설정</h2>
    <div class="settings-list">
      <button id="settings-sound" aria-pressed="${sound}">효과음 <span>${sound ? '켜짐' : '꺼짐'}</span></button>
      ${playing ? '<button id="settings-restart">다시하기 <span>↻</span></button><button id="settings-home">메인화면 <span>⌂</span></button>' : ''}
      <button id="settings-help">게임 방법 <span>?</span></button>
    </div>${playing ? '<p class="settings-note">현재 판은 이 기기에 자동으로 저장돼요.</p>' : ''}`);
  $('settings-sound').onclick = () => { sound = !sound; try { localStorage.setItem('sequencepang2-sound', sound ? 'on' : 'off'); } catch {} beep(); settings(); };
  if (playing) {
    $('settings-restart').onclick = () => { session.restart(); persistRun(); showGame(); message('처음부터 다시 시작해요'); };
    $('settings-home').onclick = showHome;
  }
  $('settings-help').onclick = () => help();
}

function help(active = 'arithmetic') {
  const demos = {
    arithmetic: { title: '등차수열', values: [1, 2, 3], caption: '1 → 2 → 3 · 공차 +1', copy: '숫자가 같은 간격으로 변하면 연결할 수 있어요. <b>6 → 6 → 6</b>처럼 같은 숫자도 가능해요.' },
    geometric: { title: '등비수열', values: [2, 4, 8], caption: '2 → 4 → 8 · 공비 ×2', copy: '같은 수를 계속 곱해도 연결할 수 있어요. <b>9 → 3 → 1</b>처럼 작아지는 방향도 괜찮아요.' },
    gravity: { title: '별과 낙하', caption: '지우면 위의 숫자가 아래로!', copy: '제한된 이동 안에 <b>★ 붙은 타일을 모두</b> 모으세요. 별 없는 숫자는 남아도 돼요. 새 타일은 생기지 않아요.' }
  };
  const d = demos[active];
  show(`<h2 id="modal-title">플레이 방법</h2>
    <div class="help-tabs" role="group" aria-label="설명 선택">${Object.entries(demos).map(([key, demo]) => `<button data-demo="${key}" aria-pressed="${key === active}">${demo.title}</button>`).join('')}</div>
    <div class="help-demo" aria-label="${active === 'gravity' ? '아래쪽 1, 2, 3이 사라지고 위쪽 2, 4, 8이 내려오는 시범' : `${d.values.join(', ')}을 차례로 드래그하는 시범`}">
      ${active === 'gravity' ? `<div class="gravity-demo" aria-hidden="true">${[2,4,8,1,2,3].map((v,i) => `<span class="demo-tile">${v}${i === 3 || i === 5 ? '<b class="demo-star">★</b>' : ''}</span>`).join('')}</div>` : `<div class="demo-track" aria-hidden="true">${d.values.map((v,i) => `<span class="demo-tile">${v}${i === 2 ? '<b class="demo-star">★</b>' : ''}</span>`).join('')}<i class="demo-stroke"></i><span class="demo-hand">☝</span></div>`}
      <div class="demo-caption">${d.caption}</div><p class="motion-caption">${active === 'gravity' ? '아랫줄을 지우면 윗줄이 한 칸 내려와요.' : '왼쪽부터 오른쪽까지 누른 채로 이어요.'}</p>
    </div>
    <button id="demo-toggle" class="demo-toggle" aria-pressed="false">시범 멈추기</button>
    <p class="help-copy">${d.copy}</p>
    <p class="help-note">이웃한 숫자 <b>3개 이상</b>을 누른 채로 이어요. 대각선과 꺾이는 길도 가능해요. 잘못된 연결은 이동을 쓰지 않아요.</p>
    <p class="help-keyboard">키보드: Tab으로 이동 → Space로 선택 → 선택 완료. 시간제한은 없어요.</p>`);
  $('modal-content').querySelectorAll('[data-demo]').forEach(button => button.onclick = () => help(button.dataset.demo));
  $('demo-toggle').onclick = () => {
    const paused = $('modal-content').querySelector('.help-demo').classList.toggle('paused');
    $('demo-toggle').setAttribute('aria-pressed', String(paused));
    $('demo-toggle').textContent = paused ? '시범 재생하기' : '시범 멈추기';
  };
}

$('board').addEventListener('pointerdown', event => {
  if (modal.open || event.button !== 0 || !event.isPrimary || session.status !== 'playing') return;
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
  else if (session.status === 'failed') load(session.index);
  else load(nextStageIndex(levels, progress));
};
$('game-settings').onclick = settings;
$('home-settings').onclick = settings;
$('game-home').onclick = showHome;
$('game-help').onclick = () => help();
$('close-modal').onclick = closeModal;
modal.addEventListener('cancel', event => { if (resultOpen) event.preventDefault(); });
$('home-help').onclick = () => help();
window.addEventListener('pagehide', persistRun);
window.addEventListener('resize', () => { if (!$('game').hidden) paint(); });
showHome();
