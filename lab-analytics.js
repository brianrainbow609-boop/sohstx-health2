(() => {
  'use strict';
  const clinical = location.pathname.startsWith('/clinical/');
  const storageKey = 'sohstx-lab-history-v1-' + (clinical ? 'clinical' : 'personal');
  const columns = ['date','test','result','unit','reference_range','source','date_basis'];
  const el = (tag, text) => Object.assign(document.createElement(tag), {textContent:text});
  function parseCSV(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g,'\n');
    for (let i=0;i<text.length;i++) {
      const c=text[i];
      if(c==='"' && quoted && text[i+1]==='"'){field+='"';i++;continue;}
      if(c==='"'){quoted=!quoted;continue;}
      if(!quoted && (c===',' || c==='\n')){
        row.push(field.trim());field='';
        if(c==='\n'){if(row.some(Boolean))rows.push(row);row=[];}
      } else field+=c;
    }
    if(quoted)throw Error('Unclosed quote in CSV.');
    row.push(field.trim());if(row.some(Boolean))rows.push(row);
    const header=rows.shift() || [];
    if(!['date','test','result'].every(k=>header.includes(k)))throw Error('CSV needs date, test and result columns.');
    return rows.map((values,i)=>{
      if(values.length!==header.length)throw Error('Column count differs on record '+(i+2));
      return Object.fromEntries(columns.map(k=>[k,values[header.indexOf(k)] || '']));
    });
  }
  function validate(rows){
    if(!Array.isArray(rows)||!rows.length)throw Error('No lab results found.');
    return rows.map((r,i)=>{
      const d=new Date(r?.date+'T12:00:00Z');
      if(!r || columns.some(k=>r[k]!=null && typeof r[k]!=='string') || !r.test?.trim() || !r.result?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(+d) || d.toISOString().slice(0,10)!==r.date)throw Error('Invalid date, test or result on record '+(i+1));
      return Object.fromEntries(columns.map(k=>[k,(r[k]||'').trim()]));
    });
  }
  const read=()=>JSON.parse(localStorage.getItem(storageKey)||'[]');
  const key=r=>JSON.stringify([r.date,r.test.toLowerCase(),r.result,r.unit,r.reference_range]);
  const panel=el('section','');panel.className=clinical?'panel':'view';panel.id='view-labs';
  panel.innerHTML='<div class="panel lab-wrap"><h2>Lab Analytics</h2><p class="lab-count"></p><div class="lab-actions"><button type="button" class="lab-import"></button><input type="file" hidden><button type="button" class="lab-export">Export labs for Clinical</button></div><p role="status"></p><label>Test and unit <select></select></label><p class="lab-change"></p><div class="lab-scroll"><table><thead><tr><th>Date</th><th>Result</th><th>Reference range</th><th>Date basis</th></tr></thead><tbody></tbody></table></div></div>';
  document.head.append(el('style','.lab-wrap{border-top:4px solid #58d0bf}.lab-actions{display:flex;flex-wrap:wrap;gap:.6rem}.lab-scroll{overflow:auto}.lab-wrap select{max-width:100%}.lab-change{font-weight:650}.lab-wrap td,.lab-wrap th{padding:.6rem;text-align:left}.tabs{overflow-x:auto}.tabs .tab{flex-shrink:0}'));
  const main=document.querySelector('main'), button=el('button','Lab Analytics');
  if(clinical){
    const bar=el('nav',''), back=el('button','Clinical overview');
    bar.className='actions';bar.append(back,button);main.before(bar);main.after(panel);panel.hidden=true;
    button.onclick=()=>{main.hidden=true;panel.hidden=false;render();};
    back.onclick=()=>{panel.hidden=true;main.hidden=false;};
  }else{
    button.className='tab';button.dataset.tab='labs';document.querySelector('.tabs').append(button);main.append(panel);
    button.addEventListener('click',()=>{setTab('labs');requestAnimationFrame(()=>document.getElementById('pageTitle').textContent='Lab Analytics');render();});
  }
  const select=panel.querySelector('select'), status=panel.querySelector('[role=status]'), file=panel.querySelector('input');
  const group=r=>JSON.stringify([r.test.toLowerCase(),r.unit]);
  function render(){
    const rows=read(),previous=select.value,groups=new Map();
    for(const r of rows)groups.set(group(r),r.test+(r.unit?' ('+r.unit+')':''));
    select.replaceChildren(...[...groups].sort((a,b)=>a[1].localeCompare(b[1])).map(([k,v])=>new Option(v,k)));
    if(groups.has(previous))select.value=previous;
    panel.querySelector('.lab-count').textContent=rows.length+' results · '+new Set(rows.map(r=>r.date)).size+' dates';
    const series=rows.filter(r=>group(r)===select.value).sort((a,b)=>b.date.localeCompare(a.date));
    const body=panel.querySelector('tbody');body.replaceChildren();
    for(const r of series){const tr=body.insertRow();for(const v of [r.date,r.result,r.reference_range || '—',r.date_basis || '—'])tr.insertCell().textContent=v;}
    const latest=series[0], prior=series.find(r=>r.date<latest.date);
    let msg=latest?'Latest: '+latest.result+' '+latest.unit:'Import your lab history to see results here.';
    if(prior)msg+=' · Previous: '+prior.result+' '+prior.unit+' on '+prior.date;
    panel.querySelector('.lab-change').textContent=msg;
  }
  select.onchange=render;
  const load=panel.querySelector('.lab-import');load.textContent=clinical?'Import shared labs':'Import monthly CSV';load.onclick=()=>file.click();file.accept=clinical?'.json':'.csv';
  file.onchange=async()=>{
    try{
      const f=file.files[0];if(!f)return;
      const content=await f.text();let incoming;
      if(clinical){const share=JSON.parse(content);if(share.format!=='sohstx-labs-v1')throw Error('Choose a file from Export labs for Clinical.');incoming=share.results;}
      else incoming=parseCSV(content);
      const valid=validate(incoming), rows=read(), known=new Set(rows.map(key)), old=rows.length;
      for(const r of valid){const k=key(r);if(!known.has(k)){rows.push(r);known.add(k);}}
      localStorage.setItem(storageKey,JSON.stringify(rows));render();status.textContent=(rows.length-old)+' added · '+(valid.length-rows.length+old)+' duplicates skipped';
    }catch(e){status.textContent='Import failed: '+e.message;}finally{file.value='';}
  };
  const share=panel.querySelector('.lab-export');share.hidden=clinical;
  share.onclick=()=>{const results=read();if(!results.length){status.textContent='Import results first.';return;}
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'sohstx-labs-v1',results})],{type:'application/json'}));
    const link=el('a','');link.href=url;link.download='SohStx-Clinical-Labs.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };render();
})();
