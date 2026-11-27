export const TABLE={left:108,right:892,top:98,bottom:462};
export const POCKETS=[
 {x:100,y:90},{x:500,y:90},{x:900,y:90},
 {x:100,y:470},{x:500,y:470},{x:900,y:470}
];
export const BALL_RADIUS=12;

const counts={'8-ball':15,'9-ball':9,'10-ball':10,'straight-pool':15,cutthroat:15,practice:9};

export function createRack(mode='8-ball'){
 const count=counts[mode]??15;
 const balls=[{number:0,x:250,y:280,vx:0,vy:0,active:true}];
 let number=1;
 const spacing=BALL_RADIUS*2+1.25;
 for(let row=0;number<=count;row++){
  for(let col=0;col<=row&&number<=count;col++){
   balls.push({
    number,x:620+row*spacing*.866,
    y:280+(col-row/2)*spacing,
    vx:0,vy:0,active:true
   });
   number++;
  }
 }
 return balls;
}

export function shoot(balls,aim,power=.65){
 const cue=balls.find(b=>b.number===0&&b.active);
 if(!cue||!aim||!Number.isFinite(aim.x)||!Number.isFinite(aim.y))return false;
 const dx=aim.x-cue.x,dy=aim.y-cue.y,length=Math.hypot(dx,dy);
 if(length<8)return false;
 const speed=2.5+Math.max(0,Math.min(1,power))*12;
 cue.vx=dx/length*speed;
 cue.vy=dy/length*speed;
 return true;
}

export function isMoving(balls){
 return balls.some(b=>b.active&&Math.hypot(b.vx,b.vy)>.045);
}

export function stepPhysics(balls){
 const pocketed=[];
 let firstContact=null;
 for(const b of balls){
  if(!b.active)continue;
  b.x+=b.vx;b.y+=b.vy;
  b.vx*=.985;b.vy*=.985;
  if(Math.hypot(b.vx,b.vy)<.025)b.vx=b.vy=0;
  const pocketIndex=POCKETS.findIndex(p=>Math.hypot(b.x-p.x,b.y-p.y)<24);
  if(pocketIndex>=0){b.active=false;b.vx=b.vy=0;b.pocketIndex=pocketIndex;pocketed.push(b.number);continue;}
  if(b.x<TABLE.left+BALL_RADIUS){b.x=TABLE.left+BALL_RADIUS;b.vx=Math.abs(b.vx)*.91;}
  if(b.x>TABLE.right-BALL_RADIUS){b.x=TABLE.right-BALL_RADIUS;b.vx=-Math.abs(b.vx)*.91;}
  if(b.y<TABLE.top+BALL_RADIUS){b.y=TABLE.top+BALL_RADIUS;b.vy=Math.abs(b.vy)*.91;}
  if(b.y>TABLE.bottom-BALL_RADIUS){b.y=TABLE.bottom-BALL_RADIUS;b.vy=-Math.abs(b.vy)*.91;}
 }
 const active=balls.filter(b=>b.active);
 for(let i=0;i<active.length;i++){
  for(let j=i+1;j<active.length;j++){
   const a=active[i],b=active[j],dx=b.x-a.x,dy=b.y-a.y;
   const distance=Math.hypot(dx,dy),minimum=BALL_RADIUS*2;
   if(!distance||distance>=minimum)continue;
   const nx=dx/distance,ny=dy/distance,overlap=minimum-distance;
   a.x-=nx*overlap/2;a.y-=ny*overlap/2;
   b.x+=nx*overlap/2;b.y+=ny*overlap/2;
   const relative=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
   if(relative>0){
    if(firstContact===null&&(a.number===0||b.number===0))
     firstContact=a.number===0?b.number:a.number;
    a.vx-=relative*nx;a.vy-=relative*ny;
    b.vx+=relative*nx;b.vy+=relative*ny;
   }
  }
 }
 return {pocketed,firstContact};
}
