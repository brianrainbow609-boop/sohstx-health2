const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
const atlas=new Image();atlas.src='crew.webp';
function oval(x,y,a,b,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,a,b,0,0,2*Math.PI);ctx.fill()}
function shape(points,color,line='',width=3){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();if(line){ctx.strokeStyle=line;ctx.lineWidth=width;ctx.stroke()}}
function stroke(pts,color,w){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.lineWidth=w;ctx.strokeStyle=color;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke()}
function palm(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(3,2,25,7,'#517f50');shape([[-6,1],[2,-34],[-4,-64],[3,-65],[10,-33],[5,1]],'#ae7447','#645d3a',2);for(const [dx,dy] of [[-42,8],[-32,-17],[-8,-30],[26,-24],[45,-5],[29,13]]){ctx.beginPath();ctx.moveTo(1,-62);ctx.quadraticCurveTo(dx*.60,-86+dy,dx,-60+dy);ctx.quadraticCurveTo(dx*.44,-66+dy,1,-62);ctx.fillStyle=dy%2?'#277c58':'#3f9760';ctx.fill();ctx.strokeStyle='#306e50';ctx.lineWidth=1.5;ctx.stroke()}oval(0,-62,5,4,'#a97541');ctx.restore()}
function lodge(x,y,s){ctx.save();ctx.translate(x,y);ctx.scale(s,s);oval(1,1,48,12,'#698b54');shape([[-35,-30],[34,-31],[34,0],[-35,0]],'#d99a59','#775a3f');shape([[-48,-28],[-24,-65],[16,-69],[47,-35],[36,-27],[-35,-23]],'#f4bd60','#765736');for(let i=0;i<6;i++)stroke([[-24+i*7,-59],[-36+i*10,-33]],'#d3974a',2);shape([[-10,0],[-9,-21],[4,-22],[6,0]],'#794d3d');ctx.restore()}
function terrain(t){
 const g=ctx.createLinearGradient(0,0,0,565);g.addColorStop(0,'#399cb0');g.addColorStop(.55,'#72d6cf');g.addColorStop(1,'#3cb5bf');ctx.fillStyle=g;ctx.fillRect(0,0,900,565);
 for(let i=0;i<102;i++){const x=(i*149+t*3)%930-20,y=(i*83)%559;stroke([[x,y],[x+9,y+1],[x+17,y-1]],i%3?'#8edcd4':'#4daeb9',2)}
 const edge=[];for(let i=0;i<96;i++){const a=i*Math.PI/48,r=1+.044*Math.sin(a*5)+.027*Math.cos(a*9);edge.push([450+345*r*Math.cos(a),290+179*r*Math.sin(a)])}
 for(const [scale,offset,color] of [[1.13,10,'#95e2d2'],[1.06,9,'#e5f3db'],[1.025,9,'#caa974'],[1.025,3,'#f6d78d'],[.94,-7,'#b6d578'],[.9,-10,'#a2c971']])shape(edge.map(([x,y])=>[450+(x-450)*scale,290+(y-290)*scale+offset]),color);
 for(let i=0;i<95;i++){const a=i*2.399,r=Math.sqrt(i/95);oval(448+281*r*Math.cos(a),283+139*r*Math.sin(a),3+i%3,1.4,i%4?'#8eb968':'#d8df87')}
 for(const [x,y] of stations)stroke([[438,290],[(x+438)/2,(y+290)/2+7],[x,y]],'#dec88c',15);
 oval(644,284,52,24,'#dbe4a1');oval(644,284,47,20,'#5ca9ac');oval(642,287,40,13,'#88d7d2');
 for(const [x,y,s] of [[234,246,.84],[194,274,.73],[261,235,.72],[575,162,.6],[658,221,.85],[685,241,.73],[318,183,.67]])palm(x,y,s);
 for(const [x,y,s] of [[413,193,.74],[490,168,.72],[544,203,.7]])lodge(x,y,s);
 for(const [x,y] of [[225,281],[264,269],[203,298]]){oval(x,y,15,10,'#458451');for(let k=0;k<4;k++)oval(x-9+k*5,y-3+(k%2)*4,2.8,3,'#f69b44')}
 for(const [x,y] of [[406,396],[450,401]]){stroke([[x-7,y+2],[x+8,y-2]],'#846443',5)}
 oval(433,389,12,5,'#806c50');shape([[423,387],[429,373],[432,379],[436,367],[442,388]],'#e78344');oval(433,385,4,5,'#ffce59');
 for(let k=0;k<7;k++){const x=664+k*8,y=361+k*4;shape([[x-12,y],[x-5,y-5],[x+13,y+2],[x+6,y+7]],'#b88455','#806342',1)}
}
function draw(t){
 terrain(t);
 [...state.people.entries()].sort((a,b)=>a[1].y-b[1].y).forEach(([i,p])=>{
 const walk=p.dx>0.01;const frame=walk?Math.floor(state.time*7+i)%4:0,size=i===16?57:48;
 oval(p.x,p.y-1,11,3,'#698e60');if(!atlas.complete||!atlas.naturalWidth)return;
 ctx.save();ctx.translate(p.x,p.y+(walk?Math.sin(state.time*9+i):0));ctx.scale(p.face,1);ctx.drawImage(atlas,frame*96,i*96,96,96,-size/2,-size,size,size);ctx.restore()
 });
 if(state.effect===3&&atlas.naturalWidth)ctx.drawImage(atlas,Math.floor(t*6)%4*96,17*96,96,96,686,91+Math.sin(t)*9,65,65);
 const tint=phase()===3?'rgba(23,34,85,.39)':phase()===2?'rgba(217,113,68,.15)':null;if(tint){ctx.fillStyle=tint;ctx.fillRect(0,0,900,565)}
 if(state.effect===0||state.effect===3){ctx.fillStyle='rgba(45,80,110,.13)';ctx.fillRect(0,0,900,565);for(let i=0;i<70;i++){const x=(i*157-t*120)%930,y=(i*43+t*220)%580;stroke([[(x+930)%930,y],[(x+930)%930-5,y+10]],'#b2e4e5',2)}}
 if(state.effect===2||state.effect===1){ctx.fillStyle=state.effect===2?'#fba13735':'#e6ff8a21';ctx.fillRect(0,0,900,565)}
}
let last=performance.now(),refresh=0,persist=0;
function loop(now){const dt=Math.min(.15,(now-last)/1000);last=now;if(!document.hidden){tick(dt*state.speed);draw(state.time);refresh+=dt;persist+=dt;if(refresh>.4){ui();refresh=0}if(persist>4){save();persist=0}}requestAnimationFrame(loop)}requestAnimationFrame(loop);
