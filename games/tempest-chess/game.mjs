import { Chess } from './chess.mjs';
const game = new Chess();
const el = id => document.getElementById(id);
const level = el('level'), board = el('board');
const names = {p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'};
const pieces = {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'};
const bios = ['Gobta plays by instinct and often overlooks an open piece.','Benimaru weighs material and looks for your reply before committing.','Raphael calculates several moves ahead when the position allows.'];
const key = 'sohstx.tempest-chess.v1';
let selected = null, options = [], worker, promotion = [];
try {
  const saved = JSON.parse(localStorage.getItem(key));
  if (saved) {
    for (const san of saved.moves) game.move(san);
    if (['0','1','2'].includes(saved.level)) level.value = saved.level;
  }
} catch { game.reset(); }
function save() {
  try { localStorage.setItem(key,JSON.stringify({moves:game.history(),level:level.value})); } catch {}
}
function clearSelection() { selected=null; options=[]; promotion=[]; }
function draw() {
  const name = level.selectedOptions[0].text.split(' ·')[0];
  let status = game.turn()==='w' ? 'Your move' : name+' is thinking…';
  if (game.isCheckmate()) status = game.turn()==='b' ? 'Checkmate · You win' : 'Checkmate · '+name+' wins';
  else if (game.isStalemate()) status = 'Draw · Stalemate';
  else if (game.isThreefoldRepetition()) status = 'Draw · Repetition';
  else if (game.isInsufficientMaterial()) status = 'Draw · Insufficient material';
  else if (game.isDraw()) status = 'Draw · Fifty-move rule';
  else if (game.isCheck()) status += ' · Check';
  el('status').textContent=status;
  el('bio').textContent=bios[level.value];
  const history=game.history({verbose:true}), last=history.at(-1);
  el('undo').disabled=!last;
  el('record').textContent=history.map((m,i)=> (i%2===0 ? (i/2+1)+'. ' : '')+m.san).join('  ') || 'Opening position';
  el('record').scrollTop=el('record').scrollHeight;
  const squares = document.createDocumentFragment();
  for (let rank=8; rank>=1; rank--) for (let file=0; file<8; file++) {
    const letter='abcdefgh'[file], id=letter+rank, piece=game.get(id);
    const btn=document.createElement('button');
    btn.type='button'; btn.dataset.square=id;
    btn.className=['sq',(rank+file)%2?'dark':'',selected===id?'selected':'',options.some(m=>m.to===id)?'target':'',piece?'occupied':'',last && [last.from,last.to].includes(id)?'last':''].join(' ');
    btn.setAttribute('aria-label',id+(piece?' '+(piece.color==='w'?'white ':'black ')+names[piece.type]:' empty'));
    if (piece) btn.innerHTML='<span class="piece '+(piece.color==='w'?'white':'')+'">'+pieces[piece.type]+'︎</span>';
    if (!file) btn.insertAdjacentHTML('beforeend','<small class="coord rank">'+rank+'</small>');
    if (rank===1) btn.insertAdjacentHTML('beforeend','<small class="coord file">'+letter+'</small>');
    squares.append(btn);
  }
  const focus=document.activeElement?.dataset.square;
  board.replaceChildren(squares);
  if(focus) board.querySelector('[data-square="'+focus+'"]')?.focus({preventScroll:true});
  el('promotion').hidden=!promotion.length;
}
function stop() { worker?.terminate(); worker=null; }
function reply() {
  stop();
  if (game.turn()!=='b'||game.isGameOver()) return;
  worker=new Worker('./opponent.mjs',{type:'module'});
  worker.onmessage=({data})=>{stop(); if(data) game.move(data); save(); draw();};
  worker.onerror=()=>{stop();el('status').textContent='Opponent could not load. Refresh to retry.';};
  worker.postMessage({fen:game.fen(),level:Number(level.value)});
}
function play(move) {game.move(move); clearSelection(); save(); draw(); reply();}
board.addEventListener('click',e=>{
  const id=e.target.closest('button')?.dataset.square;
  if(!id||game.turn()!=='w'||game.isGameOver()) return;
  const targets=options.filter(m=>m.to===id);
  if(targets.length>1){promotion=targets;draw();el('choices').firstElementChild.focus();return;}
  if(targets.length){play(targets[0].san);return;}
  clearSelection();
  if(game.get(id)?.color==='w'){selected=id;options=game.moves({square:id,verbose:true});}
  draw();
});
for(const type of ['q','r','b','n']){
  const btn=document.createElement('button');btn.textContent=names[type];
  btn.onclick=()=>{const move=promotion.find(m=>m.promotion===type);if(move) play(move.san);};
  el('choices').append(btn);
}
level.onchange=()=>{save();draw();reply();};
el('undo').onclick=()=>{stop();game.undo();if(game.turn()==='b')game.undo();clearSelection();save();draw();};
el('reset').onclick=()=>{if(game.history().length && !game.isGameOver() && !confirm('Start a new game?'))return;stop();game.reset();clearSelection();save();draw();};
draw();reply();
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
