
const GAME_VER="4.0";


"use strict";
// ============================================================
//  游戏逻辑层（与 2D 版完全一致，仅渲染改为 three.js）
// ============================================================
const T=50,C=18,R=12,W=C*T,H=R*T;
const cvs=document.getElementById("gl");
const ov=document.getElementById("ov");
ov.width=W;ov.height=H;
const octx=ov.getContext("2d");
const mm={x:0,y:0,s:0.19,w:0,h:0}; // 小地图布局（绘制与点击命中共用）

const PR=8, PS=2.8*.4*.8, CS=PS*.1*1.2*1.15*1.4, PC="#00e676";
const ER=10, EA="#ffd740", EC="#ff1744";
// ---- Y 目标 FBX 模型（Rifle Walk To Stop）----
let gdt=0;                // 每帧 dt（秒），供动画混合器使用
const VA=Math.PI, RI=5e3, RA=Math.PI/4, DF=2e3, DD=1500;
const GR=30, PRAD=ER*2*2, ESP=.4, PPAUSE=3e3;
const BR=14;
const HUM_S=0.8;
const WALL_H=42;

let st=0,got=0,lct=0,lv=0,cf=0,gal=0,dbs=[],fc=false,tt=0,yd=0,dCode=0,dDigits=[false,false,false],dOpen=false,codeBuf="",cMode=false,bMode=false,bGrid=[],bTargets=[],bMatched=0,bCurR=0,bCurC=0,bAxis="row",bLock=0,bBuf=0,bMax=12000,bSeq=[],bTargetIdx=0,turrets=[],miniBoss=null,hasKeycard=false,hasTerminal=0,termMode=false,mbBoost=1,camActive=false,camTimer=0,camCD=0;
const pl={x:0,y:0,r:PR,s:PS,fa:0};
const ens=[], defs=[], hidd=[];
let boss=null,bd=false, ez=null,ea=false;
let walls=[],conts=[],cd=null;
let fp=true, fpYaw=0, fpPitch=0, nowT=0, SENS=0.0022, invertY=false;
const PITCH_MAX=1.4835;
let ig=false,gt=null, ic=false,cb=null;
let crouch=false;
const keys={};

// ========== 工具 ==========
function d2(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function na(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a}
function ad(a,b){return Math.abs(na(a-b))}
function pw(px,py){for(const w of walls)if(px>=w.x&&px<=w.x+w.w&&py>=w.y&&py<=w.y+w.h)return true;return false}
const CONTHX=10,CONTHY=9; // 容器碰撞半尺寸（世界单位）
function pc(x,y){for(const c of conts){if(x>=c.x-CONTHX&&x<=c.x+CONTHX&&y>=c.y-CONTHY&&y<=c.y+CONTHY)return true}return false}
function los(o,t){const dx=t.x-o.x,dy=t.y-o.y,D=Math.hypot(dx,dy);if(D<1)return true;const s=Math.ceil(D/8);for(let i=1;i<s;i++){const f=i/s;const x=o.x+dx*f,y=o.y+dy*f;if(pw(x,y))return false;if(crouch&&pc(x,y))return false}return true}
function iv(o,t,va,vr){const D=d2(o,t);if(D>vr||!los(o,t))return{inCone:false,rate:0};const dx=t.x-o.x,dy=t.y-o.y,at=Math.atan2(dy,dx),df=ad(at,o.va);if(df>va/2)return{inCone:false,rate:0};return{inCone:true,rate:(1-D/vr)*4.5+(1-df/(va/2))*.5}}
function ib(o,t){const dx=t.x-o.x,dy=t.y-o.y,at=Math.atan2(dy,dx);return ad(at,o.va)>VA/2}
function cw(x,y,r){if(!dOpen&&DR[lv]&&isBossFloor(lv,cf)){const dr=DR[lv],dp=dr.door,dx=dp.c*T+T/2,dy=dp.r*T+T/2;if(Math.abs(x-dx)<T/2+2&&Math.abs(y-dy)<T/2+2)return true}for(const w of walls){const cx=Math.max(w.x,Math.min(x,w.x+w.w)),cy=Math.max(w.y,Math.min(y,w.y+w.h));if(Math.hypot(x-cx,y-cy)<r)return true}for(const c of conts){const cx=Math.max(c.x-CONTHX,Math.min(x,c.x+CONTHX)),cy=Math.max(c.y-CONTHY,Math.min(y,c.y+CONTHY));if(Math.hypot(x-cx,y-cy)<r)return true}return false}
function rw(x,y,r){if(!cw(x,y,r))return{x,y};if(!cw(x,pl.y,r))return{x,y:pl.y};if(!cw(pl.x,y,r))return{x:pl.x,y};return{x:pl.x,y:pl.y}}
function lc(c1,c2,t){const p=parseInt;const r1=p(c1.slice(1,3),16),g1=p(c1.slice(3,5),16),b1=p(c1.slice(5,7),16),r2=p(c2.slice(1,3),16),g2=p(c2.slice(3,5),16),b2=p(c2.slice(5,7),16);return"#"+[r1+(r2-r1)*t|0,g1+(g2-g1)*t|0,b1+(b2-b1)*t|0].map(v=>v.toString(16).padStart(2,"0")).join("")}
function tc(c,r){return{x:c*T+T/2,y:r*T+T/2}}
function rpt(e){if(fc&&boss&&boss.al){const mbd2=ER*2*6,pr=e.epr||PRAD;const ang=Math.random()*Math.PI*2,r=Math.random()*pr;let cx=boss.x+Math.cos(ang)*(mbd2+r-pr/2),cy=boss.y+Math.sin(ang)*(mbd2+r-pr/2);cx=Math.max(e.r+2,Math.min(W-e.r-2,cx));cy=Math.max(e.r+2,Math.min(H-e.r-2,cy));if(!cw(cx,cy,e.r))return{x:cx,y:cy}}const r=e.epr||PRAD,a=Math.random()*2*Math.PI,rr=Math.random()*r;let cx=e.hx+Math.cos(a)*rr,cy=e.hy+Math.sin(a)*rr;cx=Math.max(e.r+2,Math.min(W-e.r-2,cx));cy=Math.max(e.r+2,Math.min(H-e.r-2,cy));if(cw(cx,cy,e.r))return{x:e.hx+(Math.random()-.5)*r*.3,y:e.hy+(Math.random()-.5)*r*.3};return{x:cx,y:cy}}
function kc(){const t=ens.length+1,a=ens.filter(e=>e.al).length+(boss&&boss.al?1:0);return t-a}
function pb(){return Math.min(kc()*ER*2*1.2,ER*2*6)}
function vb(){return Math.min(kc()*ER*2*.5,ER*4)}
function ad2(){const p=pb(),v=vb();for(const e of ens)if(e.al){e.epr=PRAD+p;e.vr=cd.visionR+v}if(boss&&boss.al){boss.epr=PRAD+p;boss.vr=cd.bossVisionR+v}}

// ========== 地图 ==========
const LVS=[
{name:"外围渗透",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1],[1,0,0,1,0,0,0,0,0,0,0,0,2,0,0,0,0,1],[1,0,0,0,0,0,0,1,1,0,1,0,0,0,0,2,0,1],[1,1,1,0,1,0,0,0,0,0,0,0,0,1,1,1,1,1],[1,0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,1],[1,0,1,0,0,0,0,1,0,0,1,0,0,0,2,0,0,1],[1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,1,0,0,2,0,1,0,0,1,0,0,0,0,0,0,1],[1,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1],[1,0,2,0,1,0,0,0,2,0,0,0,1,0,1,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:14,r:1,va:-Math.PI/2},ec:1,er:9,ed:[{c:2,r:1,va:-Math.PI/3},{c:5,r:1,va:-Math.PI/4},{c:8,r:1,va:0},{c:16,r:1,va:Math.PI},{c:1,r:3,va:Math.PI/4},{c:4,r:3,va:Math.PI/2},{c:10,r:4,va:Math.PI},{c:14,r:5,va:Math.PI/2}],di:{visionR:60,rotateMs:5e3,detectMs:2e3,bossVisionR:80}},
{name:"办公楼潜入",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1,0,1],[1,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],[1,0,0,1,0,0,1,0,1,1,0,0,1,0,0,1,2,1],[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,2,0,0,1,0,0,0,0,0,0,0,1,0,2,0,1],[1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:14,r:1,va:Math.PI},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:5,r:1,va:-Math.PI/3},{c:8,r:1,va:-Math.PI/4},{c:16,r:1,va:Math.PI},{c:15,r:2,va:Math.PI/2},{c:3,r:2,va:-Math.PI/2},{c:9,r:2,va:Math.PI/3},{c:1,r:5,va:0},{c:8,r:4,va:Math.PI},{c:12,r:6,va:-Math.PI/4}],di:{visionR:60,rotateMs:4500,detectMs:2e3,bossVisionR:85}},
{name:"仓库行动",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,1,1,0,0,1,0,0,1,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],[1,0,0,1,0,0,1,0,1,1,0,2,1,0,0,1,0,1],[1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,2,0,0,0,1],[1,0,2,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,1,0,2,0,1],[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,1,0,1,1,0,0,1,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:16,r:5,va:Math.PI},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:5,r:1,va:-Math.PI/3},{c:13,r:1,va:Math.PI},{c:14,r:1,va:-Math.PI/2},{c:4,r:3,va:Math.PI/2},{c:10,r:2,va:0},{c:1,r:5,va:0},{c:4,r:5,va:Math.PI/4},{c:9,r:6,va:-Math.PI/3},{c:15,r:7,va:Math.PI/2},{c:3,r:9,va:-Math.PI/4},{c:8,r:9,va:Math.PI/3}],di:{visionR:62,rotateMs:4200,detectMs:1900,bossVisionR:88}},
{name:"实验室突破",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,0,0,1,0,0,1,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],[1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0,2,1],[1,1,1,1,0,0,0,0,1,0,1,0,0,0,1,1,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1],[1,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,1],[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1],[1,0,0,1,0,0,1,0,1,0,1,0,1,0,0,1,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:14,r:1,va:-Math.PI/2},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:5,r:1,va:-Math.PI/3},{c:9,r:1,va:Math.PI},{c:16,r:1,va:Math.PI/2},{c:3,r:2,va:-Math.PI/2},{c:8,r:2,va:Math.PI/2},{c:14,r:2,va:0},{c:1,r:5,va:0},{c:5,r:5,va:Math.PI},{c:10,r:5,va:-Math.PI/4},{c:14,r:5,va:Math.PI/2},{c:4,r:7,va:-Math.PI/2},{c:11,r:7,va:Math.PI/3},{c:16,r:9,va:-Math.PI/3}],di:{visionR:64,rotateMs:3800,detectMs:1800,bossVisionR:90}},
{name:"要塞终极",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,1,0,0,1,0,1,0,0,1,0,0,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],[1,0,0,1,0,0,1,0,1,0,0,1,0,2,1,0,0,1],[1,1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1],[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],[1,0,2,0,0,0,1,0,1,0,2,0,0,0,0,0,0,1],[1,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,2,1],[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:9,r:5,va:0},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:5,r:1,va:-Math.PI/3},{c:10,r:1,va:Math.PI},{c:13,r:1,va:-Math.PI/4},{c:3,r:2,va:Math.PI/2},{c:7,r:2,va:Math.PI},{c:12,r:2,va:-Math.PI/2},{c:15,r:2,va:Math.PI/3},{c:1,r:5,va:0},{c:4,r:5,va:-Math.PI/3},{c:10,r:5,va:Math.PI/4},{c:14,r:5,va:-Math.PI/2},{c:4,r:7,va:Math.PI/2},{c:10,r:8,va:-Math.PI/3},{c:14,r:9,va:Math.PI/3},{c:3,r:9,va:-Math.PI/4}],di:{visionR:66,rotateMs:3500,detectMs:1700,bossVisionR:95}}
];

