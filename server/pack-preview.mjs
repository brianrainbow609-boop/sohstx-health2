// Run from the repository root with PREVIEW_PASSWORD set. Keep sourceDir outside the public repo.
// node server/pack-preview.mjs sourceDir [project-slug]
// The root index.html is the private catalog. A project directory keeps its relative URLs.
import {webcrypto, randomBytes, createHash} from 'node:crypto';
import {readFile, writeFile, readdir, mkdir} from 'node:fs/promises';
import {resolve, relative, join, sep} from 'node:path';
const [source,slug='']=process.argv.slice(2);
if(!source||!process.env.PREVIEW_PASSWORD||!/^([a-z0-9-]+)?$/.test(slug))throw Error('Provide a private source directory, optional slug, and PREVIEW_PASSWORD.');
const rel=relative(resolve(),resolve(source));if(!rel.startsWith('..'+sep)&&rel!=='..')throw Error('Keep plaintext outside the repository.');
const crypto=webcrypto.subtle;
const configFile=new URL('./gate.json',import.meta.url);
let config;
try{config=JSON.parse(await readFile(configFile,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const salt=config?Buffer.from(config.salt,'base64'):randomBytes(16);
const material=await crypto.importKey('raw',Buffer.from(process.env.PREVIEW_PASSWORD),'PBKDF2',false,['deriveKey']);
const wrapping=await crypto.deriveKey({name:'PBKDF2',salt,iterations:100000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
async function seal(key,plain,label){const iv=randomBytes(12);const ciphertext=await crypto.encrypt({name:'AES-GCM',iv,additionalData:Buffer.from(label)},key,plain);return Buffer.concat([iv,Buffer.from(ciphertext)])}
let raw;
if(config){const wrap=Buffer.from(config.wrap,'base64');raw=await crypto.decrypt({name:'AES-GCM',iv:wrap.subarray(0,12),additionalData:Buffer.from('preview-key')},wrapping,wrap.subarray(12))}
else{raw=randomBytes(32);await writeFile(configFile,JSON.stringify({salt:salt.toString('base64'),wrap:(await seal(wrapping,raw,'preview-key')).toString('base64')})+'\n')}
const key=await crypto.importKey('raw',raw,'AES-GCM',false,['encrypt']);
await mkdir('vault',{recursive:true});
async function pack(dir,prefix){for(const f of await readdir(dir,{withFileTypes:true})){if(f.name.startsWith('.'))continue;const name=prefix+'/'+f.name;const file=join(dir,f.name);if(f.isDirectory())await pack(file,name);else if(f.isFile()){const id=createHash('sha256').update(name).digest('hex');await writeFile('vault/'+id+'.bin',await seal(key,await readFile(file),name))}}}
await pack(resolve(source),slug?'/'+slug:'');
