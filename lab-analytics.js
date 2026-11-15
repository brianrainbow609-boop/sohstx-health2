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

/* Lab explorer for Personal and Clinical */
(() => {
  const panel = document.querySelector('#view-labs');
  const picker = panel.querySelector('select');
  const box = document.createElement('section');
  panel.querySelector('.lab-change').after(box);
  box.innerHTML = `<details><summary>About this lab</summary><p></p></details>
  <h3>Compare results</h3><label>Earlier result <select></select></label><p class="delta"></p>
  <label>Overlay <select></select></label><div class="plot"></div><small class="legend"></small>`;
  box.style.cssText='padding:14px 0;min-width:0';
  box.querySelector('summary').style.cssText='padding:12px;background:#203850;border-radius:10px;cursor:pointer;font-weight:bold';
  const [baseline, overlay] = box.querySelectorAll('select');
  const clinical = location.pathname.startsWith('/clinical/');
  const descriptions = {
    'hemoglobin a1c':'A1c measures the share of hemoglobin with glucose attached. It reflects roughly three months of blood glucose.',
    'mean blood glucose':'When reported with A1c, this is an estimated average calculated from A1c. A CGM average comes from sensor readings.',
    'glucose':'Blood glucose measures sugar in the blood at the time the sample was taken.',
    'creatinine':'Creatinine is a waste product from muscle activity. Its blood concentration is used to estimate kidney filtration.',
    'egfr':'Estimated glomerular filtration rate describes how quickly the kidneys filter blood. A result such as >90 gives a lower bound.',
    'bun':'Blood urea nitrogen measures nitrogen from urea, a waste product of protein breakdown.',
    'alt':'ALT is an enzyme found mainly in liver cells. The test measures its activity in blood.',
    'ast':'AST is an enzyme found in liver, muscle and other tissues.',
    'alkaline phosphatase':'This enzyme comes mainly from the liver and bones.',
    'total bilirubin':'Bilirubin is a pigment produced as red blood cells break down.',
    'albumin':'Albumin is a protein made by the liver that carries substances in the blood.',
    'globulin':'Globulins are a group of blood proteins that include antibodies.',
    'total protein':'Total protein includes albumin and globulins in the blood.',
    'sodium':'Sodium is an electrolyte involved in fluid balance and nerve function.',
    'potassium':'Potassium is an electrolyte used by muscles, nerves and the heart.',
    'chloride':'Chloride is an electrolyte involved in fluid and acid-base balance.',
    'co2':'On a metabolic panel, total carbon dioxide mainly reflects bicarbonate, which helps buffer acids.',
    'anion gap':'A calculated difference between measured electrolytes, used when assessing acid-base balance.',
    'calcium':'Total calcium measures circulating calcium, including calcium bound to proteins.',
    'rbc':'A count of the red blood cells that carry oxygen.',
    'wbc':'A count of white blood cells, which participate in immune responses.',
    'hemoglobin':'The oxygen-carrying protein inside red blood cells.',
    'hematocrit':'The percentage of blood volume made up of red blood cells.',
    'mcv':'The average size of a red blood cell.',
    'mch':'The average amount of hemoglobin per red blood cell.',
    'mchc':'The average concentration of hemoglobin inside red blood cells.',
    'rdw':'A measure of variation in red blood cell size.',
    'mpv':'The average size of platelets.',
    'platelet count':'A count of platelets, which help blood clot.',
    'tsh 3rd generation':'TSH is the pituitary hormone that signals the thyroid to produce thyroid hormones.',
    'free t4':'The portion of thyroxine in the blood that is unbound to proteins.',
    'vitamin b-12':'Measures circulating vitamin B12, needed for nerve function and red blood cell formation.',
    'vit d, 25-hydroxy':'The main blood test used to assess vitamin D status.',
    'crp':'C-reactive protein is a general marker of inflammation.'
  };
  const number = s => /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(String(s).trim()) ? Number(s) : NaN;
  function explain(name){
    const n=name.toLowerCase();
    if(descriptions[n])return descriptions[n];
    if(n.startsWith('hiv'))return n.includes('p24')?'Measures reactivity to the HIV p24 antigen.':n.includes('ag/ab')?'A combined screening test for HIV antigen and antibodies.':'Reports antibody reactivity for the indicated HIV type.';
    if(/neutrophil|monocyte|lymph|basophil|eosinophil|immature granulocyte/.test(n))return name.split(/ %| Abs| Percent/)[0]+' are a type or stage of white blood cell. This result reports '+(/%|percent/.test(n)?'their percentage of white cells.':'their absolute count in blood.');
    return 'Use the reported unit and the laboratory’s own reference range when reviewing this test.';
  }
  function render(reset=false){
    const all=JSON.parse(localStorage.getItem('sohstx-lab-history-v1-'+(clinical?'clinical':'personal'))||'[]');
    const group=r=>JSON.stringify([r.test.toLowerCase(),r.unit]);
    const rows=all.filter(r=>group(r)===picker.value).sort((a,b)=>b.date.localeCompare(a.date));
    box.hidden=!rows.length;if(!rows.length)return;
    const latest=rows[0];
    box.querySelector('summary').textContent='About '+latest.test;
    box.querySelector('details p').textContent=explain(latest.test);
    const before=baseline.value, over=overlay.value;
    baseline.replaceChildren(...rows.slice(1).map((r,i)=>new Option(r.date+' · '+r.result+' '+r.unit,i+1)));
    if(!reset && [...baseline.options].some(o=>o.value===before))baseline.value=before;
    const other=rows[Number(baseline.value)];
    let msg='Latest: '+latest.date+' · '+latest.result+' '+latest.unit;
    if(baseline.value && other){const d=number(latest.result)-number(other.result);if(Number.isFinite(d))msg+=' · Change: '+(d>0?'+':'')+Number(d.toFixed(4))+' '+latest.unit;}
    box.querySelector('.delta').textContent=msg;
    const groups=new Map(all.filter(r=>group(r)!==picker.value && Number.isFinite(number(r.result))).map(r=>[group(r),r.test+' ('+r.unit+')']));
    const glucose=clinical?(typeof readings==='undefined'?[]:readings.map(r=>[r.t,r.v])):(typeof validReadings==='function'?validReadings().map(r=>[r.time,r.value]):[]);
    const days=new Map();
    for(const [time,value] of glucose){const d=new Date(time);const local=new Date(+d-d.getTimezoneOffset()*60000).toISOString().slice(0,10);const pair=days.get(local)||[0,0];pair[0]+=value;pair[1]++;days.set(local,pair);}
    if(days.size)groups.set('cgm','CGM daily mean (mg/dL)');
    overlay.replaceChildren(new Option('None',''),...[...groups].map(([k,v])=>new Option(v,k)));
    if(groups.has(over))overlay.value=over;
    const points=rs=>rs.map(r=>[Date.parse(r.date),number(r.result)]).filter(p=>Number.isFinite(p[1])).sort((a,b)=>a[0]-b[0]);
    const a=points(rows), b=overlay.value==='cgm'?points([...days].map(([date,[s,n]])=>({date,result:s/n}))):points(all.filter(r=>group(r)===overlay.value));
    const plot=box.querySelector('.plot');plot.replaceChildren();
    const legend=box.querySelector('.legend');legend.textContent='';
    if(!a.length){plot.textContent='This test has no exact numeric results to graph. See the reported values below.';return;}
    const dates=[...a,...b].map(p=>p[0]);const lo=Math.min(...dates),hi=Math.max(...dates);
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 400 165');svg.style.cssText='width:100%;height:auto;background:#101e30;border-radius:10px;margin-top:10px';svg.setAttribute('role','img');svg.setAttribute('aria-label','Lab trend by date for '+latest.test);plot.append(svg);
    function shape(tag,attrs,label){const e=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(label)e.textContent=label;svg.append(e);return e;}
    function line(ps,color){
      const vals=ps.map(p=>p[1]),min=Math.min(...vals),max=Math.max(...vals);
      const coords=ps.map(([t,v])=>[hi===lo?200:18+364*(t-lo)/(hi-lo),min===max?76:131-107*(v-min)/(max-min)]);
      shape('polyline',{points:coords.map(p=>p.join(',')).join(' '),stroke:color,fill:'none','stroke-width':2});
      coords.forEach(([cx,cy],i)=>{const dot=shape('circle',{cx,cy,r:4,fill:color});dot.onclick=()=>{legend.textContent=new Date(ps[i][0]).toISOString().slice(0,10)+' · '+(color==='#64dfbc'?latest.test+' ('+latest.unit+')':groups.get(overlay.value))+' · '+ps[i][1].toLocaleString();};});
      return min+'–'+max;
    }
    const range=line(a,'#64dfbc');let label='Green: '+latest.test+' ('+range+' '+latest.unit+')';
    if(b.length)label+=' · Blue: '+groups.get(overlay.value)+' ('+line(b,'#79baff')+'). Each line uses its own vertical scale.';
    legend.textContent=label+' · Exact numeric results only.';
    for(const [t,x,anchor] of [[lo,12,'start'],[hi,388,'end']])shape('text',{x,y:156,fill:'#bed0e4','font-size':13,'text-anchor':anchor},new Date(t).toISOString().slice(0,10));
  }
  baseline.onchange=()=>render();overlay.onchange=()=>render();
  picker.addEventListener('change',()=>render(true));
  new MutationObserver(()=>render()).observe(panel.querySelector('tbody'),{childList:true});
  render();
})();

