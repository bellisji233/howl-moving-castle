import * as T from 'three';

type RGB=[number,number,number];
type SurfaceKind='iron'|'copper'|'brass'|'patina'|'roof'|'plaster'|'wood';
const SIZE=512;
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a:RGB,b:RGB,t:number):RGB=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function noiseGrid(size:number,seed:number){
  const rng=random(seed),grid=Float32Array.from({length:size*size},rng);
  return (u:number,v:number)=>{
    const x=((u%1)+1)%1*size,y=((v%1)+1)%1*size,ix=Math.floor(x),iy=Math.floor(y);
    const sx=x-ix,sy=y-iy,tx=sx*sx*(3-2*sx),ty=sy*sy*(3-2*sy);
    const a=grid[iy*size+ix],b=grid[iy*size+(ix+1)%size],c=grid[((iy+1)%size)*size+ix],d=grid[((iy+1)%size)*size+(ix+1)%size];
    return(a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty;
  };
}
/** Authored, repeatable surface fields: large washes, exposed metal, oxidation,
 * soot streaks and fine relief live at separate scales. No image assets fetched. */
function surface(kind:SurfaceKind,base:RGB,worn:RGB,oxidized:RGB,seed:number){
  const canvas=document.createElement('canvas'),relief=document.createElement('canvas');
  canvas.width=canvas.height=relief.width=relief.height=SIZE;
  const ctx=canvas.getContext('2d')!,rctx=relief.getContext('2d')!;
  const pixels=ctx.createImageData(SIZE,SIZE),data=rctx.createImageData(SIZE,SIZE);
  const n4=noiseGrid(4,seed),n8=noiseGrid(8,seed+19),n16=noiseGrid(16,seed+43),n64=noiseGrid(64,seed+101),rng=random(seed+809);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    const u=x/SIZE,v=y/SIZE,cloud=.52*n4(u,v)+.3*n8(u,v)+.18*n16(u,v);
    const fine=n64(u,v),grain=rng(),run=n16(u,v*.125),brush=n64(u*.25,v);
    let wear=smooth(.56,.73,.75*cloud+.15*fine+.1*run);
    let color:RGB,bump=.5,rough=.82;
    if(kind==='wood'){
      const grainWave=Math.sin(u*210+(n8(u,v*.12)-.5)*18+n16(u,v*.08)*8);
      wear=smooth(.2,.85,.55*cloud+.25*(grainWave*.5+.5)+.2*fine);
      color=mix(base,worn,wear);const fissure=smooth(.9,.99,grainWave*.5+.5)*.25;
      color=mix(color,oxidized,fissure);bump=.34+.3*wear-.18*fissure;rough=.87+.1*cloud;
    }else if(kind==='plaster'){
      color=mix(base,worn,smooth(.25,.74,cloud));
      const damage=smooth(.6,.76,cloud+.09*fine);color=mix(color,oxidized,damage*.7);
      bump=.3+.3*fine+.15*grain;rough=.94;
    }else if(kind==='roof'){
      color=mix(base,worn,smooth(.25,.75,cloud));
      color=mix(color,oxidized,smooth(.53,.75,.65*cloud+.35*run)*.65);
      bump=.35+.23*fine+.12*grain;rough=.9+.08*fine;
    }else{
      color=mix(base,worn,smooth(.25,.75,n8(u,v))*.56);
      color=mix(color,oxidized,wear*.56);
      const soot=smooth(.58,.83,.58*run+.42*n8(u,v*.35));
      color=mix(color,[31,30,27],soot*.38);
      const pits=smooth(.76,.94,grain)*wear;
      const scratch=smooth(.88,.99,brush)*smooth(.35,.7,fine)*.12;
      color=mix(color,worn,scratch);bump=.53-.23*wear-.22*pits+.035*fine;
      rough=.56+.27*wear+.1*fine+.045*grain;
    }
    const pigment=.95+.07*fine+.035*(grain-.5);
    const i=(y*SIZE+x)*4;
    pixels.data[i]=color[0]*pigment;pixels.data[i+1]=color[1]*pigment;pixels.data[i+2]=color[2]*pigment;pixels.data[i+3]=255;
    // Bump reads red, roughness reads green: one shared non-color map serves both.
    data.data[i]=Math.round(bump*255);data.data[i+1]=Math.round(rough*255);data.data[i+2]=0;data.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);rctx.putImageData(data,0,0);
  const map=new T.CanvasTexture(canvas),detail=new T.CanvasTexture(relief);
  map.colorSpace=T.SRGBColorSpace;
  for(const texture of [map,detail]){texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;}
  return {map,detail};
}
export function makeMaterials(){
  const iron=surface('iron',[108,108,100],[146,145,132],[116,82,61],1823);
  const copper=surface('copper',[127,94,72],[166,132,98],[68,78,66],271);
  const brass=surface('brass',[153,126,75],[203,175,112],[86,79,58],812);
  const patina=surface('patina',[80,101,89],[133,149,124],[101,76,49],399);
  const roof=surface('roof',[130,67,49],[173,110,76],[64,64,51],918);
  const plaster=surface('plaster',[196,182,152],[222,209,175],[128,120,96],986);
  const wood=surface('wood',[92,65,43],[141,112,77],[43,37,29],473);
  const coat=(field:ReturnType<typeof surface>,tint:string,metalness:number,bumpScale=.035)=>{
    const mat=new T.MeshStandardMaterial({color:tint,map:field.map,roughnessMap:field.detail,bumpMap:field.detail,bumpScale,roughness:1,metalness,envMapIntensity:1});
    mat.userData.surfaceScale=field===wood?.7:field===plaster?.5:.42;
    return mat;
  };
  return {
    // Metal now reflects each destination's sky, so metalness carries more of the look than flat tint.
    soot:coat(iron,'#74746b',.2),iron:coat(iron,'#e2e2db',.42),ironDark:coat(iron,'#919b95',.48),steel:coat(iron,'#d0d4d2',.74,.018),
    copper:coat(copper,'#e8d5bd',.55),rust:coat(copper,'#b88568',.16,.05),brass:coat(brass,'#e2d3a8',.72,.02),
    patina:coat(patina,'#cad6c6',.28),roof:coat(roof,'#e4d0bc',.04,.035),roofDark:coat(roof,'#a9a397',.03,.035),
    plaster:coat(plaster,'#e7dfce',0,.028),timber:coat(wood,'#9e8b70',0,.025),boards:coat(wood,'#d7c09a',0,.025),
    dark:new T.MeshStandardMaterial({color:'#191c1a',roughness:.95}),
    ink:new T.MeshStandardMaterial({color:'#373830',roughness:.89,metalness:.1}),
    glass:new T.MeshStandardMaterial({color:'#deb66e',emissive:'#e49a39',emissiveIntensity:.42,roughness:.57}),
    glassGreen:new T.MeshStandardMaterial({color:'#7b9a82',emissive:'#41775c',emissiveIntensity:.16,roughness:.6}),
    glassRed:new T.MeshStandardMaterial({color:'#ba7f62',emissive:'#a65436',emissiveIntensity:.2,roughness:.58}),
    fire:new T.MeshStandardMaterial({color:'#ffc35b',emissive:'#ff8b24',emissiveIntensity:.9,roughness:.8}),
    ember:new T.MeshStandardMaterial({color:'#ed8a32',emissive:'#ff6d16',emissiveIntensity:.7,roughness:.8}),
    rope:new T.MeshStandardMaterial({color:'#655744',roughness:1}),
  };
}
export type Materials=ReturnType<typeof makeMaterials>;
