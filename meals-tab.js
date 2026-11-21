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
  const profile={
    'Cod':[1,90,20,0,1],
    'Core Power Chocolate 42 g':[1,230,42,9,3.5],
    'White rice (dry)':[0.25,160,3,36,0],
    'White rice (cooked)':[0.25,51,1.1,11.1,0.1],
    'Mott’s fruit bar':[1,140,1,26,4]
  };
  function estimate(items){
    const sums={};
    for(const item of items||[]){
      const p=profile[item.name];if(!p||!Number.isFinite(item.quantity)||item.quantity<=0)continue;
      nutrients.forEach(([key],i)=>{sums[key]=(sums[key]||0)+item.quantity/p[0]*p[i+1];});
    }
    return sums;
  }
  function savedValues(raw){
    const v={...estimate(raw.mealItems)};
    const patterns={kcal:/([\d.]+)\s*kcal/i,protein:/([\d.]+)\s*g\s*protein/i,carbs:/([\d.]+)\s*g\s*carb/i,fat:/([\d.]+)\s*g\s*fat/i};
    for(const [k] of nutrients){
      const stored=raw.nutrition?.[k], match=(raw.details||'').match(patterns[k]);
      if(Number.isFinite(stored))v[k]=stored;
      else if(match&&Number.isFinite(Number(match[1])))v[k]=Number(match[1]);
    }
    return v;
  }
  function rolling(rows,now){
    const sums={};let count=0,incomplete=0;
    for(const r of rows){
      const t=Date.parse(r.date);if(!isMeal(r)||!(t>now-86400000&&t<=now))continue;
      count++;const v=savedValues(r.raw);
      if(nutrients.some(([k])=>v[k]==null)||r.raw.mealExtra&&!r.raw.manualTotals)incomplete++;
      for(const [k] of nutrients)if(v[k]!=null)sums[k]=(sums[k]||0)+v[k];
    }
    return {sums,count,incomplete};
  }
  function formatMacros(v){return nutrients.map(([k,label,unit])=>label+' '+(v[k]==null?'—':Number(v[k].toFixed(1))+' '+unit)).join(' · ');}
  function summarizeMeals(records, days, now=new Date()){
    const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-days+1);
    const byDay=new Map(),foods=new Map(), sums={}, counts={};
    let meals=0,incomplete=0;
    for(const row of records){
      const time=new Date(row.date);
      if(!isMeal(row)||!(time>=start&&time<=now))continue;
      const key=[time.getFullYear(),String(time.getMonth()+1).padStart(2,'0'),String(time.getDate()).padStart(2,'0')].join('-');
      if(!byDay.has(key))byDay.set(key,{date:key,meals:0,values:{}});
      const day=byDay.get(key),v=savedValues(row.raw);day.meals++;meals++;
      if(nutrients.some(([k])=>!Number.isFinite(v[k]))||row.raw.mealExtra&&!row.raw.manualTotals)incomplete++;
      for(const [k] of nutrients)if(Number.isFinite(v[k]))day.values[k]=(day.values[k]??0)+v[k];
      for(const item of row.raw.mealItems||[]){
        if(!Object.hasOwn(profile,item.name)||!Number.isFinite(item.quantity)||item.quantity<=0)continue;
        const k=JSON.stringify([item.name,item.unit]),food=foods.get(k)||{name:item.name,unit:item.unit,quantity:0,kcal:0};
        food.quantity+=item.quantity;food.kcal+=estimate([item]).kcal;foods.set(k,food);
      }
    }
    for(const day of byDay.values())for(const [k,v] of Object.entries(day.values)){sums[k]=(sums[k]??0)+v;counts[k]=(counts[k]??0)+1;}
    return {meals,incomplete,days:[...byDay.values()].sort((a,b)=>b.date.localeCompare(a.date)),foods:[...foods.values()].sort((a,b)=>b.kcal-a.kcal),sums,counts};
  }
  if(typeof module!=='undefined'&&module.exports){module.exports={makeMeal,isMeal,estimate,rolling,summarizeMeals};return;}
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
    const day=document.createElement('section');
    const dayTitle=document.createElement('h3');dayTitle.textContent='Last 24 hours';
    const amounts=document.createElement('strong'), coverage=document.createElement('p');
    day.append(dayTitle,amounts,coverage);composer.append(day);
    const insights=document.createElement('section');insights.className='panel meal-insights';
    view.querySelector('.meal-list').parentElement.before(insights);
    insights.innerHTML='<h2>Nutrition patterns</h2><label>Review period<select><option value="7">Last 7 calendar days</option><option value="30">Last 30 calendar days</option></select></label><p class="coverage"></p><div class="metrics averages"></div><h3>Foods by estimated calories</h3><div class="foods"></div><h3>Day by day</h3><div class="tablewrap daily"></div>';
    const period=insights.querySelector('select');
    const node=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
    const rounded=n=>n.toLocaleString(undefined,{maximumFractionDigits:1});
    function renderInsights(){
      const report=summarizeMeals(visibleEvents(),Number(period.value));
      insights.querySelector('.coverage').textContent=report.meals+' meals on '+report.days.length+' of '+period.value+' days, including today. Averages use days with a recorded value. '+report.incomplete+' meals have partial or missing nutrition.';
      const cards=insights.querySelector('.averages');cards.replaceChildren();
      for(const [k,title,unit] of nutrients){
        const card=node('article','');card.className='metric';const n=report.counts[k]||0;
        card.append(node('span',title+' / logged day'),node('div',n?rounded(report.sums[k]/n)+' '+unit:'—'),node('small',n+' days with data'));cards.append(card);
      }
      const foods=insights.querySelector('.foods');foods.replaceChildren();
      foods.append(node('p',report.foods.length?'Based on food-button portions. Manual meal totals can differ.':'Log a meal with food buttons to see what contributes the most calories.'));
      for(const food of report.foods){
        const label=food.name==='Cod'?'Cod (3 oz portions)':food.name;
        foods.append(node('div',label+' · '+rounded(food.quantity)+' '+food.unit+(food.quantity>1?'s':'')+' · '+rounded(food.kcal)+' kcal'));
        const bar=document.createElement('progress');bar.max=report.foods[0].kcal||1;bar.value=food.kcal;bar.setAttribute('aria-label',label+' estimated calories');bar.style.width='100%';foods.append(bar);
      }
      const table=node('table',''),head=table.createTHead().insertRow();
      for(const t of ['Date','Meals','kcal','Protein (g)','Carbs (g)','Fat (g)'])head.append(node('th',t));
      const body=table.createTBody();
      for(const d of report.days){const tr=body.insertRow();for(const t of [d.date,d.meals,...nutrients.map(([k])=>d.values[k]==null?'—':rounded(d.values[k]))])tr.insertCell().textContent=t;}
      insights.querySelector('.daily').replaceChildren(report.meals?table:node('p','No meals logged in this period.'));
    }
    period.onchange=renderInsights;
    function updateDay(){
      if(view.classList.contains("active"))renderInsights();
      const result=rolling(visibleEvents(),Date.now());
      amounts.textContent=formatMacros(result.count?result.sums:{kcal:0,protein:0,carbs:0,fat:0});
      coverage.textContent=result.count+' logged meals'+(result.incomplete?' · '+result.incomplete+' with missing or partial nutrition':'');
    }
    // Home and Meals share the same meal form and draft.
