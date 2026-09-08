// Ninefall rules engine — a faithful JavaScript port of NinefallCore.
//
// Ported from ios/NinefallCore/Sources/NinefallCore/{Board,GameState,Level,
// BoardCode}.swift. The cascade is breadth-first, values never change mid
// cascade, and the outcome is order-independent and deterministic, exactly as
// in the shipping app (GDD §2.4). Keep this file in step with the Swift.

export const KIND = {
  normal: 'normal',   // placeable, cascadable
  stone: 'stone',     // inert: never flips, blocks cascades, not needed to win
  sealed: 'sealed',   // not a placement target; only a cascade flips it
  ice: 'ice',         // a cascade cracks it first and flips it second
  bomb: 'bomb',       // when it flips it force-flips all four neighbours
  trap: 'trap',       // must stay unflipped; flipping one fails the level
  portal: 'portal',   // entangled pair: one flips, its twin flips with it
  shifter: 'shifter', // gains +1 (mod 10) after every placement while unflipped
};

/** The value ramp from ios/Ninefall/Theme.swift. Luminance-monotonic and
 *  identical in both themes: the chips are physical objects, only the room's
 *  light changes. */
export const RAMP = {
  flipped: ['#F2E7CE', '#F1DCAC', '#F0CE8F', '#ECBB78', '#E6A468',
            '#DC875C', '#CE6A52', '#B95349', '#994145', '#6F303F'],
  muted:   ['#EFE9DA', '#EDE2C9', '#EAD8B7', '#E5CBA5', '#DEBB97',
            '#D3A489', '#C28E7E', '#AC7973', '#92686B', '#6E555D'],
  inkFlipped: (v) => (v > 5 ? '#FFF3E1' : '#43322B'),
  inkMuted:   (v) => (v > 6 ? '#F5EBDA' : '#54443A'),
  stoneTop: '#93846F',
  stoneBottom: '#6E6152',
};

export function parseCell(spec) {
  if (spec === '#') return tile(0, KIND.stone);
  const digits = spec.match(/^\d*/)[0];
  const value = digits.length ? parseInt(digits, 10) : 0;
  switch (spec.slice(digits.length)) {
    case '':   return tile(value);
    case 's':  return tile(value, KIND.sealed);
    case 'i':  return tile(value, KIND.ice);
    case 'b':  return tile(value, KIND.bomb);
    case 't':  return tile(value, KIND.trap);
    case 'f':  return tile(value, KIND.shifter);
    case 'g':  return { ...tile(value), hasGem: true };
    case 'p0': return { ...tile(value, KIND.portal), portalID: 0 };
    case 'p1': return { ...tile(value, KIND.portal), portalID: 1 };
    default:   return tile(value);
  }
}

function tile(value, kind = KIND.normal) {
  return { value, kind, isFlipped: false, isCracked: false, hasGem: false, portalID: null };
}

export class Board {
  constructor(rows, cols, tiles) {
    this.rows = rows; this.cols = cols; this.tiles = tiles;
  }
  static fromSpecs(rows, cols, specs) {
    return new Board(rows, cols, specs.map(parseCell));
  }
  clone() {
    return new Board(this.rows, this.cols, this.tiles.map((t) => ({ ...t })));
  }
  /** Cardinal neighbours only. No diagonals, ever (GDD §2.1). */
  neighbors(i) {
    const r = (i / this.cols) | 0, c = i % this.cols, out = [];
    if (r > 0) out.push(i - this.cols);
    if (r < this.rows - 1) out.push(i + this.cols);
    if (c > 0) out.push(i - 1);
    if (c < this.cols - 1) out.push(i + 1);
    return out;
  }
  twin(i) {
    const id = this.tiles[i].portalID;
    if (id == null) return null;
    const j = this.tiles.findIndex((t, k) => k !== i && t.portalID === id);
    return j === -1 ? null : j;
  }
}

export class GameState {
  constructor(board, rack) {
    this.board = board;
    this.rack = rack.slice();
    this.moves = 0;
    this.bestChain = 0;
    this.history = [];
    this.initial = { board: board.clone(), rack: rack.slice() };
  }

  /** Win: every flippable tile flipped, every trap left unflipped. Stones
   *  don't count (GDD §2.6). */
  get isWon() {
    return this.board.tiles.every((t) => {
      if (t.kind === KIND.stone) return true;
      if (t.kind === KIND.trap) return !t.isFlipped;
      return t.isFlipped;
    });
  }
  get isFailed() {
    return this.board.tiles.some((t) => t.kind === KIND.trap && t.isFlipped);
  }
  get remainingFlippable() {
    return this.board.tiles.filter(
      (t) => t.kind !== KIND.stone && t.kind !== KIND.trap && !t.isFlipped).length;
  }
  get isStuck() { return this.rack.length === 0 && !this.isWon && !this.isFailed; }
  get canUndo() { return this.history.length > 0; }

  /** Anything but stones (inert) and sealed tiles (cascade-only). Placing on a
   *  trap is allowed, and fails the level: deliberate risk, instant undo. */
  canTarget(i) {
    const t = this.board.tiles[i];
    return !!t && t.kind !== KIND.stone && t.kind !== KIND.sealed;
  }