const F2=[null,
{name:"二楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,2,1],[1,0,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,1],[1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,1,0,0,0,2,0,0,0,0,2,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,1],[1,0,0,0,0,2,0,0,1,1,0,0,2,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,1,1,0,0,0,0,0,0,0,1,1,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:9,r:5,va:0},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:7,r:1,va:-Math.PI/3},{c:12,r:1,va:Math.PI},{c:16,r:2,va:-Math.PI/4},{c:3,r:2,va:Math.PI/2},{c:9,r:2,va:0},{c:4,r:5,va:-Math.PI/4},{c:14,r:5,va:Math.PI/3},{c:3,r:7,va:Math.PI/2},{c:10,r:8,va:-Math.PI/3},{c:15,r:9,va:Math.PI}],di:{visionR:62,rotateMs:4200,detectMs:1900,bossVisionR:88}},
{name:"二楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1],[1,0,2,0,0,0,0,0,1,1,0,0,0,2,0,0,0,1],[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],[1,1,0,0,1,0,0,0,0,0,0,0,0,2,0,1,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,1],[1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],[1,1,0,0,1,0,0,0,0,0,0,0,0,2,0,1,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},bd:{c:9,r:5,va:Math.PI},ec:1,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:7,r:1,va:-Math.PI/3},{c:14,r:1,va:Math.PI},{c:4,r:2,va:Math.PI/2},{c:10,r:3,va:0},{c:16,r:3,va:-Math.PI/2},{c:1,r:5,va:0},{c:6,r:5,va:Math.PI},{c:10,r:6,va:-Math.PI/4},{c:5,r:7,va:Math.PI/2},{c:11,r:7,va:Math.PI/3},{c:3,r:9,va:-Math.PI/4},{c:15,r:9,va:Math.PI/3}],di:{visionR:64,rotateMs:4000,detectMs:1800,bossVisionR:90}},
{name:"二楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1],[1,0,2,0,0,1,0,0,2,0,0,2,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],[1,1,1,0,0,0,0,1,1,0,0,1,1,0,0,0,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,1],[1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1],[1,1,0,1,0,0,0,1,1,0,0,0,0,0,1,0,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],[1,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},sp:{c:16,r:1},bd:null,ec:0,er:0,ed:[{c:2,r:1,va:Math.PI/4},{c:7,r:1,va:-Math.PI/3},{c:14,r:1,va:Math.PI},{c:15,r:2,va:-Math.PI/2},{c:3,r:3,va:Math.PI/2},{c:10,r:3,va:0},{c:13,r:3,va:-Math.PI/3},{c:1,r:5,va:0},{c:6,r:5,va:Math.PI},{c:10,r:5,va:-Math.PI/4},{c:14,r:6,va:Math.PI/2},{c:4,r:7,va:-Math.PI/2},{c:9,r:9,va:Math.PI/3}],di:{visionR:64,rotateMs:3800,detectMs:1800,bossVisionR:0}},
{name:"二楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,2,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1],[1,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,1],[1,0,0,0,0,0,2,0,1,1,0,2,0,0,0,0,0,1],[1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,1,0,0,0,1,1,0,0,0,0,1,0,0,1],[1,0,2,0,1,0,2,0,0,0,0,2,0,0,1,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:1,r:10},sp:{c:16,r:1},bd:null,ec:0,er:0,ed:[{c:2,r:1,va:Math.PI/4},{c:7,r:1,va:-Math.PI/3},{c:12,r:1,va:Math.PI},{c:15,r:1,va:-Math.PI/2},{c:3,r:2,va:Math.PI/2},{c:9,r:3,va:0},{c:5,r:5,va:Math.PI},{c:14,r:5,va:-Math.PI/4},{c:11,r:5,va:Math.PI/3},{c:1,r:6,va:0},{c:9,r:8,va:-Math.PI/3},{c:15,r:7,va:Math.PI/2},{c:4,r:9,va:-Math.PI/4},{c:6,r:9,va:Math.PI/3}],di:{visionR:66,rotateMs:3500,detectMs:1700,bossVisionR:0}}];
const F3=[null,null,null,
{name:"三楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,1,1,0,0,0,0,0,0,0,0,0,0,2,1,0,1],[1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],[1,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,1],[1,0,0,0,2,0,0,0,0,0,0,0,0,2,0,0,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,0,1],[1,0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0,1],[1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:8,r:10},bd:{c:9,r:5,va:0},ec:8,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:6,r:1,va:-Math.PI/3},{c:10,r:1,va:Math.PI},{c:15,r:1,va:-Math.PI/4},{c:3,r:3,va:Math.PI/2},{c:8,r:3,va:0},{c:14,r:3,va:-Math.PI/2},{c:1,r:5,va:0},{c:6,r:5,va:Math.PI},{c:11,r:5,va:-Math.PI/3},{c:14,r:6,va:Math.PI/2},{c:3,r:7,va:-Math.PI/4},{c:9,r:7,va:Math.PI/3},{c:15,r:7,va:Math.PI}],di:{visionR:68,rotateMs:3500,detectMs:1600,bossVisionR:95}},
{name:"三楼",map:[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,2,0,0,0,1],[1,0,0,1,0,2,0,0,0,0,0,2,0,0,0,1,0,1],[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],[1,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,1,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,1],[1,0,0,1,0,2,0,0,0,0,0,2,0,0,0,1,0,1],[1,0,0,0,0,0,0,0,1,1,0,0,0,2,0,0,0,1],[1,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,0,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]],ps:{c:8,r:10},bd:{c:9,r:5,va:Math.PI},ec:8,er:9,ed:[{c:2,r:1,va:Math.PI/4},{c:6,r:1,va:-Math.PI/3},{c:10,r:1,va:Math.PI},{c:14,r:1,va:-Math.PI/4},{c:3,r:3,va:Math.PI/2},{c:8,r:2,va:0},{c:12,r:3,va:-Math.PI/2},{c:16,r:3,va:Math.PI/3},{c:1,r:5,va:0},{c:4,r:5,va:Math.PI},{c:10,r:5,va:-Math.PI/3},{c:14,r:5,va:Math.PI/2},{c:4,r:7,va:-Math.PI/4},{c:10,r:7,va:Math.PI/3},{c:13,r:8,va:Math.PI},{c:3,r:9,va:-Math.PI/4}],di:{visionR:70,rotateMs:3000,detectMs:1500,bossVisionR:100}}];

function gfc(lv,cf){if(cf===0)return LVS[lv];if(cf===1)return F2[lv];return F3[lv]}function maxF(lv){return lv===0?0:lv>=3?2:1}function hasStairs(lv,cf){return lv>0&&cf<maxF(lv)}function isBossFloor(lv,cf){return cf===maxF(lv)}
function bw(m){
walls.length=0;conts.length=0;
const v=Array.from({length:R},()=>Array(C).fill(false));
for(let r=0;r<R;r++)for(let c=0;c<C;c++){
if(m[r][c]===2)conts.push({x:c*T+T/2,y:r*T+T/2,bc:0});
if(m[r][c]===1&&!v[r][c]){
let ce=c;while(ce<C&&m[r][ce]===1&&!v[r][ce])ce++;
let re=r+1,ok=true;while(re<R&&ok){for(let cc=c;cc<ce;cc++)if(m[re][cc]!==1||v[re][cc]){ok=false;break}if(ok)re++}
for(let rr=r;rr<re;rr++)for(let cc=c;cc<ce;cc++)v[rr][cc]=true;
walls.push({x:c*T,y:r*T,w:(ce-c)*T,h:(re-r)*T});
}
}
}
const DR=[null,null,{door:{c:14,r:4},d1:{c:3,r:9},d2:{c:8,r:6},d3:{c:5,r:3}},{door:{c:14,r:4},d1:{c:3,r:9},d2:{c:8,r:5},d3:{c:5,r:5}},{door:{c:14,r:4},d1:{c:3,r:8},d2:{c:10,r:5},d3:{c:5,r:7}}];

// ========== 初始化 ==========
function il(li,fi){
fi=fi||0;
if(li>=LVS.length){st=3;return}
lv=li;cf=fi;fc=false;const c=gfc(li,fi);cd=c.di;bw(c.map);
st=0;got=0;lct=0;defs.length=0;hidd.length=0;bd=false;ea=false;ez=null;gal=0;dbs.length=0;fc=false;yd=0;dDigits=[false,false,false];dOpen=false;codeBuf="";cMode=false;bMode=false;bGrid=[];bTargets=[];bMatched=0;bSeq=[];
ig=false;gt=null;ic=false;cb=null;turrets=[];miniBoss=null;hasKeycard=false;hasTerminal=li===4?1:0;termMode=false;mbBoost=1;camActive=false;camTimer=0;camCD=0;crouch=false;
const pp=tc(c.ps.c,c.ps.r);pl.x=pp.x;pl.y=pp.y;pl.s=PS;pl.fa=0;
ens.length=0;
for(const d of c.ed){
const p=tc(d.c,d.r);ens.push({x:p.x,y:p.y,hx:p.x,hy:p.y,r:ER,va:d.va,vr:cd.visionR,ri:cd.rotateMs,rt:Math.random()*cd.rotateMs,dl:0,al:true,co:EA,pt:rpt({hx:p.x,hy:p.y,r:ER,epr:PRAD}),epr:PRAD,sp:ESP,pp:false,ppt:0,hi:Math.floor(Math.random()*2)});
}
if(c.bd&&isBossFloor(li,fi)){const bp=tc(c.bd.c,c.bd.r);boss={x:bp.x,y:bp.y,hx:bp.x,hy:bp.y,r:BR,va:c.bd.va,vr:cd.bossVisionR,ri:cd.rotateMs,rt:0,dl:0,al:true,co:EA,pt:{x:bp.x,y:bp.y},epr:PRAD,sp:ESP*.5,pp:false,ppt:0};const mbd=ER*2*6;for(const e of ens)if(d2(e,boss)<mbd){const dx=e.x-boss.x,dy=e.y-boss.y,D=Math.hypot(dx,dy)||1;e.x=boss.x+dx/D*mbd;e.y=boss.y+dy/D*mbd;e.hx=e.x;e.hy=e.y;for(let a=0;a<8&&cw(e.x,e.y,e.r);a++){const ang=Math.PI*2*a/8;e.x=boss.x+Math.cos(ang)*mbd;e.y=boss.y+Math.sin(ang)*mbd;e.hx=e.x;e.hy=e.y}}}else{boss=null;bd=false}if(hasStairs(li,fi)){const sp=gfc(li,fi).sp||{c:16,r:1};const sx=sp.c*T+T/2,sy=sp.r*T+T/2;for(const e of ens)if(Math.abs(e.x-sx)<50&&Math.abs(e.y-sy)<50){e.x=sx+60;e.y=sy;e.hx=e.x;e.hy=e.y}}if(li>=2&&isBossFloor(li,fi)){dCode=Math.floor(Math.random()*1000);dOpen=false;dDigits=[false,false,false];codeBuf="";cMode=false;const rx=13*T,ry=1*T,dr=DR[li],dx2=dr.door.c*T;walls.push({x:rx,y:ry,w:4*T,h:T});walls.push({x:rx,y:ry,w:T,h:4*T});walls.push({x:rx,y:ry+3*T,w:dx2-rx,h:T});walls.push({x:dx2+T,y:ry+3*T,w:rx+4*T-dx2-T,h:T});if(boss){boss.x=14*T+T/2;boss.y=2*T+T/2;boss.hx=boss.x;boss.hy=boss.y}}if((li===3&&fi===2)||li===4){turrets=genTurrets(c.map,c.ps.c,c.ps.r)}if(li===4&&fi!==2){miniBoss=genMiniBoss(c.map)}
buildWorld3D();
}
function igame(){il(0)}

// ========== 输入 ==========
window.addEventListener("keydown",e=>{
if(e.code==="ControlLeft"||e.code==="ControlRight"||e.key==="Control"){if(!e.repeat)crouch=!crouch;e.preventDefault();return}
if(cMode&&e.key>="0"&&e.key<="9"){if(codeBuf.length<3){codeBuf+=e.key;if(codeBuf.length===3){if(parseInt(codeBuf)===dCode){dOpen=true;cMode=false;codeBuf=""}else{codeBuf=""}}}e.preventDefault();return}
if(cMode&&e.key==="Backspace"){codeBuf=codeBuf.slice(0,-1);e.preventDefault();return}
if(cMode&&e.key==="Escape"){cMode=false;codeBuf="";e.preventDefault();return}
if(bMode&&e.key==="ArrowLeft"){bMove(-1);e.preventDefault();return}
if(bMode&&e.key==="ArrowRight"){bMove(1);e.preventDefault();return}
if(bMode&&e.key==="ArrowUp"){if(bAxis==="col"){bMove(-1)}e.preventDefault();return}
if(bMode&&e.key==="ArrowDown"){if(bAxis==="col"){bMove(1)}e.preventDefault();return}
if(bMode&&(e.key==="Enter"||e.key===" ")){bSel();e.preventDefault();return}
if(bMode&&e.key==="Escape"){bMode=false;e.preventDefault();return}
keys[e.key.toLowerCase()]=true;
if(e.key===" "){e.preventDefault();if(st===0)tg()}
if(e.key.toLowerCase()==="e"){if(ig&&gt){perfAct(gt);rg()}}
if(e.key.toLowerCase()==="p"){if(st===0)tgb()}
if(e.key.toLowerCase()==="f"){if(st===0&&lv>=2&&isBossFloor(lv,cf)){if(chkCode()&&!dOpen&&!bMode){cMode=!cMode;if(cMode)codeBuf="";e.preventDefault()}else if(!bMode){const di=chkDecryptPos();if(di>=0){initBreach(di);if(document.exitPointerLock)document.exitPointerLock();e.preventDefault()}}}}
if(e.key>="1"&&e.key<="5"){const lv2=parseInt(e.key)-1;il(lv2,0);e.preventDefault();return}
if(e.key.toLowerCase()==="h"){if(lv===4&&st===0&&!bMode&&!camActive&&camCD<=0){camActive=true;camTimer=3;camCD=40}e.preventDefault();return}
if(e.key.toLowerCase()==="v"){if(st===0&&!bMode&&hasTerminal>0&&turrets.length>0){termMode=!termMode;cvs.style.cursor=termMode?"crosshair":"default";if(termMode&&document.exitPointerLock)document.exitPointerLock()}e.preventDefault();return}
if(e.key.toLowerCase()==="c"){e.preventDefault();return}
if(e.key.toLowerCase()==="r"){if(st===1)il(lv);else if(st===3)igame()}
if(e.key.toLowerCase()==="i"){invertY=!invertY;e.preventDefault();return}
});
window.addEventListener("keyup",e=>{
keys[e.key.toLowerCase()]=false;
});
cvs.addEventListener("click",e=>{
if(termMode){const rect=cvs.getBoundingClientRect();const mx=(e.clientX-rect.left)*(W/rect.width);const my=(e.clientY-rect.top)*(H/rect.height);
// 先判断是否点在放大的小地图上 → 点击机枪瘫痪
if(mx>=mm.x&&mx<=mm.x+mm.w&&my>=mm.y&&my<=mm.y+mm.h){
for(let i=turrets.length-1;i>=0;i--){const t=turrets[i];const px=mm.x+t.x*mm.s,py=mm.y+t.y*mm.s;if(Math.hypot(mx-px,my-py)<Math.max(9,11*mm.s)){turrets.splice(i,1);hasTerminal--;termMode=false;cvs.style.cursor="default";break}}
return;
}
// 否则按 3D 世界坐标选择
for(let i=turrets.length-1;i>=0;i--){const t=turrets[i];const s=w2s(t.x,t.y);if(s.vis&&Math.abs(mx-s.sx)<18&&Math.abs(my-s.sy)<18){turrets.splice(i,1);hasTerminal--;termMode=false;cvs.style.cursor="default";break}}return}
if(!bMode)return;
const rect=cvs.getBoundingClientRect();
const mx=(e.clientX-rect.left)*(W/rect.width);
const my=(e.clientY-rect.top)*(H/rect.height);
const px2=W/2-220,gx2=px2+40,gy2=192,cs=60;
if(mx<gx2||mx>gx2+cs*4||my<gy2||my>gy2+cs*4)return;
const cc=Math.floor((mx-gx2)/cs),cr=Math.floor((my-gy2)/cs);
if(cc<0||cc>3||cr<0||cr>3)return;
if(bAxis==="row"&&cr===bLock){bCurC=cc;bSel()}
else if(bAxis==="col"&&cc===bLock){bCurR=cr;bSel()}
});

// ========== 逻辑 ==========
function up(dt){if(st!==0||ig||cMode||bMode||termMode)return;let dx=0,dy=0;if(fp){const fX=Math.cos(fpYaw),fY=Math.sin(fpYaw),rX=-Math.sin(fpYaw),rY=Math.cos(fpYaw);let mx=0,my=0;if(keys.w||keys.arrowup){mx+=fX;my+=fY}if(keys.s||keys.arrowdown){mx-=fX;my-=fY}if(keys.d||keys.arrowright){mx+=rX;my+=rY}if(keys.a||keys.arrowleft){mx-=rX;my-=rY}const l=Math.hypot(mx,my);if(l>0){dx=mx/l;dy=my/l;pl.fa=fpYaw}}else{if(keys.w||keys.arrowup)dy--;if(keys.s||keys.arrowdown)dy++;if(keys.a||keys.arrowleft)dx--;if(keys.d||keys.arrowright)dx++;if(dx||dy){const l=Math.hypot(dx,dy);dx=dx/l;dy=dy/l;pl.fa=Math.atan2(dy,dx)}}if(dx||dy){const sp=(camActive?PS*1.325:(ic?CS:PS))*(crouch?0.6:1);dx=dx*sp;dy=dy*sp;const r=rw(pl.x+dx,pl.y+dy,pl.r);pl.x=r.x;pl.y=r.y;pl.x=Math.max(pl.r,Math.min(W-pl.r,pl.x));pl.y=Math.max(pl.r,Math.min(H-pl.r,pl.y));if(ic&&cb){cb.x=pl.x;cb.y=pl.y}}}
function uev(e,dt){if(!e.al||(ig&&gt===e))return;e.rt+=dt*1e3;while(e.rt>=e.ri){e.rt-=e.ri;const ra=RA+Math.random()*Math.PI/2;e.va=na(e.va+(Math.random()<.5?ra:-ra))}}
function uep(e,dt){if(!e.al||(ig&&gt===e))return;if(fc&&boss&&boss.al){const db=d2(e,boss);if(db>125){const dx=boss.x-e.x,dy=boss.y-e.y,D=Math.hypot(dx,dy)||1;e.x+=dx/D*ESP*.3;e.y+=dy/D*ESP*.3;if(cw(e.x,e.y,e.r)){e.x-=dx/D*ESP*.3;e.y-=dy/D*ESP*.3}e.hx=e.x;e.hy=e.y;e.pt=rpt(e);return}if(db<115){const dx=boss.x-e.x,dy=boss.y-e.y,D=Math.hypot(dx,dy)||1;e.x-=dx/D*ESP*.3;e.y-=dy/D*ESP*.3;e.hx=e.x;e.hy=e.y;e.pt=rpt(e);return}}if(e.pp){e.ppt-=dt*1e3;if(e.ppt<=0){e.pp=false;e.pt=rpt(e)}return}const tx=e.pt.x,ty=e.pt.y,D=Math.hypot(tx-e.x,ty-e.y);if(D<4){e.pp=true;e.ppt=Math.max(1e3,PPAUSE-yd*500);return}const dx=(tx-e.x)/D*e.sp,dy=(ty-e.y)/D*e.sp,nx=e.x+dx,ny=e.y+dy;if(!cw(nx,ny,e.r)){e.x=nx;e.y=ny}else e.pt=rpt(e)}
function udet(dt){if(st!==0||camActive)return;const all=[...ens.filter(e=>e.al)];if(boss&&boss.al)all.push(boss);if(miniBoss&&miniBoss.al)all.push(miniBoss);let f=false;const am=1+gal;for(const e of all){const od=d2(e,pl),mo=e.r+pl.r,ov=1-od/mo;if(ov>=.6){st=1;got=0;return}let om=0;if(ov>=.4)om=3.5;else if(ov>=.2)om=1.75;else if(ov>=.01)om=1.25;const tm=am*(1+om)*mbBoost;const r=iv(e,pl,VA,e.vr);if(r.inCone){if(bd){st=1;got=0;return}e.dl=Math.min(1,e.dl+dt*1e3/cd.detectMs*r.rate*tm*(crouch?0.7:1))}else if(om>0)e.dl=Math.min(1,e.dl+dt*1e3/cd.detectMs*.2*tm*mbBoost);else e.dl=Math.max(0,e.dl-dt*1e3/DD);e.co=lc(EA,EC,e.dl);if(e.dl>=1)f=true}for(const t of turrets){const r2=iv(t,pl,VA,t.vr);if(r2.inCone){if(bd){st=1;got=0;return}t.dl=Math.min(1,t.dl+dt*1e3/cd.detectMs*32.5*r2.rate)}else{t.dl=Math.max(0,t.dl-dt*1e3/DD)}if(t.dl>=1){st=1;got=0;return}}if(f){st=1;got=0}}
function perfAct(t){if(st!==0)return;t.al=false;defs.push({x:t.x,y:t.y,ib:t===boss||t===miniBoss});if(camCD>0)camCD=Math.max(0,camCD-5);if(t===miniBoss){hasKeycard=true;hasTerminal++;mbBoost=1.5;miniBoss=null}else if(t===boss){bd=true;aev()}else{yd++;if(boss&&boss.al){const cd2=ER*2*.5;for(const e of ens)if(e.al){const dx=boss.x-e.x,dy=boss.y-e.y,D=Math.hypot(dx,dy)||1;e.x+=dx/D*cd2;e.y+=dy/D*cd2;if(cw(e.x,e.y,e.r)){e.x-=dx/D*cd2;e.y-=dy/D*cd2}e.hx=e.x;e.hy=e.y}const ac2=ens.filter(e=>e.al).length;if(ac2<=4&&!fc){fc=true;for(const e of ens)if(e.al)e.epr=ER*2*4}}}}
function tg(){if(st!==0)return;if(ig){rg();return}let t=null;if(boss&&boss.al&&d2(pl,boss)<=GR&&ib(boss,pl))t=boss;if(!t&&miniBoss&&miniBoss.al&&d2(pl,miniBoss)<=GR&&ib(miniBoss,pl))t=miniBoss;if(!t)for(const e of ens)if(e.al&&d2(pl,e)<=GR&&ib(e,pl)){t=e;break}if(t){const all=[...ens.filter(e=>e.al&&e!==t)];if(boss&&boss.al&&boss!==t)all.push(boss);if(miniBoss&&miniBoss.al&&miniBoss!==t)all.push(miniBoss);let s=false;for(const e of all)if(iv(e,pl,VA,e.vr).inCone){s=true;break}if(!s){ig=true;gt=t}}}
function mg(){if(!ig||!gt)return;if(!gt.al||d2(pl,gt)>GR||!ib(gt,pl))rg()}
function rg(){ig=false;gt=null;}
function tgb(){if(ic){ic=false;cb=null;pl.s=PS}else{let n=null,nd=35;for(const b of defs){if(hidd.some(h=>{const c=conts[h.ci];return c&&Math.abs(c.x-b.x)<10&&Math.abs(c.y-b.y)<10}))continue;const D=d2(pl,b);if(D<nd){nd=D;n=b}}if(n){ic=true;cb=n;pl.s=CS}}}
function autoDep(){if(!ic||!cb)return;for(const c of conts){if(d2(pl,c)<22){c.bc++;cb.x=c.x;cb.y=c.y;hidd.push({ci:conts.indexOf(c)});ic=false;cb=null;pl.s=PS;return}}}
function chkDecrypt(){if(!DR[lv]||!isBossFloor(lv,cf))return;const dr=DR[lv],pts=[dr.d1,dr.d2,dr.d3];for(let i=0;i<3;i++){if(!dDigits[i]){const p=pts[i],px=p.c*T+T/2,py=p.r*T+T/2;if(Math.abs(pl.x-px)<20&&Math.abs(pl.y-py)<20){dDigits[i]=true}}}}
function chkCode(){if(!DR[lv]||!isBossFloor(lv,cf))return false;const dr=DR[lv],p=dr.door,px=p.c*T+T/2,py=p.r*T+T/2;return Math.abs(pl.x-px)<40&&Math.abs(pl.y-py)<40}
function chkDecryptPos(){if(!DR[lv]||!isBossFloor(lv,cf))return-1;const dr=DR[lv],pts=[dr.d1,dr.d2,dr.d3];for(let i=0;i<3;i++){if(dDigits[i])continue;const q=pts[i],qx=q.c*T+T/2,qy=q.r*T+T/2;if(Math.abs(pl.x-qx)<30&&Math.abs(pl.y-qy)<30)return i}return-1}
function initBreach(idx){bMode=true;bTargetIdx=idx;bGrid=[];const h="0123456789ABCDEF";for(let r=0;r<4;r++){const row=[];for(let c=0;c<4;c++)row.push(h[Math.floor(Math.random()*16)]+h[Math.floor(Math.random()*16)]);bGrid.push(row)}bTargets=[];let cr=0,cc=Math.floor(Math.random()*4);bTargets.push(bGrid[cr][cc]);cr=Math.floor(Math.random()*4);bTargets.push(bGrid[cr][cc]);let cc2=Math.floor(Math.random()*4);while(cc2===cc)cc2=Math.floor(Math.random()*4);cc=cc2;bTargets.push(bGrid[cr][cc]);bAxis="row";bLock=0;bCurR=0;bCurC=0;bMatched=0;bBuf=bMax;bSeq=[]}
function bSel(){const code=bGrid[bCurR][bCurC];if(code===bTargets[bMatched]){bSeq.push({r:bCurR,c:bCurC,code:code});bMatched++;if(bMatched>=3){dDigits[bTargetIdx]=true;bMode=false;return}bBuf=Math.min(bMax,bBuf+5000);bAxis=bAxis==="row"?"col":"row";bLock=bAxis==="col"?bCurC:bCurR}else{bBuf=Math.max(0,bBuf-2000)}}
function bMove(dir){if(bAxis==="row"){bCurC=Math.max(0,Math.min(3,bCurC+dir))}else{bCurR=Math.max(0,Math.min(3,bCurR+dir))}}
function genTurrets(m,psc,psr){const trs=[];const free=[];const psx=psc*T+T/2,psy=psr*T+T/2,tr=9*20;for(let r=1;r<R-1;r++)for(let c=1;c<C-1;c++){const tx=c*T+T/2,ty=r*T+T/2;if(m[r][c]===0&&!(c>=14&&c<17&&r>=1&&r<4)&&!(Math.abs(c-psc)<2&&Math.abs(r-psr)<2)&&Math.hypot(tx-psx,ty-psy)>=tr){free.push({c,r})}}for(let i=0;i<3&&free.length>0;i++){const idx=Math.floor(Math.random()*free.length);const p=free.splice(idx,1)[0];trs.push({x:p.c*T+T/2,y:p.r*T+T/2,va:Math.random()*Math.PI*2,dl:0,vr:tr,va2:VA})}return trs}
function genMiniBoss(m){const free=[];for(let r=1;r<R-1;r++)for(let c=1;c<C-1;c++){if(m[r][c]===0&&!(c>=14&&c<17&&r>=1&&r<4))free.push({c,r})}if(free.length===0)return null;const p=free[Math.floor(Math.random()*free.length)];const bp=tc(p.c,p.r);return{x:bp.x,y:bp.y,hx:bp.x,hy:bp.y,r:BR-2,va:Math.random()*Math.PI*2,vr:75,ri:3500,rt:0,dl:0,al:true,co:0x2266ff,epr:PRAD,sp:ESP*.6,pp:false,ppt:0,pt:{x:bp.x,y:bp.y}}}
function aev(){ea=true;const c=LVS[lv],ep=tc(c.ec,c.er);ez={x:ep.x-T/2,y:ep.y-T/2,w:T,h:T,gl:0}}
function cev(){if(!ea||!ez||st!==0)return;if(pl.x>ez.x&&pl.x<ez.x+ez.w&&pl.y>ez.y&&pl.y<ez.y+ez.h){st=2;lct=0}}

// ============================================================
//  three.js 3D 渲染层
// ============================================================
const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(W,H);
renderer.setClearColor(0x080808,1);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(70, W/H, 1, 6000);
camera.position.set(W/2, 850, 1050);
camera.lookAt(W/2,0,H/2);
// 自定义相机控制（替代 OrbitControls，兼容 file:// 双击打开）
const cam={target:new THREE.Vector3(W/2,0,H/2),dist:1351,theta:0,phi:0.888,enabled:true,
 homeDist:1351,homeTheta:0,homePhi:0.888,
 minDist:350,maxDist:2200,phiClamp:Math.PI*0.49,
 reset(){this.target.set(W/2,0,H/2);this.dist=this.homeDist;this.theta=this.homeTheta;this.phi=this.homePhi;this.update();},
 update(){if(!this.enabled)return;const r=this.dist*Math.sin(this.phi);const y=this.dist*Math.cos(this.phi);const x=this.target.x+r*Math.sin(this.theta);const z=this.target.z+r*Math.cos(this.theta);camera.position.set(x,y,z);camera.lookAt(this.target.x,this.target.y,this.target.z);},
 onDown(e){if(e.button!==0)return;if(fp&&document.pointerLockElement!==cvs&&!termMode&&!bMode){try{cvs.requestPointerLock()}catch(_){}}this.drag=true;this.px=e.clientX;this.py=e.clientY;},
 onMove(e){if(!this.enabled)return;if(fp){if(!termMode&&!bMode){const dx=e.movementX||0,dy=(e.movementY||0)*(invertY?-1:1);fpYaw+=dx*SENS;fpPitch=Math.max(-PITCH_MAX,Math.min(PITCH_MAX,fpPitch-dy*SENS));}return}if(!this.drag||termMode||bMode)return;const dx=e.clientX-this.px,dy=e.clientY-this.py;this.px=e.clientX;this.py=e.clientY;this.theta-=dx*0.005;this.phi=Math.min(this.phiClamp,Math.max(0.12,this.phi-dy*0.005));},
 onUp(){this.drag=false;},
 onWheel(e){this.dist=Math.min(this.maxDist,Math.max(this.minDist,this.dist+e.deltaY*0.8));}
};
cvs.addEventListener("mousedown",e=>cam.onDown(e));
window.addEventListener("mousemove",e=>cam.onMove(e));
window.addEventListener("mouseup",e=>cam.onUp(e));
cvs.addEventListener("wheel",e=>{cam.onWheel(e);e.preventDefault();},{passive:false});
cam.update();

scene.add(new THREE.AmbientLight(0xffffff,0.55));
const dir=new THREE.DirectionalLight(0xffffff,0.9);dir.position.set(300,900,200);scene.add(dir);
const dir2=new THREE.DirectionalLight(0x88aaff,0.35);dir2.position.set(700,500,800);scene.add(dir2);
scene.add(new THREE.HemisphereLight(0x8899aa,0x111111,0.4));

// 地面
const floor=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshStandardMaterial({color:0x0d1117,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.set(W/2,0,H/2);scene.add(floor);
// 网格
const grid=new THREE.GridHelper(W, C, 0x1a2230, 0x141820);grid.position.set(W/2,0.05,H/2);scene.add(grid);

// 玩家（持久）
const playerG=new THREE.Group();
const pmat=new THREE.MeshStandardMaterial({color:0x00e676,emissive:0x004d26,emissiveIntensity:0.5,transparent:true,opacity:1});
const pBodyG=new THREE.Group();playerG.add(pBodyG);
const pLegGeo=new THREE.BoxGeometry(5,14,5);
const pLegL=new THREE.Mesh(pLegGeo,pmat);pLegL.position.set(-6,7,0);pBodyG.add(pLegL);
const pLegR=new THREE.Mesh(pLegGeo,pmat);pLegR.position.set(6,7,0);pBodyG.add(pLegR);
const pbody=new THREE.Mesh(new THREE.BoxGeometry(18,20,11),pmat);pbody.position.y=24;pBodyG.add(pbody);
const pHead=new THREE.Mesh(new THREE.SphereGeometry(8,16,16),pmat);pHead.position.y=42;pBodyG.add(pHead);
const pArmGeo=new THREE.BoxGeometry(4.5,16,4.5);
const pArmLP=new THREE.Group();pArmLP.position.set(-12,32,0);pBodyG.add(pArmLP);
const pArmL=new THREE.Mesh(pArmGeo,pmat);pArmL.position.set(0,-8,0);pArmLP.add(pArmL);
const pHandL=new THREE.Mesh(new THREE.SphereGeometry(3,10,10),pmat);pHandL.position.y=-16;pArmLP.add(pHandL);
const pArmRP=new THREE.Group();pArmRP.position.set(12,32,0);pBodyG.add(pArmRP);
const pArmR=new THREE.Mesh(pArmGeo,pmat);pArmR.position.set(0,-8,0);pArmRP.add(pArmR);
const pHandR=new THREE.Mesh(new THREE.SphereGeometry(3,10,10),pmat);pHandR.position.y=-16;pArmRP.add(pHandR);
pBodyG.scale.setScalar(0.95);
const pdisc=new THREE.Mesh(new THREE.CircleGeometry(PR*2.5,28),new THREE.MeshBasicMaterial({color:0x00e676,transparent:true,opacity:0.22,side:THREE.DoubleSide,depthWrite:false}));
pdisc.rotation.x=-Math.PI/2;pdisc.position.y=0.2;playerG.add(pdisc);
const pcone=new THREE.Mesh(new THREE.ConeGeometry(6,18,14),new THREE.MeshStandardMaterial({color:0x00c853,emissive:0x003d1a,emissiveIntensity:0.4}));
pcone.rotation.z=-Math.PI/2;pcone.position.set(PR+7,22,0);playerG.add(pcone);
// 钳制时不再显示手部演出
scene.add(playerG);playerG.visible=false;

// 撤离点
const exitMesh=new THREE.Mesh(new THREE.BoxGeometry(T,5,T),new THREE.MeshStandardMaterial({color:0x00e676,emissive:0x00e676,emissiveIntensity:0.6,transparent:true,opacity:0.6}));
exitMesh.position.y=2.5;exitMesh.visible=false;scene.add(exitMesh);

// 头图纹理
// 骷髅纹理
function makeSkullTexture(){const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d");const S=22;const cx=32,cy=34;x.fillStyle="rgba(255,0,0,.15)";x.beginPath();x.arc(cx,cy,S+4,0,7);x.fill();x.fillStyle="#c62828";x.beginPath();x.arc(cx,cy,S,0,7);x.fill();x.strokeStyle="#ff5252";x.lineWidth=2;x.stroke();const ss=S*.7;x.fillStyle="#fff";x.beginPath();x.arc(cx,cy-ss*.25,ss*.55,Math.PI,0);x.fill();x.beginPath();x.moveTo(cx-ss*.5,cy-ss*.2);x.lineTo(cx-ss*.4,cy+ss*.45);x.lineTo(cx+ss*.4,cy+ss*.45);x.lineTo(cx+ss*.5,cy-ss*.2);x.closePath();x.fill();x.fillStyle="#c62828";x.beginPath();x.arc(cx-ss*.22,cy-ss*.28,ss*.12,0,7);x.fill();x.beginPath();x.arc(cx+ss*.22,cy-ss*.28,ss*.12,0,7);x.fill();x.fillStyle="#333";x.beginPath();x.moveTo(cx,cy+ss*.02);x.lineTo(cx-ss*.06,cy+ss*.12);x.lineTo(cx+ss*.06,cy+ss*.12);x.closePath();x.fill();x.strokeStyle="#999";x.lineWidth=.8;for(let i=0;i<4;i++){x.beginPath();x.moveTo(cx-ss*.2+i*ss*.13,cy+ss*.18);x.lineTo(cx-ss*.2+i*ss*.13,cy+ss*.35);x.stroke()}x.strokeStyle="#fff";x.lineWidth=3;x.lineCap="round";x.beginPath();x.moveTo(cx-S*.9,cy-S*.7);x.lineTo(cx+S*.9,cy+S*.7);x.stroke();x.beginPath();x.moveTo(cx+S*.9,cy-S*.7);x.lineTo(cx-S*.9,cy+S*.7);x.stroke();return new THREE.CanvasTexture(c);}
const skullTex=makeSkullTexture();

// 材质
const wallMat=new THREE.MeshStandardMaterial({color:0xdcdcdc,emissive:0x3a3a3a,emissiveIntensity:0.25,roughness:0.85});
const edgeMat=new THREE.LineBasicMaterial({color:0x9a9a9a});
const levelGroup=new THREE.Group();scene.add(levelGroup);
let contMeshes=[],stairsPlat=null,doorMarker=null,decryptMarks=[];
const meshMap=new Map();

function sectorGeo(radius,half,seg){seg=seg||28;const g=new THREE.BufferGeometry();const pos=[0,0,0];for(let i=0;i<=seg;i++){const a=-half+(2*half)*i/seg;pos.push(Math.cos(a)*radius,0,Math.sin(a)*radius)}const idx=[];for(let i=1;i<=seg;i++)idx.push(0,i,i+1);g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function clearGroup(g){for(let i=g.children.length-1;i>=0;i--){const o=g.children[i];g.remove(o);if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}}}
function disposeGroup(g){if(g.userData&&g.userData.keep){scene.remove(g);return;}g.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});scene.remove(g);}

// ========== 视野扇形：被墙体正确遮挡 ==========
const CONE_SEG=72;
function makeConeGeo(){
const g=new THREE.BufferGeometry();
const pos=new Float32Array((CONE_SEG+2)*3);
g.setAttribute("position",new THREE.BufferAttribute(pos,3));
const idx=[];
for(let i=1;i<=CONE_SEG;i++)idx.push(0,i,i+1);
g.setIndex(idx);
return g;
}
// 射线 vs 墙体(AABB)，返回最近命中距离（无命中返回 maxD）
function rayWallDist(ox,oy,dx,dy,maxD){
let best=maxD;
for(let i=0;i<walls.length;i++){
const w=walls[i];
let tmin=-1e9,tmax=1e9;
if(Math.abs(dx)<1e-9){if(ox<w.x||ox>w.x+w.w)continue;}else{let t1=(w.x-ox)/dx,t2=(w.x+w.w-ox)/dx;if(t1>t2){const tmp=t1;t1=t2;t2=tmp;}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;}
if(Math.abs(dy)<1e-9){if(oy<w.y||oy>w.y+w.h)continue;}else{let t1=(w.y-oy)/dy,t2=(w.y+w.h-oy)/dy;if(t1>t2){const tmp=t1;t1=t2;t2=tmp;}if(t1>tmin)tmin=t1;if(t2<tmax)tmax=t2;}
if(tmax<tmin)continue;
if(tmax<0)continue;
const td=tmin>0?tmin:0;
if(td<best)best=td;
}
return best;
}
// 用可见多边形更新扇形几何（局部坐标，相对 group 原点）
function updateCone(rec,ox,oy,facing,half,radius,color,opacity){
const arr=rec.sec.geometry.attributes.position.array;
arr[0]=0;arr[1]=0.4;arr[2]=0;
for(let i=0;i<=CONE_SEG;i++){
const a=facing-half+(2*half)*i/CONE_SEG;
const dx=Math.cos(a),dy=Math.sin(a);
const d=rayWallDist(ox,oy,dx,dy,radius);
const vi=(i+1)*3;
arr[vi]=dx*d;arr[vi+1]=0.4;arr[vi+2]=dy*d;
}
rec.sec.geometry.attributes.position.needsUpdate=true;
rec.sec.geometry.computeBoundingSphere();
rec.sec.material.color.copy(color);
rec.sec.material.opacity=opacity;
}

function buildWorld3D(){
clearGroup(levelGroup);contMeshes=[];stairsPlat=null;doorMarker=null;decryptMarks=[];
for(const w of walls){const m=new THREE.Mesh(new THREE.BoxGeometry(w.w,WALL_H,w.h),wallMat);m.position.set(w.x+w.w/2,WALL_H/2,w.y+w.h/2);levelGroup.add(m);const ed=new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry),edgeMat);ed.position.copy(m.position);levelGroup.add(ed);}
for(const c of conts){const m=new THREE.Mesh(new THREE.BoxGeometry(18,22,16),new THREE.MeshStandardMaterial({color:c.bc>0?0x5d4037:0x6d6d6d,roughness:0.85}));m.position.set(c.x,11,c.y);levelGroup.add(m);contMeshes.push(m);}
if(hasStairs(lv,cf)){const sp=gfc(lv,cf).sp||{c:16,r:1};const sx=sp.c*T+T/2,sy=sp.r*T+T/2;stairsPlat=new THREE.Mesh(new THREE.BoxGeometry(60,8,60),new THREE.MeshStandardMaterial({color:0x1e88e5,emissive:0x0d47a1,emissiveIntensity:0.45,transparent:true,opacity:0.9}));stairsPlat.position.set(sx,4,sy);levelGroup.add(stairsPlat);}
if(DR[lv]&&isBossFloor(lv,cf)){const dr=DR[lv],dp=dr.door,dx=dp.c*T+T/2,dy=dp.r*T+T/2;doorMarker=new THREE.Mesh(new THREE.BoxGeometry(22,34,22),new THREE.MeshStandardMaterial({color:0xff9800,emissive:0xff9800,emissiveIntensity:0.5,transparent:true,opacity:0.85}));doorMarker.position.set(dx,17,dy);levelGroup.add(doorMarker);const pts=[dr.d1,dr.d2,dr.d3];decryptMarks=pts.map(q=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(12,12,5,22),new THREE.MeshStandardMaterial({color:0x9c27b0,emissive:0x6a1b9a,emissiveIntensity:0.4}));m.position.set(q.c*T+T/2,2.5,q.r*T+T/2);levelGroup.add(m);return m;});}
for(const [,rec] of meshMap){disposeGroup(rec.g);}meshMap.clear();
}

// 颜色
const _cA=new THREE.Color(0xffd740),_cB=new THREE.Color(0xff1744),_cT=new THREE.Color();
function detColor(dl){return _cT.copy(_cA).lerp(_cB,dl);}

function buildHumanoid(R,color,emis){
const bob=new THREE.Group();
const mat=new THREE.MeshStandardMaterial({color:color,emissive:emis,emissiveIntensity:0.35,roughness:0.6});
const legGeo=new THREE.BoxGeometry(R*0.5,14,R*0.5);
const legL=new THREE.Mesh(legGeo,mat);legL.position.set(-R*0.5,7,0);bob.add(legL);
const legR=new THREE.Mesh(legGeo,mat);legR.position.set(R*0.5,7,0);bob.add(legR);
const torso=new THREE.Mesh(new THREE.BoxGeometry(R*1.4,18,R*1.0),mat);torso.position.y=24;bob.add(torso);
const armGeo=new THREE.BoxGeometry(4,16,4);
const armLP=new THREE.Group();armLP.position.set(-R*0.95,31,0);bob.add(armLP);
const armL=new THREE.Mesh(armGeo,mat);armL.position.set(0,-8,0);armLP.add(armL);
const armRP=new THREE.Group();armRP.position.set(R*0.95,31,0);bob.add(armRP);
const armR=new THREE.Mesh(armGeo,mat);armR.position.set(0,-8,0);armRP.add(armR);
const head=new THREE.Mesh(new THREE.SphereGeometry(R*0.7,16,16),mat);head.position.y=40;bob.add(head);
return {bob,mat,legL,legR,armLP,armRP,torso};
}
function makeEnemyMesh(e){
const H=buildHumanoid(ER,0xffd740,0x553300);const g=new THREE.Group();g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+ER*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(26,4,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xffd740,transparent:true}));fill.scale.set(26,4,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0xffd740,transparent:true,opacity:0.12,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(ER+5,1.6,8,26),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=15;ring.visible=false;g.add(ring);
e._phase=e._phase||Math.random()*6.28;e._px=e.x;e._py=e.y;
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'enemy'};
}
function makeBossMesh(e){
const H=buildHumanoid(BR,0x8b0000,0x4a0000);const g=new THREE.Group();g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+BR*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(34,5,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0xff1744,transparent:true}));fill.scale.set(34,5,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0xff4040,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(BR+6,2,8,30),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=20;ring.visible=false;g.add(ring);
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'boss'};
}
function makeMiniMesh(e){
const H=buildHumanoid(BR-2,0x4488ff,0x1133aa);const g=new THREE.Group();g.add(H.bob);H.bob.scale.setScalar(HUM_S);
const barY=40+(BR-2)*0.7+6;
const bg=new THREE.Sprite(new THREE.SpriteMaterial({color:0x222222,transparent:true,opacity:0.85}));bg.scale.set(30,5,1);bg.position.y=barY;H.bob.add(bg);
const fill=new THREE.Sprite(new THREE.SpriteMaterial({color:0x4488ff,transparent:true}));fill.scale.set(30,5,1);fill.position.copy(bg.position);H.bob.add(fill);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x4488ff,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
const ring=new THREE.Mesh(new THREE.TorusGeometry(BR+4,1.8,8,28),new THREE.MeshBasicMaterial({color:0x00e676}));ring.rotation.x=Math.PI/2;ring.position.y=18;ring.visible=false;g.add(ring);
scene.add(g);return {g,bob:H.bob,body:H.torso,legL:H.legL,legR:H.legR,armL:H.armLP,armR:H.armRP,fill,sec,ring,type:'mini'};
}
function makeTurretMesh(t){
const g=new THREE.Group();
const base=new THREE.Mesh(new THREE.BoxGeometry(18,30,18),new THREE.MeshStandardMaterial({color:0x333a44,metalness:0.6,roughness:0.4}));base.position.y=15;g.add(base);
const barrelPivot=new THREE.Group();g.add(barrelPivot);
const barrel=new THREE.Mesh(new THREE.BoxGeometry(22,6,6),new THREE.MeshStandardMaterial({color:0xcc1111,emissive:0x550000,emissiveIntensity:0.4}));barrel.position.set(11,18,0);barrelPivot.add(barrel);
const ring=new THREE.Mesh(new THREE.RingGeometry(t.vr-2,t.vr,56),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.5,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=0.5;g.add(ring);
const sec=new THREE.Mesh(makeConeGeo(),new THREE.MeshBasicMaterial({color:0x990000,transparent:true,opacity:0.13,side:THREE.DoubleSide,depthWrite:false}));sec.position.y=0;g.add(sec);
scene.add(g);return {g,base,barrelPivot,barrel,ring,sec,type:'turret'};
}
function makeBodyMesh(d){
const r=d.ib?BR:ER-1;const g=new THREE.Group();
const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,14,16),new THREE.MeshStandardMaterial({color:d.ib?0x555555:0x666666,roughness:0.9}));m.position.y=7;g.add(m);
scene.add(g);return {g,type:'body'};
}

