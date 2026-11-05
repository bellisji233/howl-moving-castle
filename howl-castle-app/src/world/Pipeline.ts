import * as T from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';

class HookPass extends Pass{constructor(private fn:()=>void){super();this.needsSwap=false;}render(){this.fn();}}

/** HDR multisampled frame → ground-truth AO → bloom → tone mapping.
 * Contact shadow between stacked parts is what makes the castle read as one
 * heavy object instead of separate primitives. */
export class RenderPipeline{
  composer:EffectComposer;gtao:GTAOPass;bloom:UnrealBloomPass;
  /** Objects that must not write into the AO depth/normal buffer (sky, shadow catcher, grass, translucent marks). */
  aoExclude:()=>T.Object3D[]=()=>[];
  private hidden:T.Object3D[]=[];private aoBase=1;
  constructor(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.PerspectiveCamera,private low:boolean){
    const size=renderer.getDrawingBufferSize(new T.Vector2());
    const target=new T.WebGLRenderTarget(Math.max(1,size.x),Math.max(1,size.y),{type:T.HalfFloatType,samples:low?0:4});
    this.composer=new EffectComposer(renderer,target);
    this.composer.addPass(new RenderPass(scene,camera));
    this.gtao=new GTAOPass(scene,camera,Math.max(1,size.x),Math.max(1,size.y));
    this.gtao.output=GTAOPass.OUTPUT.Default;
    this.gtao.updateGtaoMaterial({radius:.75,distanceExponent:1.6,thickness:1.2,scale:1,samples:16,distanceFallOff:1,screenSpaceRadius:false});
    this.gtao.updatePdMaterial({lumaPhi:10,depthPhi:2,normalPhi:3,radius:5,rings:2,samples:16});
    this.gtao.enabled=!low;
    this.composer.addPass(new HookPass(()=>{for(const o of this.aoExclude())if(o.visible){o.visible=false;this.hidden.push(o);}}));
    this.composer.addPass(this.gtao);
    this.composer.addPass(new HookPass(()=>{for(const o of this.hidden)o.visible=true;this.hidden.length=0;}));
    this.bloom=new UnrealBloomPass(new T.Vector2(size.x/2,size.y/2),0,.55,1);this.bloom.enabled=false;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }
  setSize(width:number,height:number,pixelRatio:number){this.composer.setPixelRatio(pixelRatio);this.composer.setSize(width,height);}
  setAO(intensity:number){this.aoBase=intensity;this.gtao.blendIntensity=intensity;this.gtao.enabled=!this.low&&intensity>.01;}
  setBloom(strength:number){this.bloom.strength=strength;this.bloom.enabled=!this.low&&strength>.01;}
  get ao(){return this.aoBase;}
  render(){this.composer.render();}
  dispose(){this.composer.dispose();this.gtao.dispose();this.bloom.dispose();}
}
