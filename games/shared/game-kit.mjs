export function createGameState({name='Untitled',version=1,initial={}}={}){if(typeof name!=='string'||!name.trim())throw Error('Game name required');return {name,version,updatedAt:new Date().toISOString(),data:structuredClone(initial)}}
export function saveGame(storage,key,state){if(!/^[a-z0-9-]{1,64}$/.test(key))throw Error('Invalid game key');const text=JSON.stringify(state);if(text.length>1_000_000)throw Error('Save too large');storage.setItem('sohstx-game-'+key,text);return true}
export function loadGame(storage,key){if(!/^[a-z0-9-]{1,64}$/.test(key))throw Error('Invalid game key');const text=storage.getItem('sohstx-game-'+key);if(text==null)return null;const value=JSON.parse(text);if(!value||typeof value.name!=='string'||!Number.isInteger(value.version)||typeof value.data!=='object'||value.data===null)throw Error('Invalid save');return value}
export function animationFrame({frameCount,fps=8,elapsedMs=0}){if(!Number.isInteger(frameCount)||frameCount<1||frameCount>1024||!(fps>0&&fps<=120)||!Number.isFinite(elapsedMs))throw Error('Invalid animation');return Math.floor(Math.max(0,elapsedMs)*fps/1000)%frameCount}
export function spriteMetadata({id,name,type,tags=[]}){if(!/^[a-z0-9-]{1,64}$/.test(id)||!name?.trim()||!type?.trim()||!Array.isArray(tags))throw Error('Invalid sprite');return {id,name:name.trim(),type:type.trim(),tags:[...new Set(tags.map(String))]}}

// Local-only shared economy. This is deliberately disabled unless a caller opts in.
export const GAME_ECONOMY_ENABLED = false;
const ECONOMY_VERSION = 2;
const ECONOMY_LEDGER_LIMIT = 5000;
const GAME_ID_PATTERN = /^[a-z0-9-]{1,64}$/;
const ECONOMY_KEY_PATTERN = /^[a-z0-9-]{1,64}$/;
const IDEMPOTENCY_PATTERN = /^[a-zA-Z0-9:_-]{1,128}$/;
const SINK_PATTERN = /^[a-z0-9-]{1,64}$/;
const ECONOMY_TYPES = new Set(['currency-earned','currency-spent','points-earned','points-spent']);

function validateEconomyState(value){
  if(!value||typeof value!=='object'||value.version!==ECONOMY_VERSION)throw Error('Invalid economy version');
  if(!Number.isSafeInteger(value.currencyBalance)||value.currencyBalance<0)throw Error('Invalid currency balance');
  if(!value.pointsByGame||typeof value.pointsByGame!=='object'||Array.isArray(value.pointsByGame))throw Error('Invalid game points');
  const pointsByGame={};
  for(const [gameId,balance] of Object.entries(value.pointsByGame)){
    if(!GAME_ID_PATTERN.test(gameId)||!Number.isSafeInteger(balance)||balance<0)throw Error('Invalid game points');
    pointsByGame[gameId]=balance;
  }
  if(!Array.isArray(value.ledger)||value.ledger.length>ECONOMY_LEDGER_LIMIT)throw Error('Invalid economy ledger');
  const seen=new Set();
  const ledger=value.ledger.map(entry=>{
    if(!entry||typeof entry!=='object'||!IDEMPOTENCY_PATTERN.test(entry.idempotencyKey)||seen.has(entry.idempotencyKey))throw Error('Invalid economy ledger key');
    if(!ECONOMY_TYPES.has(entry.type)||!GAME_ID_PATTERN.test(entry.gameId)||!Number.isSafeInteger(entry.amount)||entry.amount<=0)throw Error('Invalid economy ledger entry');
    if(typeof entry.reason!=='string'||!entry.reason.trim()||entry.reason.length>120)throw Error('Invalid economy ledger reason');
    const spending=entry.type.endsWith('-spent');
    if(spending?!SINK_PATTERN.test(entry.sink??''):entry.sink!=null)throw Error('Invalid economy ledger sink');
    if(!Number.isSafeInteger(entry.balanceAfter)||entry.balanceAfter<0||!Number.isSafeInteger(entry.createdAt)||entry.createdAt<0)throw Error('Invalid economy ledger balance');
    seen.add(entry.idempotencyKey);
    return {idempotencyKey:entry.idempotencyKey,type:entry.type,gameId:entry.gameId,amount:entry.amount,reason:entry.reason.trim(),sink:entry.sink??null,balanceAfter:entry.balanceAfter,createdAt:entry.createdAt};
  });
  return {version:ECONOMY_VERSION,currencyBalance:value.currencyBalance,pointsByGame,ledger};
}

