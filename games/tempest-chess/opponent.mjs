import { Chess } from './chess.mjs';

const value = {p:100,n:315,b:330,r:500,q:900,k:0};
function evaluate(game) {
  let score = 0;
  for (const row of game.board()) for (const piece of row) {
    if (!piece) continue;
    const file = piece.square.charCodeAt(0) - 97;
    const rank = Number(piece.square[1]) - 1;
    const center = 7 - Math.abs(file - 3.5) - Math.abs(rank - 3.5);
    const advance = piece.color === 'w' ? rank : 7 - rank;
    const position = piece.type === 'p' ? advance * 5 + center * 2 :
      ('nb'.includes(piece.type) ? center * 8 : 0);
    score += (value[piece.type] + position) * (piece.color === game.turn() ? 1 : -1);
  }
  return score;
}
function ordered(game) {
  const priority = m => (m.includes('#') ? 100 : 0) + (m.includes('x') ? 8 : 0) + (m.includes('+') ? 3 : 0);
  return game.moves().sort((a,b) => priority(b)-priority(a));
}
export function choose(fen, level) {
  const game = new Chess(fen);
  const moves = ordered(game);
  if (!moves.length) return null;
  if (level === 0 && Math.random() < .65) return moves[Math.floor(Math.random()*moves.length)];
  const deadline = performance.now() + [180,700,2200][level];
  const timeout = Symbol();
  function search(depth, alpha, beta, ply) {
    if (performance.now() > deadline) throw timeout;
    if (game.isCheckmate()) return -100000 + ply;
    if (game.isDraw()) return 0;
    if (!depth) return evaluate(game);
    for (const move of ordered(game)) {
      game.move(move);
      let score;
      try { score = -search(depth-1,-beta,-alpha,ply+1); }
      finally { game.undo(); }
      alpha = Math.max(alpha,score);
      if (alpha >= beta) break;
    }
    return alpha;
  }
  let best = moves[0];
  for (let depth=1; depth <= [1,2,4][level]; depth++) {
    let high = -Infinity, candidate = best;
    try {
      for (const move of [best,...moves.filter(m => m !== best)]) {
        game.move(move);
        let score;
        try { score = -search(depth-1,-Infinity,-high,1); }
        finally { game.undo(); }
        if (score > high) { high = score; candidate = move; }
      }
    } catch (error) { if (error !== timeout) throw error; break; }
    best = candidate;
  }
  return best;
}
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = ({data}) => self.postMessage(choose(data.fen,data.level));
}