function createMesh(ent,type){
if(type==='enemy')return makeEnemyMesh(ent);
if(type==='boss')return makeBossMesh(ent);
if(type==='mini')return makeMiniMesh(ent);
if(type==='turret')return makeTurretMesh(ent);
if(type==='body')return makeBodyMesh(ent);
}
function updEnemy(rec,e){
rec.g.position.set(e.x,0,e.y);
const mv=Math.hypot(e.x-(e._px===undefined?e.x:e._px),e.y-(e._py===undefined?e.y:e._py));
e._px=e.x;e._py=e.y;
if(mv>0.08)e._phase=(e._phase||0)+mv*0.6;
const sw=Math.sin(e._phase||0);
if(rec.legL){rec.legL.rotation.x=sw*0.7;rec.legR.rotation.x=-sw*0.7;}
if(rec.armL){rec.armL.rotation.x=-sw*0.7;rec.armR.rotation.x=sw*0.7;}
if(rec.bob)rec.bob.position.y=Math.abs(Math.sin(e._phase||0))*1.6;
const col=detColor(e.dl);
if(rec.body){rec.body.material.color.copy(col);rec.body.material.emissive.copy(col).multiplyScalar(0.3);}
rec.fill.material.color.copy(col);rec.fill.scale.x=Math.max(0.001,26*e.dl);
updateCone(rec,e.x,e.y,e.va,VA/2,e.vr,col,0.1+e.dl*0.13);
rec.ring.visible=!!(ig&&gt===e);
}
function updBoss(rec,e){
rec.g.position.set(e.x,0,e.y);
if(rec.bob)rec.bob.position.y=Math.sin(nowT*0.003)*0.8;
const col=detColor(e.dl);rec.body.material.emissive.copy(col).multiplyScalar(0.4);
rec.fill.material.color.copy(col);rec.fill.scale.x=Math.max(0.001,34*e.dl);
updateCone(rec,e.x,e.y,e.va,VA/2,e.vr,col,0.12+e.dl*0.15);
rec.ring.visible=!!(ig&&gt===e);
}
function updMini(rec,e){
rec.g.position.set(e.x,0,e.y);
if(rec.bob)rec.bob.position.y=Math.sin(nowT*0.003+1)*0.7;
const col=_cT.set(0x4488ff).lerp(new THREE.Color(0xff1744),e.dl);rec.body.material.color.copy(col);rec.body.material.emissive.copy(col).multiplyScalar(0.4);
rec.fill.material.color.copy(col);rec.fill.scale.x=Math.max(0.001,30*e.dl);
updateCone(rec,e.x,e.y,e.va,VA/2,e.vr,col,0.12+e.dl*0.15);
rec.ring.visible=!!(ig&&gt===e);
}
function updTurret(rec,t){
rec.g.position.set(t.x,0,t.y);
rec.barrelPivot.rotation.y=-t.va;
const c=rec.sec.material.color;c.setRGB(0.6+0.4*t.dl,0.05,0.05);
updateCone(rec,t.x,t.y,t.va,VA/2,t.vr,c,0.12+t.dl*0.3);
rec.ring.material.opacity=0.4+t.dl*0.5;rec.ring.material.color.copy(c);
}
function updBody(rec,d){rec.g.position.set(d.x,0,d.y);}