/* Scrollable overview; the existing explorer becomes the expanded view. */
(() => {
  const panel = document.querySelector('#view-labs');
  const wrap = panel.querySelector('.lab-wrap');
  const picker = wrap.querySelector('label select');
  const gallery = document.createElement('div');
  gallery.className = 'lab-gallery';
  const dialog = document.createElement('dialog');
  dialog.className = 'lab-expanded';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '← All labs';
  close.onclick = () => dialog.close();
  const heading = document.createElement('h2');
  heading.id = 'expanded-lab-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  const pickerLabel = picker.closest('label');
  const details = [pickerLabel, ...following(pickerLabel)];
  function following(node) {
    const result = [];
    while ((node = node.nextElementSibling)) result.push(node);
    return result;
  }
  wrap.append(gallery, dialog);
  dialog.append(close, heading, ...details);
  pickerLabel.hidden = true;
  dialog.addEventListener('click', e => { if(e.target === dialog) {
    const r=dialog.getBoundingClientRect(); if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();
  }});
  const style = document.createElement('style');
  style.textContent = `
    .lab-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,155px),1fr));gap:12px}
    .lab-gallery .lab-card{display:flex;flex-direction:column;align-items:stretch;justify-content:space-between;gap:5px;min-width:0;text-align:left;padding:14px;border-radius:15px;border:1px solid #35526a;color:#eff7ff;background:linear-gradient(145deg,#193248,#102033);cursor:pointer}
    .lab-card:hover,.lab-card:focus-visible{outline:2px solid var(--ink)}
    .lab-card strong{font-size:1rem;overflow-wrap:anywhere}.lab-card b{font-size:1.45rem;color:var(--ink)}.lab-card small{color:#bed0df;font-weight:normal}.lab-card svg{width:100%;height:58px}
    .lab-expanded{box-sizing:border-box;width:min(94vw,760px);max-height:88dvh;overflow:auto;border:1px solid #50748a;border-radius:18px;background:#102136;color:#eff7ff;padding:20px}.lab-expanded::backdrop{background:#050b14dc}
    .lab-expanded select{max-width:100%}.lab-expanded .lab-scroll{overflow-x:auto}
    @media (max-width:540px),(orientation:portrait) and (max-width:1100px){.lab-gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.lab-gallery .lab-card{padding:11px}.lab-expanded{padding:14px}}
    @media(max-width:310px){.lab-gallery{grid-template-columns:1fr}}
  `;
  document.head.append(style);
  const palette=['#65dfc0','#73cfff','#c2a8ff','#ffbf81'];
  const svgNS='http://www.w3.org/2000/svg';
  function spark(rows, color) {
    const svg=document.createElementNS(svgNS,'svg');
    svg.setAttribute('viewBox','0 0 180 52');svg.setAttribute('aria-hidden','true');
    const exact=rows.filter(r=>/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(r.result.trim()));
    if(!exact.length) return document.createTextNode('Reported result');
    const vals=exact.map(r=>Number(r.result)), min=Math.min(...vals), max=Math.max(...vals);
    const start=Date.parse(rows[0].date), end=Date.parse(rows.at(-1).date);
    const coords=exact.map((r,i)=>[end===start?90:5+170*(Date.parse(r.date)-start)/(end-start),max===min?26:46-40*(vals[i]-min)/(max-min)]);
    const line=document.createElementNS(svgNS,'polyline');
    line.setAttribute('points',coords.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',color);line.setAttribute('stroke-width','2.5');svg.append(line);
    for(const [x,y] of coords){const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('cx',x);dot.setAttribute('cy',y);dot.setAttribute('r','3.5');dot.setAttribute('fill',color);svg.append(dot);}
    return svg;
  }
  let previous=null;
  function drawGallery(){
    const raw=localStorage.getItem('sohstx-lab-history-v1-'+(location.pathname.startsWith('/clinical/')?'clinical':'personal'))||'[]';
    if(raw===previous)return;
    previous=raw;
    const groups=new Map();
    for(const row of JSON.parse(raw)){const k=JSON.stringify([row.test.toLowerCase(),row.unit]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
    gallery.replaceChildren();
    for(const [key,rows] of [...groups].sort((a,b)=>a[1][0].test.localeCompare(b[1][0].test))){
      rows.sort((a,b)=>a.date.localeCompare(b.date));
      const latest=rows.at(-1), color=palette[gallery.childElementCount%palette.length];
      const card=document.createElement('button');card.type='button';card.className='lab-card';card.style.setProperty('--ink',color);
      const name=document.createElement('strong');name.textContent=latest.test;
      const value=document.createElement('b');value.textContent=[latest.result,latest.unit].filter(Boolean).join(' ');
      const caption=document.createElement('small');caption.textContent=latest.date+' · '+rows.length+(rows.length===1?' result':' results');
      card.append(name,value,spark(rows,color),caption);
      card.onclick=()=>{picker.value=key;picker.dispatchEvent(new Event('change'));heading.textContent=latest.test;dialog.showModal();dialog.scrollTop=0;close.focus();};
      gallery.append(card);
    }
  }
  new MutationObserver(drawGallery).observe(picker,{childList:true});drawGallery();
})();
// Larger lab text on phones
(() => {
  const style = document.createElement('style');
  style.textContent = `
    @media (max-width: 640px),
           (orientation: portrait) and (max-width: 1100px) {
      #view-labs .lab-card {
        padding: clamp(12px, 2vw, 20px);
        gap: 8px;
        line-height: 1.3;
      }

      #view-labs .lab-card strong {
        font-size: clamp(18px, 3.5vw, 34px);
      }

      #view-labs .lab-card b {
        font-size: clamp(23px, 4.5vw, 44px);
        overflow-wrap: anywhere;
      }

      #view-labs .lab-card small {
        font-size: clamp(15px, 2.9vw, 28px);
        color: #dce8f3;
      }

      #view-labs .lab-actions button,
      #view-labs .lab-expanded :is(button, label, select, summary, p, small, td, th) {
        font-size: clamp(16px, 3.2vw, 30px);
        line-height: 1.4;
      }
    }
  `;
  document.head.append(style);
})();
// Shared reading sizes for SohStx Health and SohStx Clinical.
(() => {
  const style = document.createElement('style');
  style.id = 'sohstx-reading-sizes';
  style.textContent = `
    @media screen and (max-width: 700px),
           screen and (orientation: portrait) and (max-width: 1100px) {
      :root {
        --read-body: clamp(18px, 3.55vw, 34px);
        --read-label: clamp(16px, 3.1vw, 30px);
        --read-caption: clamp(15px, 2.85vw, 27px);
        --read-heading: clamp(23px, 4.4vw, 42px);
        --read-value: clamp(28px, 5.2vw, 50px);
      }

      body {
        font-size: var(--read-body);
        line-height: 1.45;
      }

      body :is(p, .subtle, .muted, .notice, .chartdetail, #notice) {
        font-size: var(--read-body) !important;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      body :is(h2, .sectionhead h2, .lab-expanded h2) {
        font-size: var(--read-heading) !important;
        line-height: 1.2;
      }

      body :is(h3, header strong, .timeline strong, .timeline b) {
        font-size: var(--read-body) !important;
        line-height: 1.35;
      }

      body :is(label, button, select, textarea, input, summary,
               .v21-link, th, td, .legend, .metric > span,
               .v21-metric span, .lab-card strong) {
        font-size: var(--read-label) !important;
        line-height: 1.35;
      }

      body :is(small, time, footer, .eyebrow, .privacy,
               .metric p, .timeline div, .timeline span,
               .timeline small, .lab-card small) {
        font-size: var(--read-caption) !important;
        line-height: 1.4;
      }

      body :is(.metric b, .stat, .v21-metric strong, .lab-card b) {
        font-size: var(--read-value) !important;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      body #latest {
        font-size: var(--read-value) !important;
      }

      /* Clinical's latest observation is a date and time. */
      body .grid #latest {
        font-size: var(--read-body) !important;
      }

      body :is(button, select, input:not([type="checkbox"]):not([type="file"])) {
        min-height: 48px;
        max-width: 100%;
      }

      body button {
        height: auto;
        white-space: normal;
      }

      body :is(.actions, .v21-actions, .sectionhead, header) {
        flex-wrap: wrap;
      }

      body :is(.metrics, main > .grid, .v21-metric-grid) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      body :is(.twocol, .v21-twocol) {
        grid-template-columns: minmax(0, 1fr);
      }

      body :is(.panel, .metric, .grid > *, .twocol > *) {
        min-width: 0;
      }

      body :is(.scroll, .tablewrap, .lab-scroll) {
        max-width: 100%;
        overflow-x: auto;
      }

      body :is(th, td) {
        padding: 0.55em 0.65em;
      }
    }
  `;
  document.getElementById(style.id)?.remove();
  document.head.append(style);
})();
/* SohStx combined CSV v1 */
(() => {
  const columns=['format','type','date','test','result','unit','reference_range','source','date_basis','id','record_json'];
  const labFields=['date','test','result','unit','reference_range','source','date_basis'];
  const version='sohstx-combined-v1';
  const labKey=r=>JSON.stringify([r.date,r.test.trim().toLowerCase(),r.result,r.unit,r.reference_range]);
  function encode(records,labs){
    const lines=[columns];
    function add(row){lines.push(columns.map(k=>row[k]??''));}
    for(const r of records)add({format:version,type:'record',date:r.date,source:r.source,id:r.id,result:r.raw.bgl,record_json:JSON.stringify(r)});
    for(const r of labs)add({...r,format:version,type:'lab'});
    return lines.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');
  }
  function decode(text){
    const cells=[],records=[],labs=[];let row=[],field='',quoted=false,closed=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c!=='"')field+=c;else if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}continue;}
      if(c==='"' && !field && !closed){quoted=true;continue;}
      if(c===',' || c==='\r' || c==='\n'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r' && text[i+1]==='\n')i++;if(row.some(Boolean))cells.push(row);row=[];}continue;}
      if(closed||c==='"')throw Error('Invalid CSV quoting.');
      field+=c;
    }
    if(quoted)throw Error('Incomplete CSV.');
    row.push(field);if(row.some(Boolean))cells.push(row);
    if(JSON.stringify(cells.shift())!==JSON.stringify(columns))throw Error('Choose a SohStx combined CSV.');
    for(const values of cells){
      if(values.length!==columns.length)throw Error('Incomplete row.');
      const r=Object.fromEntries(columns.map((k,i)=>[k,values[i]]));
      if(r.format!==version || !Number.isFinite(Date.parse(r.date)))throw Error('Unknown format or invalid date.');
      if(r.type==='record'){const obj=JSON.parse(r.record_json);if(!r.id||obj.id!==r.id||obj.date!==r.date||obj.source!==r.source||!obj.raw||typeof obj.raw!=='object')throw Error('Invalid health record.');records.push(obj);}
      else if(r.type==='lab' && r.test.trim() && r.result.trim() && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && new Date(r.date).toISOString().slice(0,10)===r.date)labs.push(Object.fromEntries(labFields.map(k=>[k,r[k]])));
      else throw Error('Invalid lab or record type.');
    }
    if(!records.length&&!labs.length)throw Error('File contains no records.');
    return {records,labs};
  }
  const labsKey='sohstx-lab-history-v1-personal';
  const readLabs=()=>JSON.parse(localStorage.getItem(labsKey)||'[]');
  function classify(text,parser){
    text=text.replace(/^\uFEFF/,'').trim();
    if(text.startsWith('{')){
      const obj=JSON.parse(text);
      if(obj.format==='sohstx-health' && obj.version===1 && Array.isArray(obj.records))return {records:obj.records,labs:[]};
      if(obj.format==='sohstx-labs-v1')return {records:[],labs:obj.results};
      if(obj.format==='sohstx-clinical' && Array.isArray(obj.readings)&&Array.isArray(obj.events))return review(obj.readings,obj.events);
      throw Error('Unrecognized JSON export.');
    }
    const rows=parser(text),header=(rows[0]||[]).map(s=>s.trim());
    if(header.join('|')===columns.join('|'))return decode(text);
    if(rows.some(r=>['Device Timestamp','Record Type','Historic Glucose mg/dL','Scan Glucose mg/dL'].every(k=>r.some(v=>v.trim()===k))))return 'libre';
    const items=rows.slice(1).map((values,i)=>{
      if(values.length!==header.length)throw Error('Column count differs at row '+(i+2));
      return Object.fromEntries(header.map((k,j)=>[k,values[j].trim()]));
    });
    if(['date','test','result'].every(k=>header.includes(k)))return {records:[],labs:items};
    if(header.join('|')==='timestamp_iso|record_type|glucose_mg_dl|description|details|source')
      return review(items.filter(r=>r.record_type==='glucose').map(r=>({...r,date:r.timestamp_iso})),items.filter(r=>r.record_type!=='glucose').map(r=>({...r,date:r.timestamp_iso,type:r.record_type})));
    if(header.join('|')==='date|type|value|details|source')
      return review(items.filter(r=>r.type==='Glucose').map(r=>({...r,glucose_mg_dl:r.value})),items.filter(r=>r.type!=='Glucose').map(r=>({...r,description:r.details,details:''})));
    throw Error('File not recognized. Choose a LibreView, lab or SohStx export.');
  }
  function review(readings,events){
    const records=[];
    for(const item of readings){
      const value=Number(item.glucose_mg_dl);if(!Number.isFinite(value)||value<=0)throw Error('Invalid glucose result.');
      const date=new Date(item.date).toISOString();
      records.push({id:'review:'+date+':'+value,date,source:'libreview',raw:{date,bgl:value,eventType:'GLUCOSE',msgType:'LIBREVIEW',libreKind:'historic',description:'Imported clinical reading'}});
    }
    for(const e of events){
      const date=new Date(e.date).toISOString(),text=String(e.description||''),details=String(e.details||''),type=String(e.type||'event');
      records.push({id:'review:'+JSON.stringify([date,type,text,details]),date,source:e.source||'manual',raw:{date,bgl:'',eventType:type,text,details}});
    }
    return {records,labs:[]};
  }
  async function merge(payload){
    if(!Array.isArray(payload.records)||!Array.isArray(payload.labs))throw Error('Invalid export structure.');
    const labs=readLabs(),keys=new Set(labs.map(labKey)),before=labs.length;
    for(const item of payload.labs){
      const r=Object.fromEntries(labFields.map(k=>[k,String(item[k]??'').trim()]));
      if(!r.test||!r.result||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||new Date(r.date).toISOString().slice(0,10)!==r.date)throw Error('Invalid lab row.');
      if(!keys.has(labKey(r))){labs.push(r);keys.add(labKey(r));}
    }
    const existing=await getAll(), ids=new Set(existing.map(r=>r.id));
    const identity=r=>JSON.stringify([Date.parse(r.date),r.raw.bgl!==''&&r.raw.bgl!=null?Number(r.raw.bgl):[r.raw.eventType,r.raw.text||r.raw.description||'',r.raw.details||'']]);
    const signatures=new Set(existing.map(identity)),fresh=[];
    for(const r of payload.records){
      if(!r||typeof r.id!=='string'||!r.id||!Number.isFinite(Date.parse(r.date))||!r.raw||typeof r.raw!=='object'||typeof r.source!=='string')throw Error('Invalid health record.');
      const sig=identity(r);
      if(!ids.has(r.id)&&!(r.id.startsWith('review:')&&signatures.has(sig)))fresh.push(r);
      ids.add(r.id);signatures.add(sig);
    }
    if(fresh.length)await transaction('readwrite',s=>fresh.forEach(r=>s.add(r)));
    if(labs.length!==before)localStorage.setItem(labsKey,JSON.stringify(labs));
    await refresh();
    document.querySelector('#view-labs .lab-wrap select')?.dispatchEvent(new Event('change'));
    return fresh.length+' health records and '+(labs.length-before)+' labs added.';
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={classify,encode};return;}
  function setup(){
    const home=document.getElementById('importBtn');if(!home||document.getElementById('view-data'))return;
    const btn=t=>{const b=document.createElement('button');b.type='button';b.textContent=t;return b;};
    const tab=btn('Data');tab.className='tab';tab.dataset.tab='data';document.querySelector('.tabs').append(tab);
    const view=document.createElement('section');view.className='view';view.id='view-data';
    view.innerHTML='<section class="panel"><h2>Import &amp; export</h2><p>Import LibreView, monthly labs or a SohStx CSV or JSON file.</p><div class="v21-actions data-import"></div><h3>Complete backup &amp; Clinical handoff</h3><p>Includes saved readings, journal entries and lab results.</p><div class="v21-actions data-backup"></div><details><summary>Other export formats</summary><div class="v21-actions data-other"></div></details></section>';
    document.querySelector('main footer').before(view);
    tab.addEventListener('click',()=>{setTab('data');requestAnimationFrame(()=>document.getElementById('pageTitle').textContent='Import & export');});
    const input=document.createElement('input');input.type='file';input.accept='.csv,.json';input.hidden=true;view.append(input);
    const pick=e=>{e.preventDefault();e.stopImmediatePropagation();input.click();};
    home.textContent='Import file';home.addEventListener('click',pick,true);
    // The header picker remains visible on the Data tab too.
    let busy=false;
    input.onchange=async()=>{
      const f=input.files[0];if(!f||busy)return;busy=true;home.disabled=true;
      try{const result=classify(await f.text(),parseCSV);if(result==='libre')await importCSV(f);else notice(await merge(result));}
      catch(e){notice('Import: '+e.message);}finally{busy=false;home.disabled=false;input.value='';}
    };
    const full=btn('Export combined CSV');view.querySelector('.data-backup').append(full);
    full.onclick=async()=>{try{const rs=await getAll(),ls=readLabs();if(!rs.length&&!ls.length)return notice('No records to export.');
      download('SohStx-combined-'+new Date().toISOString().slice(0,10)+'.csv',encode(rs,ls),'text/csv;charset=utf-8');notice('Exported '+rs.length+' records and '+ls.length+' lab results.');}catch(e){notice(e.message);}};
    const other=view.querySelector('.data-other');
    for(const id of ['v21Export','v21ExportCsv','exportCsvBtn','backupBtn']){const b=document.getElementById(id);if(b)other.append(b);}
    const status=document.getElementById('v21ExportStatus');if(status)view.querySelector('details').append(status);
    const labShare=document.querySelector('.lab-export');if(labShare)other.append(labShare);
    const labActions=document.querySelector('.lab-actions');if(labActions)labActions.hidden=true;
    if(labActions)labActions.style.display='none';
    const restore=document.getElementById('restoreBtn');if(restore)restore.style.display='none';
    const old=document.querySelector('#view-tools .v21-panel');const link=old?.querySelector('a');if(link)view.querySelector('.data-backup').append(link);if(old)old.hidden=true;
  }
  if(document.readyState==='complete')setup();else window.addEventListener('load',setup,{once:true});
})();
