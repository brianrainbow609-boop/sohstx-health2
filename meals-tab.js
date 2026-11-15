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
    // One composer follows the user between Home and Meals so there is one draft.
    const composer=form.closest('.panel');
    const home=document.getElementById('view-home');
    const presets=[
      ['Cod',1,'piece'],['Core Power Chocolate 42 g',1,'bottle'],
      ['White rice (dry)',0.25,'cup'],['White rice (cooked)',0.25,'cup'],
      ['Mott’s fruit bar',1,'bar']
    ];
    const quantities=presets.map(()=>0);
    const controls=document.createElement('div');controls.className='food-buttons';
    const basket=document.createElement('div');basket.className='food-basket';
    const total=document.createElement('p');total.setAttribute('aria-live','polite');
    const custom=form.querySelector('label');
    custom.firstChild.textContent='Other food or meal name (optional)';
    f.mealName.required=false;f.mealName.placeholder='Add something else';
    const extras=document.createElement('details');const summary=document.createElement('summary');
    summary.textContent='Other food, time or nutrition';extras.append(summary);
    const nutrientDetails=form.querySelector('details');
    extras.append(custom,f.when.closest('label'),nutrientDetails);
    form.prepend(controls,basket,total,extras);
    style.textContent+='.food-buttons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.food-buttons button{min-height:58px;text-align:left;background:#183b40;color:#ecfff8;border-color:#448475}.food-basket>div{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}.food-basket button{min-width:44px}.food-buttons small{display:block}';
    function portions(){
      return presets.flatMap(([name,step,unit],i)=>quantities[i]?[{name,quantity:quantities[i]*step,unit}]:[]);
    }
    function describe(item){
      return item.quantity+' '+item.unit+(item.quantity>1?'s':'')+' '+item.name;
    }
    function showBasket(){
      basket.replaceChildren();
      const selected=portions();
      for(const [i,preset] of presets.entries()){
        if(!quantities[i])continue;
        const row=document.createElement('div'), label=document.createElement('span'),remove=document.createElement('button');
        label.textContent=describe({name:preset[0],quantity:quantities[i]*preset[1],unit:preset[2]});
        remove.type='button';remove.textContent='−';remove.setAttribute('aria-label','Remove one portion of '+preset[0]);
        remove.onclick=()=>{quantities[i]--;showBasket();};row.append(label,remove);basket.append(row);
      }
      total.textContent=selected.length?'':'Tap a food to start a meal.';
    }
    for(const [i,[name,step,unit]] of presets.entries()){
      const b=document.createElement('button');b.type='button';b.textContent=name;
      const detail=document.createElement('small');detail.textContent='+ '+step+' '+unit;b.append(detail);
      b.onclick=()=>{if(!portions().length&&!f.mealName.value&&!extras.open)f.when.value=localDateTime();quantities[i]++;status.textContent='';showBasket();};controls.append(b);
    }
    f.when.value=localDateTime(); showBasket();
    function placeComposer(){
      if(home.classList.contains('active'))home.prepend(composer);
      else if(view.classList.contains('active'))view.prepend(composer);
    }
    const watcher=new MutationObserver(placeComposer);
    for(const section of [home,view])watcher.observe(section,{attributes:true,attributeFilter:['class']});
    placeComposer();
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
          quantities.fill(0);showBasket();extras.open=true;f.mealName.value=name;if(Array.isArray(r.raw.mealItems)&&r.raw.mealItems.length&&r.raw.mealItems.every(item=>presets.some(p=>p[0]===item.name&&p[2]===item.unit))){for(const item of r.raw.mealItems){const i=presets.findIndex(p=>p[0]===item.name);quantities[i]=item.quantity/presets[i][1];}f.mealName.value=r.raw.mealExtra||'';showBasket();}f.when.value=localDateTime();
          for(const [k] of nutrients)f[k].value=r.raw.nutrition?.[k]??'';
          f.notes.value=r.raw.mealNotes??r.raw.details??'';
          nutrientDetails.open=!!(f.notes.value||r.raw.nutrition);
          status.textContent='Meal copied. Adjust it and tap Save meal.';f.mealName.focus();form.scrollIntoView({block:'center'});
        };row.append(repeat);list.append(row);
      }
      if(meals.length>limit){const more=document.createElement('button');more.textContent='Show more meals';more.onclick=()=>{limit+=20;history();};list.append(more);}
    }
    tab.addEventListener('click',()=>{
      setTab('meals');requestAnimationFrame(()=>{if(view.classList.contains('active'))document.getElementById('pageTitle').textContent='Meals';});
      if(!f.mealName.value.trim()&&!portions().length&&!extras.open)f.when.value=localDateTime();history();
    });
    form.onsubmit=async e=>{
      e.preventDefault();const save=form.querySelector('[type=submit]');if(save.disabled)return;
      const items=portions();const name=[...items.map(describe),f.mealName.value.trim()].filter(Boolean).join(' + ');if(!name){status.textContent='Tap a food or enter a meal name.';return;}
      save.disabled=true;
      try{
        const values={};for(const [k] of nutrients)if(f[k].value!=='')values[k]=Number(f[k].value);
        const r=makeMeal(name,f.when.value,values,f.notes.value.trim());
        r.raw.mealItems=items;r.raw.mealExtra=f.mealName.value.trim();await transaction('readwrite',store=>store.add(r));
        form.reset();quantities.fill(0);showBasket();extras.open=false;nutrientDetails.open=false;f.when.value=localDateTime();form.querySelector('details').open=false;status.textContent='Saved '+name+'.';
        await refresh();history();
      }catch(err){status.textContent='Check Records before retrying: '+err.message;}
      finally{save.disabled=false;}
    };
  }
  if(document.readyState==='complete')setup();else window.addEventListener('load',setup,{once:true});
})();