function migrateEconomyState(value){
  if(value?.version===1){
    const migrated={version:ECONOMY_VERSION,currencyBalance:value.balance??0,pointsByGame:value.points??{},ledger:value.ledger??[]};
    return {state:validateEconomyState(migrated),migrated:true};
  }
  return {state:validateEconomyState(value),migrated:false};
}

function validateEconomyOperation(input,spending){
  if(!input||typeof input!=='object')throw Error('Economy operation required');
  const {amount,gameId,reason,idempotencyKey,sink}=input;
  if(!GAME_ID_PATTERN.test(gameId??''))throw Error('Invalid game id');
  if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Invalid economy amount');
  if(!IDEMPOTENCY_PATTERN.test(idempotencyKey??''))throw Error('Idempotency key required');
  if(typeof reason!=='string'||!reason.trim()||reason.length>120)throw Error('Economy reason required');
  if(spending?!SINK_PATTERN.test(sink??''):sink!=null)throw Error('Invalid economy sink');
  return {amount,gameId,reason:reason.trim(),idempotencyKey,sink:sink??null};
}

export function createGameEconomy({storage,key='shared',enabled=GAME_ECONOMY_ENABLED,now=Date.now}={}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')throw Error('Economy storage unavailable');
  if(!ECONOMY_KEY_PATTERN.test(key))throw Error('Invalid economy storage key');
  if(typeof enabled!=='boolean'||typeof now!=='function')throw Error('Invalid economy configuration');
  const storageKey='sohstx-economy-'+key;
  const stored=storage.getItem(storageKey);
  let state={version:ECONOMY_VERSION,currencyBalance:0,pointsByGame:{},ledger:[]};
  if(stored!=null){
    let parsed;
    try{parsed=JSON.parse(stored)}catch{throw Error('Corrupt economy save')}
    const migrated=migrateEconomyState(parsed);
    state=migrated.state;
    if(migrated.migrated)storage.setItem(storageKey,JSON.stringify(state));
  }
  function balanceFor(type,gameId){
    return type.startsWith('currency-')?state.currencyBalance:(state.pointsByGame[gameId]??0);
  }
  function apply(type,input){
    const spending=type.endsWith('-spent');
    const operation=validateEconomyOperation(input,spending);
    const current=balanceFor(type,operation.gameId);
    if(!enabled)return {applied:false,reason:'disabled',balance:current};
    if(state.ledger.some(entry=>entry.idempotencyKey===operation.idempotencyKey))return {applied:false,reason:'duplicate',balance:current};
    if(spending&&current<operation.amount)return {applied:false,reason:'insufficient-funds',balance:current};
    const nextBalance=current+(spending?-operation.amount:operation.amount);
    if(!Number.isSafeInteger(nextBalance)||nextBalance<0)throw Error('Economy balance limit exceeded');
    if(state.ledger.length>=ECONOMY_LEDGER_LIMIT)throw Error('Economy ledger full');
    const createdAt=now();
    if(!Number.isSafeInteger(createdAt)||createdAt<0)throw Error('Invalid economy timestamp');
    const record={...operation,type,balanceAfter:nextBalance,createdAt};
    const next=structuredClone(state);
    if(type.startsWith('currency-'))next.currencyBalance=nextBalance;
    else next.pointsByGame[operation.gameId]=nextBalance;
    next.ledger.push(record);
    // Commit to storage before replacing the in-memory snapshot.
    storage.setItem(storageKey,JSON.stringify(next));
    state=next;
    return {applied:true,reason:'applied',balance:nextBalance,record:structuredClone(record)};
  }
  return Object.freeze({
    enabled,
    storageKey,
    getState:()=>structuredClone(state),
    getCurrencyBalance:()=>state.currencyBalance,
    getPointsBalance:gameId=>{
      if(!GAME_ID_PATTERN.test(gameId??''))throw Error('Invalid game id');
      return state.pointsByGame[gameId]??0;
    },
    earnCurrency:input=>apply('currency-earned',input),
    spendCurrency:input=>apply('currency-spent',input),
    earnPoints:input=>apply('points-earned',input),
    spendPoints:input=>apply('points-spent',input)
  });
}

