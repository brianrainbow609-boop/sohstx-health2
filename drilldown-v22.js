
'use strict';
(() => {
  const $=id=>document.getElementById(id);
  const fmt=t=>new Date(t).toLocaleString();
  const avg=a=>a.length?a.reduce((s,p)=>s+p.value,0)/a.length:0;
  const localDay=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  function rangeData(){
    const a=validReadings(),r=$('v21Range').value;
    if(r==='all')return a;
    if(r==='custom')return a.filter(p=>(!$('v21From').value||localDay(p.time)>=$('v21From').value)&&(!$('v21To').value||localDay(p.time)<=$('v21To').value));
    return a.length?a.filter(p=>p.time>=a.at(-1).time-Number(r)*86400000):[];
  }
  function modal(title,subtitle,points){
    document.querySelector('.v22-overlay')?.remove();
    const overlay=document.createElement('div');overlay.className='v22-overlay';
    const dialog=document.createElement('section');dialog.className='v22-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
    const head=document.createElement('div');head.className='v22-head';
    const titleBox=document.createElement('div'),h=document.createElement('h2');h.textContent=title;
    const sub=document.createElement('p');sub.textContent=subtitle;titleBox.append(h,sub);
    const close=document.createElement('button');close.type='button';close.className='v22-close';close.textContent='✕ Close';head.append(titleBox,close);
    const summary=document.createElement('div');summary.className='v22-stats';
    const stats=points.length?[
      ['Readings',points.length.toLocaleString()],
      ['Mean',avg(points).toFixed(1)+' mg/dL'],
      ['Lowest',Math.min(...points.map(p=>p.value))+' mg/dL'],
      ['Highest',Math.max(...points.map(p=>p.value))+' mg/dL'],
      ['In range',(100*points.filter(p=>p.value>=70&&p.value<=180).length/points.length).toFixed(1)+'%']
    ]:[['Readings','0']];
    for(const [label,value] of stats){const box=document.createElement('div');box.className='v22-stat';const small=document.createElement('span');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;box.append(small,strong);summary.append(box);}
    const hint=document.createElement('p');hint.className='v22-hint';hint.textContent='Underlying LibreView readings · select a row to inspect nearby readings';
    const input=document.createElement('input');input.type='search';input.placeholder='Filter by date, time, or glucose value';input.setAttribute('aria-label','Filter detailed readings');
    const tableWrap=document.createElement('div');tableWrap.className='v22-tablewrap';
    const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
    for(const x of ['Date and time','Glucose','Context']){const th=document.createElement('th');th.textContent=x;tr.append(th);}thead.append(tr);
    const tbody=document.createElement('tbody');table.append(thead,tbody);tableWrap.append(table);
    const count=document.createElement('p');count.className='v22-hint';
    const sorted=[...points].sort((a,b)=>b.time-a.time);
    function fill(){
      const q=input.value.trim().toLowerCase();
      const filtered=sorted.filter(p=>fmt(p.time).toLowerCase().includes(q)||String(p.value).includes(q));
      const shown=filtered.slice(0,500);tbody.replaceChildren();
      for(const p of shown){const row=document.createElement('tr');const values=[fmt(p.time),p.value+' mg/dL',p.value<70?'Below range':p.value>180?'Above range':'In range'];
        for(const v of values){const td=document.createElement('td');td.textContent=v;row.append(td);}
        row.tabIndex=0;row.onclick=()=>{const near=validReadings().filter(x=>Math.abs(x.time-p.time)<=30*60000);modal('Reading at '+fmt(p.time),p.value+' mg/dL · readings within 30 minutes',near);};row.onkeydown=e=>{if(e.key==='Enter')row.click();};tbody.append(row);
      }
      count.textContent=`Showing ${shown.length.toLocaleString()} of ${filtered.length.toLocaleString()} matching readings${filtered.length>500?' (first 500; refine search to see more)':''}`;
    }
    input.addEventListener('input',fill);fill();
    dialog.append(head,summary,hint,input,tableWrap,count);overlay.append(dialog);document.body.append(overlay);
    const old=document.activeElement;
    const dismiss=()=>{overlay.remove();document.removeEventListener('keydown',esc);old?.focus?.();};
    const esc=e=>{if(e.key==='Escape')dismiss();};
    document.addEventListener('keydown',esc);close.onclick=dismiss;overlay.onclick=e=>{if(e.target===overlay)dismiss();};close.focus();
  }
  function showHour(hour){const a=rangeData().filter(p=>new Date(p.time).getHours()===hour);modal(`${String(hour).padStart(2,'0')}:00–${String((hour+1)%24).padStart(2,'0')}:00`,'Hourly glucose readings from your selected analysis period',a);}
  function showBand(i){const ranges=[p=>p.value<54,p=>p.value>=54&&p.value<70,p=>p.value>=70&&p.value<=180,p=>p.value>180&&p.value<=250,p=>p.value>250];
    const labels=['Very low: below 54','Low: 54–69','In range: 70–180','High: 181–250','Very high: above 250'];
    modal(labels[i]+' mg/dL','All readings in this glucose band',rangeData().filter(ranges[i]));}
  function chartInspect(e,id,hours){const canvas=$(id),a=validReadings();if(!a.length)return;
    const end=a.at(-1).time,range=hours==='all'?a:a.filter(p=>p.time>=end-Number(hours)*3600000);
    if(!range.length)return;
    const rect=canvas.getBoundingClientRect(),width=rect.width;
    const fraction=Math.max(0,Math.min(1,(e.clientX-rect.left-43)/(width-57)));
    const t=range[0].time+fraction*(range.at(-1).time-range[0].time);
    let best=range[0];for(const p of range)if(Math.abs(p.time-t)<Math.abs(best.time-t))best=p;
    const around=range.filter(p=>Math.abs(p.time-best.time)<=60*60000);
    modal('Glucose detail: '+best.value+' mg/dL',fmt(best.time)+' · readings within one hour',around);
  }
  function install(){
    $('v21Profile')?.addEventListener('click',e=>{const svg=$('v21Profile').querySelector('svg');if(!svg)return;const r=svg.getBoundingClientRect();const x=(e.clientX-r.left)*640/r.width;showHour(Math.max(0,Math.min(23,Math.round((x-44)/24.5))));});
    $('v21Profile')?.setAttribute('title','Tap an hour for its readings');
    $('hourlyBars')?.addEventListener('click',e=>{const col=e.target.closest('.hour');if(col)showHour([...col.parentNode.children].indexOf(col));});
    $('bands')?.addEventListener('click',e=>{const band=e.target.closest('.band');if(band)showBand([...band.parentNode.children].indexOf(band));});
    $('dailyTable')?.addEventListener('click',e=>{const row=e.target.closest('tbody tr');if(!row)return;const day=row.cells[0]?.textContent;modal('Daily detail: '+day,'All readings recorded on this day',validReadings().filter(p=>localDay(p.time)===day));});
    $('homeChart')?.addEventListener('click',e=>chartInspect(e,'homeChart','24'));
    $('chart')?.addEventListener('click',e=>chartInspect(e,'chart',$('range').value));
    document.querySelectorAll('#view-home .metric,#view-analysis .metrics.analytics .metric').forEach(card=>{
      card.tabIndex=0;card.setAttribute('role','button');card.title='Tap for detailed glucose readings';
      const action=()=>modal('Glucose readings','Complete LibreView history; filter to inspect individual measurements',validReadings());
      card.addEventListener('click',action);card.addEventListener('keydown',e=>{if(e.key==='Enter')action();});
    });
    const note=document.createElement('p');note.className='v22-hint';note.textContent='Interactive: tap any hour, glucose band, daily row, or chart to open underlying readings.';
    $('v21Profile')?.parentElement?.append(note);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
