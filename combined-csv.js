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
  if(typeof module!=='undefined' && module.exports){module.exports={encode,decode,labKey};return;}
  const clinical=location.pathname.startsWith('/clinical/');
  const panel=document.querySelector('#view-labs .lab-actions');if(!panel)return;
  const key='sohstx-lab-history-v1-'+(clinical?'clinical':'personal');
  const status=document.createElement('p');status.setAttribute('role','status');panel.after(status);
  const readLabs=()=>JSON.parse(localStorage.getItem(key)||'[]');
  function button(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;panel.append(b);return b;}
  if(!clinical)button('Export combined CSV',async()=>{
    try{
      const saved=await getAll(), labs=readLabs();
      if(!saved.length&&!labs.length)throw Error('No data to export.');
      const url=URL.createObjectURL(new Blob([encode(saved,labs)],{type:'text/csv;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='SohStx-combined-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
      status.textContent='Exported '+saved.length+' health records and '+labs.length+' lab results. Includes saved journal entries.';
    }catch(e){status.textContent=e.message;}
  });
  const input=document.createElement('input');input.type='file';input.accept='.csv';input.hidden=true;panel.append(input);
  const load=button(clinical?'Import combined CSV':'Restore combined CSV',()=>input.click());
  input.onchange=async()=>{
    load.disabled=true;
    try{
      const incoming=decode(await input.files[0].text()),labs=readLabs(),known=new Set(labs.map(labKey)),start=labs.length;
      for(const r of incoming.labs)if(!known.has(labKey(r))){labs.push(r);known.add(labKey(r));}
      let added=0;
      if(clinical){
        const copy=JSON.parse(localStorage.getItem('sohstx-clinical-import-v1')||'{"readings":[],"events":[]}');
        if(!copy||Array.isArray(copy)||typeof copy!=='object')throw Error('Export your existing Clinical copy before switching formats.');
        copy.readings??=[];copy.events??=[];
        const prior=new Set(copy.readings.map(r=>Date.parse(r.date)+'|'+Number(r.glucose_mg_dl)));
        const eventKey=r=>JSON.stringify([Date.parse(r.date),r.type,r.description,r.details]);
        const events=new Set(copy.events.map(eventKey));
        for(const r of incoming.records){
          const raw=r.raw;
          if(raw.bgl!=='' && raw.bgl!=null && Number.isFinite(Number(raw.bgl))){
            const k=Date.parse(r.date)+'|'+Number(raw.bgl);if(prior.has(k))continue;prior.add(k);
            copy.readings.push({date:r.date,glucose_mg_dl:Number(raw.bgl),source:r.source});added++;
          }else{
            const e={date:r.date,type:raw.eventType||'event',description:raw.text||raw.description||'',details:raw.details||'',source:r.source};
            const k=eventKey(e);if(events.has(k))continue;events.add(k);copy.events.push(e);added++;
          }
        }
        localStorage.setItem('sohstx-clinical-import-v1',JSON.stringify(copy));
        data=copy;render();
      }else{
        const existing=new Set((await getAll()).map(r=>r.id));
        await transaction('readwrite',store=>{for(const r of incoming.records)if(!existing.has(r.id)){store.add(r);existing.add(r.id);added++;}});
        await refresh();
      }
      localStorage.setItem(key,JSON.stringify(labs));
      const picker=document.querySelector('#view-labs .lab-wrap select');picker?.dispatchEvent(new Event('change'));
      status.textContent='Added '+added+' health records and '+(labs.length-start)+' lab results. Existing matches skipped.';
    }catch(e){status.textContent='Import did not finish: '+e.message+' You can retry the same file.';}
    finally{load.disabled=false;input.value='';}
  };
})();
