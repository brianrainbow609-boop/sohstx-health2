import config from './gate.json';
const encoder=new TextEncoder();
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const root='/development/';
const cookieName='__Secure-sohstx_preview';
const attrs='; Path=/development/; HttpOnly; Secure; SameSite=Strict';
const privacy={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const loginForm='<form class="box form" method="post" action="/development/unlock"><label for="password">Preview password</label><input id="password" type="password" name="password" autocomplete="current-password" required><button>Unlock previews</button></form>';
function login(error=false){return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>In Development · SohStx</title><link rel="stylesheet" href="/portal.css"></head><body><nav><a class="mark" href="/">Soh<b>Stx</b></a><a href="/">Back to home</a></nav><main><header class="intro"><h1>In Development</h1></header>'+(error?'<p class="alert" role="alert">Incorrect password. Try again.</p>':'')+loginForm+'</main></body></html>',{status:error?403:401,headers:{...privacy,'Content-Type':'text/html; charset=utf-8'}})}
function redirect(to,cookie){const headers={...privacy,Location:to};if(cookie)headers['Set-Cookie']=cookie;return new Response(null,{status:303,headers})}
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',mjs:'text/javascript',json:'application/json',webmanifest:'application/manifest+json',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',ico:'image/x-icon',avif:'image/avif',mp3:'audio/mpeg',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',woff2:'font/woff2',wasm:'application/wasm',txt:'text/plain'};
export default {async fetch(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(path==='/development')return redirect(root);
 if(!path.startsWith(root)){
 if(/^\/vault(?:\/|$)/i.test(path))return new Response(null,{status:404});
 return env.ASSETS.fetch(req);
 }
 if(req.method==='POST'){
 if(req.headers.get('Origin')!==url.origin)return new Response(null,{status:403,headers:privacy});
 if(path===root+'lock')return redirect(root,cookieName+'='+attrs+'; Max-Age=0');
 if(path!==root+'unlock')return new Response(null,{status:404,headers:privacy});
 if(!req.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))return login(true);
 const password=new URLSearchParams(await req.text()).get('password');
 if(!password||password.length>256)return login(true);
 const material=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',iterations:100000,salt:decode(config.salt),hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
 const wrap=decode(config.wrap);
 try{const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv:wrap.slice(0,12),additionalData:encoder.encode('preview-key')},key,wrap.slice(12));return redirect(root,cookieName+'='+btoa(String.fromCharCode(...new Uint8Array(raw)))+attrs)}catch{return login(true)}
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return new Response(null,{status:405,headers:privacy});
 const value=(req.headers.get('Cookie')||'').split(/;\s*/).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
 if(!value||!/^[-A-Za-z0-9+/]{43}=$/.test(value))return login();
 let name;
 try{name=decodeURIComponent(path.slice(root.length-1));if(name.endsWith('/'))name+='index.html'}catch{return new Response(null,{status:400,headers:privacy})}
 const id=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(name))),b=>b.toString(16).padStart(2,'0')).join('');
 const asset=await env.ASSETS.fetch(new Request(new URL('/vault/'+id+'.bin',url)));
 if(!asset.ok)return new Response('Preview unavailable.',{status:404,headers:privacy});
 const encrypted=new Uint8Array(await asset.arrayBuffer());
 try{const key=await crypto.subtle.importKey('raw',decode(value),'AES-GCM',false,['decrypt']);const data=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(0,12),additionalData:encoder.encode(name)},key,encrypted.slice(12));return new Response(req.method==='HEAD'?null:data,{headers:{...privacy,'Content-Type':types[name.split('.').pop()]||'application/octet-stream','Content-Security-Policy':"worker-src 'none'; frame-ancestors 'self'"}})}catch{return login()}
}};
