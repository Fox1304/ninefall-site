// A playable Ninefall board, rendered straight from the shared rules engine.
// Same cascade, same rollover, same win condition as the app on your phone.

import { GameState, Board, RAMP, KIND } from './engine.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const WAVE_MS = REDUCED ? 0 : 170;

/** A tile shows two faces: `down` is the sunken pre-move value, `up` is the
 *  enamelled chip it becomes. They differ only on the tile you just played. */
function tileVars(downVal, upVal) {
  return `--m:${RAMP.muted[downVal]};--mi:${RAMP.inkMuted(downVal)};` +
         `--v:${RAMP.flipped[upVal]};--vi:${RAMP.inkFlipped(upVal)};` +
         `--stone-top:${RAMP.stoneTop};--stone-bottom:${RAMP.stoneBottom}`;
}

const KIND_LABEL = {
  stone: 'stone, never flips', sealed: 'sealed, cascade only',
  ice: 'ice, cracks first', bomb: 'bomb, flips all four neighbours',
  trap: 'trap, must not flip', portal: 'wormhole', shifter: 'shifter, grows each move',
};

export function mountBoard(root, level, opts = {}) {
  const spec = { par: null, flourish: null, ...level };
  const game = new GameState(Board.fromSpecs(spec.rows, spec.cols, spec.cellSpecs), spec.hand);
  let selected = 0;
  let busy = false;

  root.innerHTML = `
    <div class="board-shell">
      <div class="board" role="group" aria-label="Ninefall board"></div>
    </div>
    <div class="rack" role="group" aria-label="Your hand"></div>
    <p class="demo-status" role="status" aria-live="polite"></p>
    <div class="demo-bar"></div>`;

  const elBoard  = root.querySelector('.board');
  const elRack   = root.querySelector('.rack');
  const elStatus = root.querySelector('.demo-status');
  const elBar    = root.querySelector('.demo-bar');

  elBoard.style.gridTemplateColumns = `repeat(${spec.cols},minmax(0,1fr))`;
  elBar.innerHTML =
    `<button class="btn btn-ghost btn-sm" data-act="undo">Undo</button>
     <button class="btn btn-ghost btn-sm" data-act="reset">Start again</button>`;

  const say = (html) => { elStatus.innerHTML = html; };

  /** `anim` renders the board as it looked *before* the last placement, so the
   *  flips can then be played back wave by wave. */
  function render(anim) {
    elBoard.innerHTML = '';
    game.board.tiles.forEach((t, i) => {
      const down = anim ? anim.downValues[i] : t.value;
      const flipped = anim ? anim.flippedBefore[i] : t.isFlipped;
      const b = document.createElement('button');
      b.className = 'tile' + (flipped ? ' is-flipped' : '') +
        (t.kind === KIND.stone ? ' stone' : '') + (t.hasGem ? ' gem' : '') +
        (game.canTarget(i) && !t.isFlipped ? ' playable' : '');
      b.style.cssText = tileVars(down, t.value);
      b.dataset.i = i;
      b.disabled = !game.canTarget(i) || busy;
      const kind = t.kind !== KIND.normal ? `, ${KIND_LABEL[t.kind]}` : '';
      b.setAttribute('aria-label',
        `${t.kind === KIND.stone ? 'Stone' : t.value}${kind}, ${t.isFlipped ? 'flipped' : 'unflipped'}`);
      b.innerHTML = `<span class="face down">${t.kind === KIND.stone ? '' : down}</span>` +
                    `<span class="face up">${t.value}</span>`;
      elBoard.appendChild(b);
    });

    elRack.innerHTML = '';
    game.rack.forEach((v, i) => {
      const b = document.createElement('button');
      b.className = 'tile' + (i === selected ? ' sel' : '');
      b.style.cssText = tileVars(v, v);
      b.dataset.r = i;
      b.disabled = busy;
      b.setAttribute('aria-label', `Play the ${v}`);
      b.setAttribute('aria-pressed', String(i === selected));
      b.innerHTML = `<span class="face up">${v}</span>`;
      elRack.appendChild(b);
    });
    for (let i = game.rack.length; i < spec.hand.length; i++) {
      const s = document.createElement('div');
      s.className = 'slot'; s.setAttribute('aria-hidden', 'true');
      elRack.appendChild(s);
    }
  }

  elBar.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (busy || !act) return;
    if (act === 'undo') { if (!game.undo()) return; } else game.reset();
    selected = 0; render();
    say(act === 'undo' ? 'Taken back. Undo is unlimited, here and in the app.' : (opts.intro || ''));
  });

  elRack.addEventListener('click', (e) => {
    const r = e.target.closest('[data-r]');
    if (!r || busy) return;
    selected = +r.dataset.r; render();
  });

  // Ghost preview: the first ring only, exactly as the app shows it.
  elBoard.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-i]');
    if (!el || busy || REDUCED) return;
    const p = game.preview(game.rack[selected], +el.dataset.i);
    if (!p) return;
    el.classList.add('is-target');
    p.firstRing.forEach((n) => elBoard.children[n]?.classList.add('is-ghost'));
  });
  const clearGhost = () =>
    [...elBoard.children].forEach((c) => c.classList.remove('is-target', 'is-ghost'));
  elBoard.addEventListener('pointerout', clearGhost);

  elBoard.addEventListener('click', (e) => {
    const el = e.target.closest('[data-i]');
    if (el && !busy) play(+el.dataset.i);
  });

  function play(target) {
    const downValues = game.board.tiles.map((t) => t.value);
    const flippedBefore = game.board.tiles.map((t) => t.isFlipped);
    const o = game.place(selected, target);
    if (!o) return;

    selected = 0; busy = true;
    clearGhost();
    render({ downValues, flippedBefore });

    // The placed tile (with any portal twin) settles first, then the engine's
    // breadth-first waves follow, one beat apart.
    const groups = [];
    let waves = o.waves;
    if (!o.wasOverplay) {
      let first = [target];
      if (game.board.tiles[target].kind === KIND.portal && waves.length) {
        first = first.concat(waves[0]); waves = waves.slice(1);
      }
      groups.push(first);
    }
    waves.forEach((w) => { if (w.length) groups.push(w); });

    groups.forEach((g, k) => setTimeout(
      () => g.forEach((i) => elBoard.children[i]?.classList.add('is-flipped')), k * WAVE_MS));

    setTimeout(() => {
      busy = false; render(); say(message(o));
      opts.onOutcome?.(o, game);
    }, groups.length * WAVE_MS + (REDUCED ? 0 : 280));
  }

  function message(o) {
    const before = (o.newValue - o.playedValue + 10) % 10;
    if (o.sprungTraps.length) return `You flipped a trap. <b>Undo</b>, and go around it.`;
    if (o.isGrandCascade)
      return `<b class="win">GRAND CASCADE.</b> One move, the whole board. That is the whole game.`;
    if (o.clearedBoard) return `<b class="win">Cleared</b> in ${game.moves} move${game.moves > 1 ? 's' : ''}.`;

    let msg;
    if (o.didRollover && o.chain === 0) {
      msg = `<b>${before} + ${o.playedValue} = ${o.newValue}.</b> Past nine it rolled over, ` +
            `so there was nothing left to topple. Greed has a price.`;
    } else if (o.didRollover) {
      msg = `Rolled over to <b>${o.newValue}</b>, and toppled ${o.chain}.`;
    } else if (o.chain === 0) {
      msg = `It flipped, but nothing followed. A chain only runs downhill.`;
    } else {
      msg = `Chain of <b>${o.chain}</b>. ${game.remainingFlippable} ` +
            `tile${game.remainingFlippable === 1 ? '' : 's'} still standing.`;
    }
    // Running out of tiles has to be said even when the last move did something
    // worth reporting, or the board just sits there looking unfinished.
    if (game.isStuck) msg += ` Out of tiles: <b>undo</b>, or start again.`;
    return msg;
  }

  render(); say(opts.intro || '');
  return { reset() { game.reset(); selected = 0; render(); say(opts.intro || ''); } };
}
