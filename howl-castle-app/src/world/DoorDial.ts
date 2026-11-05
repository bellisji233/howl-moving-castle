import type {Destination} from './Environment';

// Door-local coordinates: +Y is up. SVG uses the same sectors with Y inverted.
export const DOOR_ANGLES:Record<Destination,number>={
  studio:0,meadow:Math.PI/4,harbor:-Math.PI/4,capital:Math.PI*.75,night:-Math.PI*.75,
};
export const DOOR_SECTORS:{id:Exclude<Destination,'studio'>;start:number}[]=[
  {id:'harbor',start:0},{id:'meadow',start:Math.PI/2},
  {id:'capital',start:Math.PI},{id:'night',start:Math.PI*1.5},
];
