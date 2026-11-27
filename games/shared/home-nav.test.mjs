import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const ignored=new Set(['node_modules','.git']);
function walk(dir){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(entry.isDirectory())return ignored.has(entry.name)?[]:walk(path.join(dir,entry.name));
    return entry.isFile()&&entry.name.toLowerCase().endsWith('.html')?[path.join(dir,entry.name)]:[];
  });
}
function hasVisibleHomeLink(file,source){
  const relative=path.relative(root,file).replaceAll('\\','/');
  const baseUrl=new URL(relative,'https://sohstx.com/').href;
  for(const match of source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
    const attrs=match[1];
    if(/\bhidden\b|aria-hidden\s*=\s*['"]true['"]|display\s*:\s*none/i.test(attrs))continue;
    const href=attrs.match(/\bhref\s*=\s*(['"])(.*?)\1/i)?.[2];
    if(!href)continue;
    try{const target=new URL(href,baseUrl);if(target.origin==='https://sohstx.com'&&target.pathname==='/')return true;}catch{}
  }
  return false;
}
test('every SohStx site and game HTML page has a visible direct Home link',()=>{
  const files=walk(root);
  assert.ok(files.length>=28,'Expected the current site HTML inventory');
  const missing=files.filter(file=>!hasVisibleHomeLink(file,fs.readFileSync(file,'utf8')));
  assert.deepEqual(missing.map(file=>path.relative(root,file).replaceAll('\\','/')),[]);
});
test('shared Home navigation includes visible keyboard focus styling',()=>{
  const css=fs.readFileSync(path.join(root,'sohstx-brand.css'),'utf8');
  assert.match(css,/\.sohstx-home-link:focus-visible/);
});