const todayPanel = document.createElement('section');
todayPanel.id = 'homeToday';
todayPanel.className = 'panel';

const todayHeading = node('h2', 'Today’s log');
const todayList = document.createElement('ul');
const nutritionLine = node('p', '');
nutritionLine.className = 'nutrition-line';

const openMeals = node('button', 'Open Meals');
openMeals.type = 'button';
openMeals.onclick = () => tab.click();

todayPanel.append(todayHeading, todayList, nutritionLine, openMeals);
home.append(todayPanel);

// Keep meal time visible beside the save action.
const timeLabel = f.when.closest('label');
const saveButton = form.querySelector('[type="submit"]');
form.insertBefore(timeLabel, saveButton);
summary.textContent = 'Other food, nutrition or notes';

let chosenTime = '';
f.when.addEventListener('input', () => {
  chosenTime = f.when.value;
});
form.addEventListener('reset', () => {
  chosenTime = '';
});

// The existing food buttons set the time on the first tap.
// Preserve a time the user has already entered for this meal.
controls.addEventListener('click', () => {
  if (chosenTime) f.when.value = chosenTime;
});

// The existing code creates the preset buttons later in setup.
queueMicrotask(() => {
  const shake = Array.from(controls.children).find(button =>
    button.textContent.startsWith('Core Power')
  );
  if (shake) controls.prepend(shake);
});

