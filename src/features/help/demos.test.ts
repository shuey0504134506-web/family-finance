import { describe, expect, it } from 'vitest';
import * as D from './demos';
import scenes from './scenes.json';

describe('הדגמות עזרה', () => {
  const all = Object.entries(D).flatMap(([name, steps]) => (steps as Array<{ caption: string; scene: string }>).map((s) => ({ name, ...s })));

  it('כל שלב מפנה לצילום קיים בעברית ובאנגלית', () => {
    const data = scenes as Record<string, Record<string, unknown>>;
    for (const s of all) {
      expect(data.he[s.scene], `${s.name}: ${s.scene} (he)`).toBeTruthy();
      expect(data.en[s.scene], `${s.name}: ${s.scene} (en)`).toBeTruthy();
    }
  });
});