function sync3D(){
// stairs 颜色
if(stairsPlat){const need=lv===4&&!hasKeycard;stairsPlat.material.color.set(need?0xcc2222:0x1e88e5);stairsPlat.material.emissive.set(need?0x660000:0x0d47a1);}
if(doorMarker)doorMarker.visible=!(DR[lv]&&isBossFloor(lv,cf)&&dOpen);
if(decryptMarks.length){const dr=DR[lv];for(let i=0;i<3;i++){decryptMarks[i].material.color.set(dDigits[i]?0x4caf50:0x9c27b0);decryptMarks[i].material.emissive.set(dDigits[i]?0x1b5e20:0x6a1b9a);}}
// 撤离点
if(ea&&ez){exitMesh.visible=true;exitMesh.position.set(ez.x+T/2,2.5,ez.y+T/2);const p=.5+Math.sin(Date.now()/300)*.5;exitMesh.material.opacity=0.4+p*0.3;}else exitMesh.visible=false;
// 动态实体
const active=new Map();
for(const e of ens)if(e.al)active.set(e,'enemy');
if(boss&&boss.al)active.set(boss,'boss');
if(miniBoss&&miniBoss.al)active.set(miniBoss,'mini');
for(const t of turrets)active.set(t,'turret');
for(let i=0;i<defs.length;i++){const d=defs[i];if(hidd.some(h=>{const c=conts[h.ci];return c&&Math.abs(c.x-d.x)<10&&Math.abs(c.y-d.y)<10}))continue;if(ic&&cb===d)continue;active.set(d,'body');}
for(const [ent,rec] of meshMap)if(!active.has(ent)){disposeGroup(rec.g);meshMap.delete(ent);}
for(const [ent,type] of active){let rec=meshMap.get(ent);if(!rec){rec=createMesh(ent,type);meshMap.set(ent,rec);}if(type==='enemy')updEnemy(rec,ent);else if(type==='boss')updBoss(rec,ent);else if(type==='mini')updMini(rec,ent);else if(type==='turret')updTurret(rec,ent);else if(type==='body')updBody(rec,ent);}
// 玩家
if(ig&&gt){
// 第一人称钳制：玩家本体隐藏，手由相机子节点呈现在视野中（相机/手姿态在 loop 中处理）
playerG.visible=false;
}else{
playerG.position.set(pl.x,0,pl.y);playerG.rotation.y=-pl.fa;
playerG.visible=!fp;
pArmR.rotation.set(0,0,0);pArmL.rotation.set(0,0,0);
}
pbody.material.opacity=camActive?0.3:1;pbody.material.color.set(ic?0x00c853:0x00e676);pbody.material.emissiveIntensity=camActive?0.1:0.5;
}

