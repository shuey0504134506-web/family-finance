import { afterEach, expect, it, vi } from 'vitest';
import { getRatesFor, saveManualRates, hasManualPair } from './historicalRates';
afterEach(()=>vi.unstubAllGlobals());
it('keeps manual rates separate by account and date, with explicit default fallback',()=>{
  const data=new Map<string,string>();
  vi.stubGlobal('localStorage',{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)});
  vi.stubGlobal('navigator',{onLine:false});
  saveManualRates('a','default',{USD:.25});
  saveManualRates('a','2026-01-01',{USD:.2});
  expect(getRatesFor('2026-01-01','a')?.USD).toBe(.2);
  expect(getRatesFor('2026-01-02','a')?.USD).toBe(.25);
  expect(getRatesFor('2026-01-01','b')).toBeUndefined();
  expect(hasManualPair('a','2026-01-01','ILS','EUR')).toBe(false);
  expect(()=>saveManualRates('a','2026-01-01',{EUR:0})).toThrow();
});
