/* SohStx Personal: meal journal */
(() => {
  const nutrients = [['kcal','Calories','kcal'],['protein','Protein','g'],['carbs','Carbs','g'],['fat','Fat','g']];
  function isMeal(r) {
    const raw=r.raw||{};
    return /^(meal|food|breakfast|lunch|dinner|snack)$/i.test(raw.eventType||'') ||
      ((r.source==='quick_log'||r.source==='quick-log'||r.source==='libreview') &&
       /\b(meal|breakfast|lunch|dinner|snack|kcal)\b/i.test([raw.text,raw.description,raw.details].join(' ')));
  }
  function makeMeal(name,when,values,notes) {
    const date=new Date(when).toISOString();
    const details=nutrients.filter(([k])=>values[k]!=null).map(([k,label,unit])=>
      k==='kcal'?values[k]+' kcal':values[k]+' '+unit+' '+label.toLowerCase());
    if(notes)details.push(notes);
    return {id:'manual:'+crypto.randomUUID(),source:'manual',date,raw:{date,bgl:'',eventType:'meal',msgType:'MANUAL',text:name,details:details.join('; '),nutrition:values,mealNotes:notes}};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={makeMeal,isMeal};return;}
  function setup(){
    const tabs=document.querySelector('.tabs');
    if(!tabs||!document.getElementById('eventForm')||document.getElementById('view-meals'))return;
    const tab=document.createElement('button');tab.type='button';tab.className='tab';tab.dataset.tab='meals';tab.textContent='Meals';
    const anchor=tabs.querySelector('[data-tab="records"]');tabs.insertBefore(tab,anchor);
    const view=document.createElement('section');view.id='view-meals';view.className='view';
    view.innerHTML=`<section class="panel"><h2>Log a meal</h2><form>
      <label>What did you eat?<input name="mealName" required maxlength="500" placeholder="Cod, rice and a chocolate shake"></label>
      <label>When<input name="when" type="datetime-local" required></label>
      <details><summary>Nutrition &amp; notes (optional)</summary><div class="meal-nutrients"></div>
      <label>Notes<input name="notes" maxlength="1000"></label></details>
      <button class="primary" type="submit">Save meal</button></form><p role="status"></p></section>
      <section class="panel"><h2>Meal history</h2><div class="meal-list"></div></section>`;
    document.querySelector('main footer').before(view);
    const form=view.querySelector('form'), f=form.elements, status=view.querySelector('[role=status]');
    const style=document.createElement('style');style.textContent='#view-meals .meal-nutrients{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}#view-meals summary{padding:10px 0;cursor:pointer}#view-meals .entry{display:grid;gap:4px}#view-meals .entry button{justify-self:start}';document.head.append(style);
    for(const [key,label,unit] of nutrients){
      const l=document.createElement('label');l.textContent=label+' ('+unit+')';
      const input=document.createElement('input');input.name=key;input.type='number';input.min=0;input.step='any';input.inputMode='decimal';l.append(input);view.querySelector('.meal-nutrients').append(l);
    }
    let limit=20;
    function history(){
      const list=view.querySelector('.meal-list');list.replaceChildren();
      const meals=visibleEvents().filter(isMeal).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
      if(!meals.length)list.textContent='Your saved meals will appear here.';
      for(const r of meals.slice(0,limit)){
        const row=document.createElement('article');row.className='entry';
        const name=r.raw.text||r.raw.description||'Meal';
        for(const [tag,t] of [['strong',name],['small',new Date(r.date).toLocaleString()],['span',r.raw.details]]){
          if(t){const el=document.createElement(tag);el.textContent=t;row.append(el);}
        }
        const repeat=document.createElement('button');repeat.type='button';repeat.textContent='Use this meal';
        repeat.onclick=()=>{
          f.mealName.value=name;f.when.value=localDateTime();
          for(const [k] of nutrients)f[k].value=r.raw.nutrition?.[k]??'';
          f.notes.value=r.raw.mealNotes??r.raw.details??'';
          form.querySelector('details').open=!!(f.notes.value||r.raw.nutrition);
          status.textContent='Meal copied. Adjust it and tap Save meal.';f.mealName.focus();form.scrollIntoView({block:'center'});
        };row.append(repeat);list.append(row);
      }
      if(meals.length>limit){const more=document.createElement('button');more.textContent='Show more meals';more.onclick=()=>{limit+=20;history();};list.append(more);}
    }
    tab.addEventListener('click',()=>{
      setTab('meals');requestAnimationFrame(()=>{if(view.classList.contains('active'))document.getElementById('pageTitle').textContent='Meals';});
      if(!f.mealName.value.trim())f.when.value=localDateTime();history();
    });
    form.onsubmit=async e=>{
      e.preventDefault();const save=form.querySelector('[type=submit]');if(save.disabled)return;
      const name=f.mealName.value.trim();if(!name){status.textContent='Enter a meal name.';return;}
      save.disabled=true;
      try{
        const values={};for(const [k] of nutrients)if(f[k].value!=='')values[k]=Number(f[k].value);
        const r=makeMeal(name,f.when.value,values,f.notes.value.trim());
        await transaction('readwrite',store=>store.add(r));
        form.reset();f.when.value=localDateTime();form.querySelector('details').open=false;status.textContent='Saved '+name+'.';
        await refresh();history();
      }catch(err){status.textContent='Check Records before retrying: '+err.message;}
      finally{save.disabled=false;}
    };
  }
  if(document.readyState==='complete')setup();else window.addEventListener('load',setup,{once:true});
})();