// 世界 → 屏幕
const _v=new THREE.Vector3();
function w2s(x,y){_v.set(x,18,y).project(camera);return {sx:(_v.x*0.5+0.5)*W,sy:(-_v.y*0.5+0.5)*H,vis:_v.z<1};}

// ============================================================
//  2D 叠加层（HUD / 文字 / 标签 / 解密小游戏）
// ============================================================
function dhud(){
const ac=ens.filter(e=>e.al).length+(boss&&boss.al?1:0)+(miniBoss&&miniBoss.al?1:0),kl=kc(),pb2=pb(),vb2=vb();
octx.fillStyle="rgba(0,0,0,.65)";octx.fillRect(8,8,200,130);octx.strokeStyle="#555";octx.strokeRect(8,8,200,130);
octx.fillStyle="#aaa";octx.font='11px "Microsoft YaHei","Segoe UI",sans-serif';octx.textAlign="left";octx.fillText(`第 ${lv+1}/5 关 ${gfc(lv,cf).name}`,16,24);
octx.fillStyle=ac===0?"#00e676":"#ffd740";octx.font='bold 15px "Segoe UI",sans-serif';octx.fillText(`剩余:${ac} 已消灭:${kl}`,16,44);
let ny=60;
if(hasKeycard){octx.fillStyle="#00ffe5";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText("门禁卡 ✓",16,ny);ny+=14}
if(hasTerminal>0){octx.fillStyle="#ffc800";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText(`终端:${hasTerminal}个(按V)`,16,ny);ny+=14}
if(gal>0){octx.fillStyle="#ff4444";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText(`尸体警戒 +${(gal*100)|0}% (${dbs.length}具发现)`,16,ny);ny+=14}
if(kl>0){octx.fillStyle="#ff9800";octx.font='10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText(`威胁↑ 巡逻+${pb2|0}px 视野+${vb2|0}px`,16,ny);ny+=14}
const bl=!boss?"—":(boss.al?"存活":"已消灭"),bc=!boss?"#888":(boss.al?"#ff5252":"#00e676");
octx.fillStyle=bc;octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText("Boss:"+bl,16,ny+6);
if(ig){octx.fillStyle="#00e676";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText("钳制中",120,ny+6)}
if(ic){octx.fillStyle="#ffd740";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText("搬运中",ig?160:120,ny+6)}
if(crouch){octx.fillStyle="#8ad6ff";octx.font='bold 10px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText("下蹲中",ig||ic?200:120,ny+6)}
octx.fillStyle="rgba(0,0,0,.65)";octx.fillRect(W-188,8,180,32);octx.strokeStyle="#555";octx.strokeRect(W-188,8,180,32);
octx.fillStyle=bd?"#00e676":"#ffd740";octx.font='12px "Microsoft YaHei","Segoe UI",sans-serif';octx.textAlign="center";octx.fillText(bd?"目标已消灭-前往撤离点!":"任务:消灭骷髅头目标",W-98,28);
}
function drawWorldLabels(){
if(hasStairs(lv,cf)){const sp=gfc(lv,cf).sp||{c:16,r:1};const sx=sp.c*T+T/2,sy=sp.r*T+T/2;const s=w2s(sx,sy);if(s.vis){octx.textAlign="center";if(lv===4&&!hasKeycard){octx.fillStyle="rgba(255,80,80,.85)";octx.font='bold 13px "Microsoft YaHei",sans-serif';octx.fillText("需门禁卡",s.sx,s.sy);}else{octx.fillStyle="rgba(120,200,255,.9)";octx.font='bold 14px "Microsoft YaHei",sans-serif';octx.fillText("上楼",s.sx,s.sy);}}}
if(DR[lv]&&isBossFloor(lv,cf)&&!dOpen){const dr=DR[lv],dx=dr.door.c*T+T/2,dy=dr.door.r*T+T/2;const s=w2s(dx,dy);if(s.vis){octx.fillStyle="#ffb74d";octx.font='bold 11px "Microsoft YaHei",sans-serif';octx.textAlign="center";octx.fillText("密码门·按F",s.sx,s.sy-26);}
const pts=[dr.d1,dr.d2,dr.d3];for(let i=0;i<3;i++){if(dDigits[i])continue;const q=pts[i],qx=q.c*T+T/2,qy=q.r*T+T/2;const ss=w2s(qx,qy);if(ss.vis){octx.fillStyle="#e1bee7";octx.font='bold 10px "Microsoft YaHei",sans-serif';octx.textAlign="center";octx.fillText("?",ss.sx,ss.sy);if(Math.abs(pl.x-qx)<30&&Math.abs(pl.y-qy)<30){octx.fillStyle="#00ffe5";octx.fillText("按F接入",ss.sx,ss.sy-16);}}}}
if(ea&&ez){const s=w2s(ez.x+T/2,ez.y+T/2);if(s.vis){octx.fillStyle="#00e676";octx.font='bold 14px "Microsoft YaHei",sans-serif';octx.textAlign="center";octx.fillText("撤离点",s.sx,s.sy-20);}}
}
function drawBreach(){
if(!bMode)return;
octx.fillStyle="rgba(0,0,0,.8)";octx.fillRect(0,0,W,H);
octx.fillStyle="#00ffe5";octx.font='bold 20px "Microsoft YaHei",sans-serif';octx.textAlign="center";octx.fillText("入侵解码",W/2,140);
octx.fillStyle="#aaa";octx.font='12px "Microsoft YaHei",sans-serif';octx.fillText("方向键移动高亮格，回车/空格确认，连成 3 个目标序列",W/2,164);
const px2=W/2-220,gx2=px2+40,gy2=192,cs=60;
octx.fillStyle="#ffd740";octx.font='bold 14px "Microsoft YaHei",sans-serif';octx.textAlign="left";octx.fillText("目标序列:",gx2,gy2-18);
for(let i=0;i<bTargets.length;i++){octx.fillStyle=i<bMatched?"#00e676":"#666";octx.font='bold 18px monospace';octx.fillText(bTargets[i],gx2+100+i*42,gy2-16);}
for(let r=0;r<4;r++)for(let c=0;c<4;c++){const x=gx2+c*cs,y=gy2+r*cs;const isCur=(bAxis==="row"&&r===bLock&&c===bCurC)||(bAxis==="col"&&c===bLock&&r===bCurR);octx.fillStyle=isCur?"rgba(0,230,118,.25)":"rgba(40,40,40,.92)";octx.fillRect(x,y,cs-4,cs-4);octx.strokeStyle=isCur?"#00e676":"#555";octx.lineWidth=isCur?2:1;octx.strokeRect(x,y,cs-4,cs-4);octx.fillStyle=bSeq.some(p=>p.r===r&&p.c===c)?"#00e676":"#fff";octx.font='bold 20px monospace';octx.textAlign="center";octx.fillText(bGrid[r][c],x+(cs-4)/2,y+(cs-4)/2+7);}
octx.fillStyle="#333";octx.fillRect(gx2,gy2+4*cs+10,cs*4,12);octx.fillStyle="#00e676";octx.fillRect(gx2,gy2+4*cs+10,cs*4*(bBuf/bMax),12);
octx.fillStyle="#aaa";octx.font='11px "Microsoft YaHei",sans-serif';octx.fillText("缓冲",gx2,gy2+4*cs+38);
}
function drawCode(){
if(!cMode)return;
octx.fillStyle="rgba(0,0,0,.7)";octx.fillRect(W/2-130,140,260,70);octx.strokeStyle="#9c27b0";octx.lineWidth=2;octx.strokeRect(W/2-130,140,260,70);
octx.fillStyle="#e1bee7";octx.font='bold 16px "Microsoft YaHei",sans-serif';octx.textAlign="center";octx.fillText("输入 3 位密码 (门旁)",W/2,166);
octx.fillStyle="#fff";octx.font='bold 28px monospace';octx.fillText((codeBuf+"___").slice(0,3).split("").map(c=>c==="_"?"_":c).join(" "),W/2,200);
}
function dovl(tl,stl,co,ex){octx.fillStyle="rgba(0,0,0,.75)";octx.fillRect(0,0,W,H);octx.fillStyle=co;octx.font='bold 44px "Microsoft YaHei","Segoe UI",sans-serif';octx.textAlign="center";octx.fillText(tl,W/2,H/2-30);octx.fillStyle="#ccc";octx.font='18px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText(stl,W/2,H/2+18);if(ex){octx.fillStyle="#888";octx.font='14px "Microsoft YaHei","Segoe UI",sans-serif';octx.fillText(ex,W/2,H/2+50)}}
function drawMinimap(){
const enl=termMode;
const s=enl?0.46:0.19;
const w=W*s,h=H*s;
const x=enl?Math.max(8,W-w-16):W-w-6;
const y=enl?36:44;
mm.x=x;mm.y=y;mm.s=s;mm.w=w;mm.h=h;
// 背景与边框
octx.fillStyle=enl?"rgba(0,22,30,.92)":"rgba(0,0,0,.55)";
octx.fillRect(x,y,w,h);
octx.strokeStyle=enl?"#00ffe5":"#4a4a4a";octx.lineWidth=enl?2:1;octx.strokeRect(x,y,w,h);
const cx=k=>x+k*s;
// 墙体
octx.fillStyle="#5a5f66";
for(const wl of walls)octx.fillRect(cx(wl.x),y+wl.y*s,wl.w*s,wl.h*s);
// 容器
octx.fillStyle="#8d6e63";
for(const c of conts){const cs=14*s;octx.fillRect(cx(c.x)-cs/2,y+c.y*s-cs/2,cs,cs);}
// 机枪（炮塔）攻击范围（朝向 180° 扇形）+ 位置 + 朝向
for(const t of turrets){
const px=cx(t.x),py=y+t.y*s;
const rr=(t.vr||180)*s, half=VA/2;
// 180° 攻击扇形
octx.beginPath();octx.moveTo(px,py);octx.arc(px,py,rr,t.va-half,t.va+half);octx.closePath();
octx.fillStyle="rgba(255,40,40,.10)";octx.fill();
octx.strokeStyle="rgba(255,80,80,.55)";octx.lineWidth=1;octx.setLineDash(enl?[4,3]:[3,2]);octx.stroke();octx.setLineDash([]);
// 标记 + 朝向
octx.fillStyle="#ff3030";octx.beginPath();octx.arc(px,py,Math.max(3,9*s),0,Math.PI*2);octx.fill();
octx.strokeStyle="#ff8080";octx.lineWidth=2;octx.beginPath();octx.moveTo(px,py);octx.lineTo(px+Math.cos(t.va)*18*s,py+Math.sin(t.va)*18*s);octx.stroke();
}
// 玩家（位置 + 朝向，便于终端瞄准参考）
{
const px=cx(pl.x),py=y+pl.y*s;
octx.fillStyle="#00e676";octx.beginPath();octx.arc(px,py,Math.max(2,5*s),0,Math.PI*2);octx.fill();
octx.strokeStyle="#00e676";octx.lineWidth=1.5;octx.beginPath();octx.moveTo(px,py);octx.lineTo(px+Math.cos(fpYaw)*14*s,py+Math.sin(fpYaw)*14*s);octx.stroke();
}
// 标题
octx.fillStyle=enl?"#00ffe5":"#9aa";
octx.font=(enl?'bold 13px':'10px')+' "Microsoft YaHei",sans-serif';
octx.textAlign="left";
octx.fillText(enl?"电子终端：点击机枪以瘫痪":"小地图 (V:终端)",x+4,y+(enl?16:12));
}

// ============================================================
//  主循环
// ============================================================
let lt=performance.now();
function chkStairs(){if(!hasStairs(lv,cf))return;const sp=gfc(lv,cf).sp||{c:16,r:1};if(!sp)return;const sx=sp.c*T+T/2,sy=sp.r*T+T/2;if(Math.abs(pl.x-sx)<30&&Math.abs(pl.y-sy)<30){if(lv===4&&!hasKeycard)return;st=4;tt=0;hasKeycard=false;hasTerminal=0}}
function cbd(){if(gal>=.8)return;const all=[...ens.filter(e=>e.al)];if(boss&&boss.al)all.push(boss);for(let i=0;i<defs.length;i++){if(dbs.includes(i))continue;const b=defs[i];if(hidd.some(h=>{const c=conts[h.ci];return c&&Math.abs(c.x-b.x)<10&&Math.abs(c.y-b.y)<10}))continue;for(const e of all){if(iv(e,b,VA,e.vr).inCone){dbs.push(i);gal=Math.min(2.4,gal+.6);break}}}}
function loop(t){
const dt=Math.min((t-lt)/1e3,.1);lt=t;nowT=t;gdt=dt;
if(st===0){if(bMode){bBuf-=dt*1e3;if(bBuf<=0)bMode=false}if(camActive){camTimer-=dt;if(camTimer<=0){camActive=false;camTimer=0}}if(camCD>0){camCD-=dt;if(camCD<0)camCD=0}up(dt);mg();autoDep();chkStairs();cbd();ad2();for(const e of ens)if(e.al){uev(e,dt);uep(e,dt)}if(boss&&boss.al){uev(boss,dt);uep(boss,dt)}if(miniBoss&&miniBoss.al){uev(miniBoss,dt);uep(miniBoss,dt)}udet(dt);cev()}else if(st===2){lct+=dt;if(lct>2)il(lv+1,0)}else if(st===4){tt+=dt;if(tt>.5){il(lv,cf+1);st=0;tt=0}}
sync3D();
if(fp){
 const eyeY=crouch?14:24;camera.position.set(pl.x,eyeY,pl.y);
 const cp=Math.cos(fpPitch),sh=Math.sin(fpPitch);const hx=Math.cos(fpYaw)*cp,hz=Math.sin(fpYaw)*cp;
 camera.lookAt(pl.x+hx*120,eyeY+sh*120,pl.y+hz*120);
}else{cam.update();}
renderer.render(scene,camera);
// 叠加层
octx.clearRect(0,0,W,H);
dhud();drawWorldLabels();
if(bMode)drawBreach();else if(cMode)drawCode();
if(!bMode&&!cMode)drawMinimap();
if(st===4){const a=Math.min(1,tt/.5);octx.fillStyle=`rgba(0,0,0,${a})`;octx.fillRect(0,0,W,H);octx.fillStyle="#fff";octx.font='bold 20px "Microsoft YaHei","Segoe UI",sans-serif';octx.textAlign="center";octx.fillText("上楼中...",W/2,H/2)}
else if(st===1){got+=dt;if(got>.5)dovl("任务失败",`第 ${lv+1} 关 - 已被敌方发现`,"#ff1744","按 R 键重试本关")}
else if(st===2){const n=lv+1;if(n<5)dovl("关卡完成",`第 ${lv+1} 关通过`,"#00e676",`即将进入第 ${n+1} 关 - ${LVS[n].name}`);else dovl("关卡完成",`第 ${lv+1} 关通过`,"#00e676","准备迎接最终胜利...")}
else if(st===3)dovl("全部通关","所有关卡已完成，任务圆满成功！","#ffd740","按 R 键重新开始");
requestAnimationFrame(loop);
}
igame();
requestAnimationFrame(loop);

