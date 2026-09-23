// Test fixture only: set up an existing book before exercising frozen HTTP reads.
// No runtime module imports this fixture and no remote contract is simulated here.
import {resetDummy,SKUS} from '../../rabbit/engine.mjs';
import {initialise} from './core.mjs';
export function seedFrozenPreview(){const s=resetDummy();initialise(s,SKUS,true,Date.now());return s;}
