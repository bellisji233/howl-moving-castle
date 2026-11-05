import * as T from 'three';
import {box,rod,extrude,type Vec} from './geometry';
export const randomFrom=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const PI=Math.PI;
function canvasTexture(draw:(c:CanvasRenderingContext2D,r:()=>number)=>void,seed=82){const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const c=canvas.getContext('2d')!;draw(c,randomFrom(seed));const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;}
function grain(c:CanvasRenderingContext2D,r:()=>number,count=9000,alpha=.06){for(let i=0;i<count;i++){c.fillStyle=r()>.48?`rgba(255,246,218,${alpha})`:`rgba(28,42,38,${alpha})`;const s=1+r()*5;c.fillRect(r()*512,r()*512,s,s);}}
function standard(color:string,map?:T.Texture,roughness=.9){const m=new T.MeshStandardMaterial({color,...(map?{map}:{}),roughness});return m;}
export class LandscapeAssets{
  grass:T.MeshStandardMaterial;stone:T.MeshStandardMaterial;road:T.MeshStandardMaterial;timber:T.MeshStandardMaterial;
  walls:T.MeshStandardMaterial[]=[];facades:T.MeshStandardMaterial[]=[];roofs:T.MeshStandardMaterial[]=[];
  trim=standard('#746d59');ink=standard('#354741');leaf=standard('#6f8751');bark=standard('#665b40');
  sail=new T.MeshStandardMaterial({color:'#cbbf9b',roughness:1,side:T.DoubleSide});
  glass=new T.MeshStandardMaterial({color:'#c9b384',emissive:'#eab16b',emissiveIntensity:.85,roughness:.4});
  constructor(night=false){
    const grassMap=canvasTexture((c,r)=>{c.fillStyle='#d0cdb1';c.fillRect(0,0,512,512);for(let i=0;i<1500;i++){c.fillStyle=['#a5af73','#859b60','#bbc08b','#6f8c59'][i%4];c.globalAlpha=.04+r()*.07;c.beginPath();c.ellipse(r()*512,r()*512,4+r()*24,2+r()*16,r()*PI,0,PI*2);c.fill();}c.globalAlpha=1;for(let i=0;i<4000;i++){const x=r()*512,y=r()*512;c.strokeStyle=r()>.5?'#788b57':'#c6c99a';c.globalAlpha=.15;c.lineWidth=.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+r()*3-1,y-r()*5);c.stroke();}c.globalAlpha=1;grain(c,r);});
    this.grass=standard(night?'#98aa98':'#ffffff',grassMap,1);this.grass.vertexColors=true;
    const stoneMap=canvasTexture((c,r)=>{c.fillStyle='#b0aa93';c.fillRect(0,0,512,512);const rows=16,sh=512/rows;for(let y=0;y<rows;y++){for(let x=-1;x<9;x++){const px=x*64+(y%2)*32;c.fillStyle=`hsl(${37+r()*8} ${9+r()*8}% ${58+r()*13}%)`;c.fillRect(px+1,y*sh+1,62,sh-2);c.strokeStyle='#d0c7ae';c.lineWidth=1;c.strokeRect(px+2,y*sh+2,60,sh-4);if(r()>.7){c.fillStyle='#77816b';c.globalAlpha=.2;c.fillRect(px+2,y*sh+sh-5,28,3);c.globalAlpha=1;}}}grain(c,r,12000,.1);});
    this.stone=standard('#c6c1ae',stoneMap);this.stone.userData.surfaceScale=.11;
    const roadMap=canvasTexture((c,r)=>{c.fillStyle='#9c9984';c.fillRect(0,0,512,512);for(let y=0;y<22;y++)for(let x=-1;x<13;x++){const px=x*43+(y%2)*21;c.fillStyle=`hsl(${40+r()*8} ${5+r()*7}% ${49+r()*15}%)`;c.beginPath();c.roundRect(px+1,y*24+1,40,21,3);c.fill();c.strokeStyle='#c2baa2';c.globalAlpha=.3;c.stroke();c.globalAlpha=1;}grain(c,r,9000,.12);});
    this.road=standard('#d9cfb1',roadMap);this.road.userData.surfaceScale=.19;
    const wood=canvasTexture((c,r)=>{c.fillStyle='#675b46';c.fillRect(0,0,512,512);for(let i=0;i<500;i++){c.strokeStyle=i%2?'#8e7c59':'#3d4136';c.globalAlpha=.1+r()*.2;const y=r()*512;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(140,y+r()*5,300,y-r()*5,512,y+1);c.stroke();}c.globalAlpha=1;grain(c,r);});
    this.timber=standard('#c7b38e',wood);this.timber.userData.surfaceScale=.7;
    const palette=['#d0bea1','#bdc2ad','#d0b99d','#9caeaa','#b9b294','#c7c4af','#b3b7a5','#d3c4a8'];
    for(let i=0;i<8;i++){
      const base=palette[i];const wallMap=canvasTexture((c,r)=>{c.fillStyle=base;c.fillRect(0,0,512,512);for(let j=0;j<180;j++){c.globalAlpha=.025+r()*.03;c.fillStyle=j%2?'#4c6457':'#fff1ca';c.beginPath();c.ellipse(r()*512,r()*512,10+r()*80,8+r()*60,0,0,PI*2);c.fill();}c.globalAlpha=1;grain(c,r,9000,.045);},40+i);
      this.walls.push(standard('#ffffff',wallMap));
      const map=canvasTexture((c,r)=>{
        c.fillStyle=base;c.fillRect(0,0,512,512);
        for(let j=0;j<100;j++){c.globalAlpha=.04;c.fillStyle=j%2?'#40564e':'#ffefd2';c.fillRect(r()*512,r()*512,2+r()*100,3+r()*100);}c.globalAlpha=1;
        // Three floor elevations: recessed windows, stone lintels and weathered shutters.
        for(let fy=0;fy<3;fy++){
          const y=28+fy*156;c.fillStyle='#a49c83';c.fillRect(0,y+121,512,7);c.fillStyle='#e0d2b4';c.fillRect(0,y+122,512,2);
          for(let wx=0;wx<3;wx++){
            const x=46+wx*155;c.fillStyle='#726f5b';c.fillRect(x-7,y-4,84,109);c.fillStyle='#dfd0af';c.fillRect(x-3,y,76,101);
            c.fillStyle='#384d4b';c.fillRect(x+4,y+7,62,85);
            const lit=night?(r()>.12):(r()>.88);if(lit){const glow=c.createLinearGradient(0,y,0,y+90);glow.addColorStop(0,'#b18d52');glow.addColorStop(1,'#efc979');c.fillStyle=glow;}else c.fillStyle=i%2?'#607975':'#5c706a';
            c.fillRect(x+8,y+11,54,77);c.fillStyle='#bdbb9d';c.fillRect(x+33,y+9,3,80);c.fillRect(x+5,y+45,58,3);
            c.fillStyle='#796c51';c.fillRect(x-5,y+100,82,8);c.fillStyle='#e1d2b0';c.fillRect(x-7,y+98,86,3);
            if((i+wx)%3===0){c.fillStyle=i%2?'#657d72':'#7f8164';c.fillRect(x-25,y+6,18,88);c.fillRect(x+77,y+6,18,88);for(let q=0;q<8;q++){c.fillStyle='#3c51453b';c.fillRect(x-24,y+11+q*10,16,2);c.fillRect(x+78,y+11+q*10,16,2);}}
          }
        }
        c.fillStyle='#8a8975';c.fillRect(0,485,512,27);for(let q=0;q<12;q++){c.fillStyle='#b7b199';c.fillRect(q*47+1,488,44,21);}grain(c,r,10000,.07);
      },300+i);
      const facade=standard('#ffffff',map);if(night){facade.emissive.set('#f0b45f');facade.emissiveMap=map;facade.emissiveIntensity=.10;}this.facades.push(facade);
    }
    for(const color of ['#7a887e','#a2765e','#5c7172','#8d8270']){
      const map=canvasTexture((c,r)=>{c.fillStyle=color;c.fillRect(0,0,512,512);for(let y=0;y<18;y++)for(let x=-1;x<13;x++){const px=x*43+(y%2)*21;c.fillStyle=`rgba(${r()>.5?'225,213,171':'25,48,45'},${.06+r()*.15})`;c.fillRect(px+1,y*29+1,41,27);c.fillStyle='#273f3d55';c.fillRect(px,y*29+27,43,2);}grain(c,r,7000,.05);});this.roofs.push(standard('#ffffff',map));
    }
  }
}
export function villageHouse(parent:T.Group,assets:LandscapeAssets,p:Vec,w:number,h:number,d:number,variant:number,turn=0,detailed=false,plain=false){
  const g=new T.Group();g.position.set(...p);g.rotation.y=turn;parent.add(g);const wall=assets.walls[variant%8],roof=assets.roofs[variant%4],facade=assets.facades[variant%8];
  box(g,wall,[0,h/2,0],[w,h,d]);box(g,assets.stone,[0,.15,0],[w+.12,.3,d+.12]);
  if(!plain)for(const side of [-1,1]){const face=new T.Mesh(new T.PlaneGeometry(w,h),facade);face.position.set(0,h/2,side*(d/2+.012));if(side<0)face.rotation.y=PI;g.add(face);const end=new T.Mesh(new T.PlaneGeometry(d,h),facade);end.position.set(side*(w/2+.012),h/2,0);end.rotation.y=side*PI/2;g.add(end);}
  box(g,assets.trim,[0,h-.08,0],[w+.25,.16,d+.24]);
  const rise=w*(.40+(variant%3)*.06),half=w*.55,slope=Math.hypot(half,rise),angle=Math.atan2(rise,half);for(const side of [-1,1]){box(g,assets.trim,[side*half/2,h+rise/2-.07,0],[slope,.12,d+.55],[0,0,-side*angle]);box(g,roof,[side*half/2,h+rise/2+.02,0],[slope,.09,d+.57],[0,0,-side*angle]);}
  // Light plaster gable nested inside the roof, with a dark ridge and eaves.
  for(const side of [-1,1]){
    extrude(g,wall,[[-w*.48,0],[w*.48,0],[0,rise*.9]],.025,[0,h,side*(d/2+.015)],[0,side<0?PI:0,0],0);
    rod(g,assets.trim,[-w*.55,h,side*(d/2+.27)],[0,h+rise,side*(d/2+.27)],.055);
    rod(g,assets.trim,[0,h+rise,side*(d/2+.27)],[w*.55,h,side*(d/2+.27)],.055);
  }
  rod(g,roof,[0,h+rise+.03,-d/2-.3],[0,h+rise+.03,d/2+.3],.09);
  box(g,assets.stone,[-w*.24,h+rise*.55,0],[.55,2,.65]);box(g,assets.trim,[-w*.24,h+rise*.55+1,0],[.72,.12,.81]);
  if(detailed){
    for(const side of [-1,1]){box(g,assets.timber,[side*(w/2-.06),h/2,d/2+.06],[.13,h,.10]);box(g,assets.timber,[0,h*.35,side*(d/2+.08)],[w,.12,.12]);}
    box(g,assets.ink,[0,1,d/2+.07],[.95,2.05,.12]);box(g,assets.timber,[0,1,d/2+.15],[.8,1.95,.1]);box(g,assets.stone,[0,.07,d/2+.42],[1.3,.14,.75]);
    const dormer=new T.Group();dormer.position.set(w*.18,h+rise*.32,d*.28);g.add(dormer);box(dormer,wall,[0,.35,0],[1.1,.7,1.2]);box(dormer,assets.ink,[0,.38,.62],[.65,.58,.05]);box(dormer,assets.glass,[0,.39,.66],[.49,.44,.04]);extrude(dormer,roof,[[-.67,0],[.67,0],[0,.65]],1.4,[0,.7,-.7],[0,0,0],.02);
  }
  return g;
}