  /** First-ring preview for the ghost UI, deliberately not the full chain. */
  preview(handValue, i) {
    if (!this.canTarget(i)) return null;
    const result = (this.board.tiles[i].value + handValue) % 10;
    const forced = this.board.tiles[i].kind === KIND.bomb;
    const firstRing = this.board.neighbors(i).filter((n) => {
      const t = this.board.tiles[n];
      if (t.isFlipped || t.kind === KIND.stone) return false;
      return forced || t.value < result;
    });
    return { result, firstRing };
  }

  place(rackIndex, target) {
    if (rackIndex < 0 || rackIndex >= this.rack.length) return null;
    if (!this.canTarget(target) || this.isFailed) return null;

    this.history.push({
      board: this.board.clone(), rack: this.rack.slice(),
      moves: this.moves, bestChain: this.bestChain,
    });

    const played = this.rack[rackIndex];
    const remainingBefore = this.remainingFlippable;
    const t0 = this.board.tiles[target];
    const wasOverplay = t0.isFlipped;
    t0.value = (t0.value + played) % 10;

    const gems = [], sprungTraps = [], waves = [], cracks = [];
    const tiles = this.board.tiles;

    // Flip a tile, collect its gem, spring its trap, entangle its portal twin.
    const settle = (i) => {
      if (tiles[i].isFlipped) return [];
      tiles[i].isFlipped = true;
      if (tiles[i].hasGem) { tiles[i].hasGem = false; gems.push(i); }
      if (tiles[i].kind === KIND.trap) sprungTraps.push(i);
      let out = [i];
      const twin = tiles[i].kind === KIND.portal ? this.board.twin(i) : null;
      if (twin != null && !tiles[twin].isFlipped) out = out.concat(settle(twin));
      return out;
    };

    // The placed tile flips outright: placement is force. It smashes uncracked
    // ice, springs traps, and pulls portal twins with it.
    let seeds;
    if (wasOverplay) {
      seeds = [target];
    } else {
      const settled = settle(target);
      seeds = settled;
      const coFlips = settled.filter((i) => i !== target);
      if (coFlips.length) { waves.push(coFlips); cracks.push([]); }
    }

    let frontier = seeds;
    while (frontier.length) {
      const flipped = [], cracked = [];
      for (const t of frontier) {
        const forced = tiles[t].kind === KIND.bomb;
        const tv = tiles[t].value;
        for (const n of this.board.neighbors(t)) {
          const c = tiles[n];
          if (c.isFlipped || c.kind === KIND.stone) continue;
          if (!forced && c.value >= tv) continue;
          if (c.kind === KIND.ice && !c.isCracked) {
            c.isCracked = true; cracked.push(n); continue;
          }
          flipped.push(...settle(n));
        }
      }
      if (flipped.length || cracked.length) { waves.push(flipped); cracks.push(cracked); }
      frontier = flipped;
    }

    // Shifters drift once the cascade settles: every still-unflipped shifter
    // gains +1 (mod 10). Flipped shifters freeze. Ticking after the loop keeps
    // the values-never-change-mid-cascade invariant.
    const shifted = [];
    tiles.forEach((t, i) => {
      if (t.kind === KIND.shifter && !t.isFlipped) {
        t.value = (t.value + 1) % 10;
        shifted.push(i);
      }
    });

    this.rack.splice(rackIndex, 1);
    this.moves += 1;

    const chain = waves.reduce((n, w) => n + w.length, 0);
    this.bestChain = Math.max(this.bestChain, chain);

    return {
      target, playedValue: played, newValue: tiles[target].value, wasOverplay,
      waves, cracks, gems, sprungTraps, shifted, remainingBefore,
      clearedBoard: this.isWon, chain,
      isGrandCascade: this.isWon && remainingBefore >= 5,
      didRollover: tiles[target].value < played,
    };
  }

  undo() {
    const snap = this.history.pop();
    if (!snap) return false;
    this.board = snap.board; this.rack = snap.rack;
    this.moves = snap.moves; this.bestChain = snap.bestChain;
    return true;
  }

  reset() {
    this.board = this.initial.board.clone();
    this.rack = this.initial.rack.slice();
    this.moves = 0; this.bestChain = 0; this.history = [];
  }
}

// ---------------------------------------------------------------------------
// Board codes — the payload behind every shared challenge link.
// Mirrors BoardCode.swift: base64url of "1;rows;cols;par;flourish;cells;hand".

export const BOARD_CODE_VERSION = 1;
const MAX_TILES = 42;

export function decodeBoardCode(code) {
  let raw;
  try {
    let b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    raw = new TextDecoder().decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
  } catch { return null; }

  const parts = raw.split(';');
  if (parts.length !== 7) return null;
  if (parseInt(parts[0], 10) !== BOARD_CODE_VERSION) return null;

  const rows = parseInt(parts[1], 10), cols = parseInt(parts[2], 10);
  if (!(rows > 0 && cols > 0) || rows * cols > MAX_TILES) return null;

  const parRaw = parseInt(parts[3], 10);
  const par = Number.isNaN(parRaw) || parRaw < 0 ? null : parRaw;
  const cells = parts[5].split(',');
  const hand = parts[6].split(',').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));

  if (cells.length !== rows * cols || hand.length === 0) return null;
  return { rows, cols, par, flourish: parts[4] || null, cellSpecs: cells, hand };
}

export function encodeBoardCode(level) {
  const raw = [BOARD_CODE_VERSION, level.rows, level.cols,
               level.par == null ? -1 : level.par, level.flourish || '',
               level.cellSpecs.join(','), level.hand.join(',')].join(';');
  const bytes = new TextEncoder().encode(raw);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
