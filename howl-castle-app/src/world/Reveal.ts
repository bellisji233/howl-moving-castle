import * as T from 'three';

/** One set per landscape world. The arriving world is drawn inside the radius,
 * the departing world outside it; near the front both fold flat like the page
 * of a pop-up book, so the new place visibly unfolds out of the ground. */
export interface RevealUniforms{
  uRevealCenter:{value:T.Vector2};uRevealRadius:{value:number};uRevealWidth:{value:number};
  uRevealSide:{value:number};uRevealActive:{value:number};uRevealFloor:{value:number};
  uRevealColor:{value:T.Color};uRevealGlow:{value:number};uSkyCut:{value:number};
}
export function revealUniforms():RevealUniforms{
  return{uRevealCenter:{value:new T.Vector2()},uRevealRadius:{value:0},uRevealWidth:{value:9},uRevealSide:{value:1},uRevealActive:{value:0},
    uRevealFloor:{value:0},uRevealColor:{value:new T.Color('#ffd58a')},uRevealGlow:{value:0},uSkyCut:{value:1}};
}

export const REVEAL_VERTEX_HEAD=`uniform vec2 uRevealCenter;uniform float uRevealRadius,uRevealWidth,uRevealSide,uRevealActive,uRevealFloor;varying float vRevealD;\n`;
export const REVEAL_FRAGMENT_HEAD=`uniform float uRevealRadius,uRevealSide,uRevealActive,uRevealGlow;uniform vec3 uRevealColor;varying float vRevealD;\n`;
/** Folds a world-space position and records its distance from the castle. */
export const REVEAL_FOLD=`
  vRevealD=length(rvW.xz-uRevealCenter);
  float rvS=uRevealSide>.5?smoothstep(0.,uRevealWidth,uRevealRadius-vRevealD):smoothstep(0.,uRevealWidth,vRevealD-uRevealRadius);
  rvW.y=mix(uRevealFloor,rvW.y,mix(1.,rvS,uRevealActive));`;
export const REVEAL_DISCARD=`if(uRevealActive>.5&&(uRevealSide>.5?vRevealD>uRevealRadius:vRevealD<uRevealRadius))discard;`;
/** A bright seam rides the front; it is added before the bloom pass so it glows. */
export const REVEAL_SEAM=`(uRevealColor*uRevealGlow*uRevealActive*(exp(-abs(vRevealD-uRevealRadius)*1.2)*.5+exp(-abs(vRevealD-uRevealRadius)*7.)*1.8))`;

const PROJECT=`
  vec4 rvW=vec4(transformed,1.0);
  #ifdef USE_INSTANCING
  rvW=instanceMatrix*rvW;
  #endif
  rvW=modelMatrix*rvW;${REVEAL_FOLD}
  vec4 mvPosition=viewMatrix*rvW;
  gl_Position=projectionMatrix*mvPosition;`;

export function patchReveal(material:T.Material,uniforms:RevealUniforms){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=REVEAL_VERTEX_HEAD+shader.vertexShader.replace('#include <project_vertex>',PROJECT);
    shader.fragmentShader=REVEAL_FRAGMENT_HEAD+shader.fragmentShader
      .replace('void main() {',`void main() {\n${REVEAL_DISCARD}`)
      .replace('#include <dithering_fragment>',`#include <dithering_fragment>\ngl_FragColor.rgb+=${REVEAL_SEAM};`);
  };
  material.customProgramCacheKey=()=>'reveal-v1';
  material.needsUpdate=true;
}
