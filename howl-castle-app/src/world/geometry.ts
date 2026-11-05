import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Vec=[number,number,number];
const sphereGeo=new T.SphereGeometry(1,12,8),roundSphereGeo=new T.SphereGeometry(1,22,14);
const boxGeo=new T.BoxGeometry(1,1,1);
// Large cylinders need more sides or their silhouettes facet; thin rods stay cheap.
const cylinders=new Map<number,T.CylinderGeometry>();
const sides=(r:number)=>r>=.3?36:r>=.12?22:12;
const cylinderGeo=(n:number)=>{let g=cylinders.get(n);if(!g){g=new T.CylinderGeometry(1,1,1,n);cylinders.set(n,g);}return g;};
/** Sharp 90° box edges never catch light, which is what makes code-built parts read as
 * primitives. Boxes thick enough to see get a small rounded edge sized to their thinnest side. */
const rounded=new Map<string,T.BufferGeometry>();
function boxGeometry(s:Vec){
  const thin=Math.min(...s);if(thin<.06)return null;
  const key=s.map(v=>v.toFixed(3)).join('|');let g=rounded.get(key);
  if(!g){g=new RoundedBoxGeometry(s[0],s[1],s[2],1,Math.min(.035,thin*.18));rounded.set(key,g);}
  return g;
}
const rivetGeo=new T.IcosahedronGeometry(1,0);

export function mesh(parent:T.Object3D,geometry:T.BufferGeometry,material:T.Material,p:Vec=[0,0,0],s:Vec=[1,1,1],r:Vec=[0,0,0]){
  const m=new T.Mesh(geometry,material);m.position.set(...p);m.scale.set(...s);m.rotation.set(...r);m.castShadow=m.receiveShadow=true;parent.add(m);return m;
}
export function box(parent:T.Object3D,mat:T.Material,p:Vec,s:Vec,r:Vec=[0,0,0]){const g=boxGeometry(s);return g?mesh(parent,g,mat,p,[1,1,1],r):mesh(parent,boxGeo,mat,p,s,r);}
export function ball(parent:T.Object3D,mat:T.Material,p:Vec,s:Vec){return mesh(parent,Math.max(...s)>.15?roundSphereGeo:sphereGeo,mat,p,s);}
export function rod(parent:T.Object3D,mat:T.Material,a:Vec,b:Vec,r:number,r2=r){
  const va=new T.Vector3(...a),vb=new T.Vector3(...b),d=vb.clone().sub(va);
  const geo=r===r2?cylinderGeo(sides(r)):new T.CylinderGeometry(r2/r,1,1,sides(Math.max(r,r2)));
  const m=mesh(parent,geo,mat,va.add(vb).multiplyScalar(.5).toArray() as Vec,[r,d.length(),r]);
  m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;
}
export function pipe(parent:T.Object3D,mat:T.Material,points:Vec[],radius:number){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));return mesh(parent,new T.TubeGeometry(curve,Math.max(12,points.length*6),radius,8,false),mat);
}
export function ring(parent:T.Object3D,mat:T.Material,p:Vec,r:number,t:number,rot:Vec=[0,0,0],scale:Vec=[1,1,1]){
  return mesh(parent,new T.TorusGeometry(r,t,6,40),mat,p,scale,rot);
}
export function bolts(parent:T.Object3D,mat:T.Material,center:Vec,r:number,count:number,axis:'z'|'y'|'x'='z',size=.045){
  for(let i=0;i<count;i++){
    const a=i/count*Math.PI*2;const p:Vec=[...center];
    if(axis==='z'){p[0]+=Math.cos(a)*r;p[1]+=Math.sin(a)*r;}
    if(axis==='y'){p[0]+=Math.cos(a)*r;p[2]+=Math.sin(a)*r;}
    if(axis==='x'){p[1]+=Math.cos(a)*r;p[2]+=Math.sin(a)*r;}
    mesh(parent,rivetGeo,mat,p,[size,size,size]);
  }
}
export function lathe(parent:T.Object3D,mat:T.Material,profile:[number,number][],p:Vec=[0,0,0],scale:Vec=[1,1,1],start=0,length=Math.PI*2){
  return mesh(parent,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),Math.ceil(48*length/(Math.PI*2)),start,length),mat,p,scale);
}
export function extrude(parent:T.Object3D,mat:T.Material,outline:[number,number][],depth:number,p:Vec=[0,0,0],r:Vec=[0,0,0],bevel=.025){
  const shape=new T.Shape(outline.map(v=>new T.Vector2(...v)));const geo=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});return mesh(parent,geo,mat,p,[1,1,1],r);
}
// Bake only static detail within each independently selectable part. Later motion
// acts on the part root or replaces its geometry without changing its stable ID.
export function mergePart(part:T.Group){
  part.updateMatrixWorld(true);const inverse=part.matrixWorld.clone().invert();
  const byMaterial=new Map<T.Material,T.BufferGeometry[]>();
  part.traverse(o=>{if(!(o instanceof T.Mesh))return;const source=o.geometry.clone();
    source.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    const geo=source.index?source.toNonIndexed():source;
    if(!geo.getAttribute('uv'))geo.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(geo.getAttribute('position').count*2),2));
    const scale=(o.material as T.Material).userData.surfaceScale as number|undefined;
    if(scale){
      const pos=geo.getAttribute('position'),normal=geo.getAttribute('normal'),uv=geo.getAttribute('uv');
      // Project each whole triangle onto its dominant plane. The scale is in
      // authored design units, so small rivets and large plates share a grain.
      for(let i=0;i<pos.count;i+=3){
        let nx=0,ny=0,nz=0;
        for(let j=0;j<3;j++){nx+=normal.getX(i+j);ny+=normal.getY(i+j);nz+=normal.getZ(i+j);}
        const ax=Math.abs(nx),ay=Math.abs(ny),az=Math.abs(nz);
        for(let j=0;j<3;j++){
          const k=i+j,x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k);
          uv.setXY(k,(ax>ay&&ax>az?z:x)*scale,(ay>ax&&ay>az?z:y)*scale);
        }
      }
    }
    geo.deleteAttribute('tangent');
    const mat=o.material as T.Material;const list=byMaterial.get(mat)||[];list.push(geo);byMaterial.set(mat,list);
  });
  part.clear();
  for(const [material,geos] of byMaterial){const merged=mergeGeometries(geos,false);if(!merged)throw new Error(`Could not merge ${part.name}`);mesh(part,merged,material);geos.forEach(g=>g.dispose());}
}