function renderToday() {
  if (!home.classList.contains('active')) return;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const events = visibleEvents();
  const entries = events.filter(record => {
    const time = Date.parse(record.date);
    return time >= start.getTime() && time <= now.getTime();
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  todayList.replaceChildren();
  if (!entries.length) {
    todayList.append(node('li', 'Nothing logged today yet.'));
  }

  for (const entry of entries) {
    const time = new Date(entry.date).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });
    const raw = entry.raw || {};
    const name = raw.text || raw.description || raw.eventType || 'Event';
    todayList.append(node('li', time + ' · ' + name));
  }

  const report = summarizeMeals(events, 1, now);
  if (!report.meals) {
    nutritionLine.textContent = 'Today’s nutrition · No meals logged yet.';
  } else {
    const kcal = report.sums.kcal;
    const protein = report.sums.protein;
    nutritionLine.textContent = 'Today’s logged nutrition · ' +
      (kcal == null ? 'Calories unavailable' : rounded(kcal) + ' kcal') +
      ' · ' +
      (protein == null ? 'Protein unavailable' : rounded(protein) + ' g protein') +
      (report.incomplete ? ' · Partial nutrition data' : '');
  }
}

function refreshHome() {
  // Keep the existing rolling 24-hour detail on the Meals tab.
  day.hidden = home.classList.contains('active');
  renderToday();
}

const homeUpdates = new MutationObserver(refreshHome);
homeUpdates.observe(home, {
  attributes: true,
  attributeFilter: ['class']
});

// The app refreshes its timeline after saves, imports and deletions.
const timeline = document.getElementById('timeline');
if (timeline) homeUpdates.observe(timeline, { childList: true });

function updateClock() {
  updateDay();
  refreshHome();
}

setInterval(updateClock, 60000);
window.addEventListener('focus', updateClock);
refreshHome();
    function draft(){
      const v=estimate(portions());for(const [k] of nutrients)if(f[k].value!=='')v[k]=Number(f[k].value);
      return v;
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
      total.textContent=Object.keys(draft()).length?'Meal estimate · '+formatMacros(draft()):'Tap a food to start a meal.';
    }
    for(const [i,[name,step,unit]] of presets.entries()){
      const b=document.createElement('button');b.type='button';b.textContent=name;
      const detail=document.createElement('small');detail.textContent=name==='Cod'?'3 oz cooked, plain':name==='Mott’s fruit bar'?'1 strawberry soft baked bar (37 g)':'+ '+step+' '+unit;b.append(detail);
      b.onclick=()=>{if(!portions().length&&!f.mealName.value&&!extras.open)f.when.value=localDateTime();quantities[i]++;status.textContent='';showBasket();};controls.append(b);
    }
    nutrientDetails.querySelector('summary').textContent='Override meal totals or add notes';form.addEventListener('input',showBasket);f.when.value=localDateTime(); showBasket();updateDay();
    function placeComposer(){updateDay();
      if(home.classList.contains('active'))home.prepend(composer);
      else if(view.classList.contains('active'))view.prepend(composer);
    }
    const watcher=new MutationObserver(placeComposer);
    for(const section of [home,view])watcher.observe(section,{attributes:true,attributeFilter:['class']});
    placeComposer();
    let limit=20;
    function history(){
      renderInsights();
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
          for(const [k] of nutrients)f[k].value=(r.raw.manualTotals?.[k]??(r.raw.autoNutrition?undefined:r.raw.nutrition?.[k]))??'';
          showBasket();
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
        const r=makeMeal(name,f.when.value,draft(),f.notes.value.trim());
        r.raw.autoNutrition=true;r.raw.manualTotals=Object.keys(values).length?values:null;r.raw.mealItems=items;r.raw.mealExtra=f.mealName.value.trim();await transaction('readwrite',store=>store.add(r));
        form.reset();quantities.fill(0);showBasket();extras.open=false;nutrientDetails.open=false;f.when.value=localDateTime();form.querySelector('details').open=false;status.textContent='Saved '+name+'.';
        await refresh();history();updateDay();
      }catch(err){status.textContent='Check Records before retrying: '+err.message;}
      finally{save.disabled=false;}
    };
  }
  if(document.readyState==='complete')setup();else window.addEventListener('load',setup,{once:true});
})();
      
