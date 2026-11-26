import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChat } from '../domain/aiChats';

const memory = vi.hoisted(() => ({ docs: new Map<string, AiChat>(), batches: 0 }));
vi.mock('../firebase/config', () => ({ app: {}, db: {} }));
vi.mock('../firebase/cacheFirst', () => ({ onSnapshot: vi.fn(() => () => undefined) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => path.join('/'),
  doc: (path: string, id: string) => `${path}/${id}`,
  getDocsFromServer: async (path: string) => ({ docs: [...memory.docs].filter(([k]) => k.startsWith(`${path}/`)).map(([k, c]) => ({ id: k.split('/').at(-1), data: () => c })) }),
  deleteDoc: async (path: string) => { memory.docs.delete(path); },
  writeBatch: () => {
    const operations: Array<() => void> = [];
    return { set: (k: string, c: AiChat) => operations.push(() => memory.docs.set(k,c)), delete: (k: string) => operations.push(() => { memory.docs.delete(k); }), commit: async () => { memory.batches++; operations.forEach(op => op()); } };
  },
}));
import { deleteAiChat, saveAiChat } from './aiService';

const chat = (id: string, updatedAt: number): AiChat => ({ id, title: id, pinned: false, createdAt: 1, updatedAt, messages: [{role:'user',text:'נתון פיקטיבי'}] });
const archiveKey = 'ff.ai.archive.v1.test';
const values = new Map<string, string>();
const storage = { getItem: vi.fn((key: string) => values.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { values.set(key, value); }) };
beforeEach(() => {
  memory.docs.clear(); memory.batches = 0; values.clear(); storage.setItem.mockReset(); storage.setItem.mockImplementation((key, value) => { values.set(key,value); });
  vi.stubGlobal('localStorage', storage); vi.stubGlobal('window', new EventTarget());
  for (let i=1; i<=10; i++) memory.docs.set(`users/test/aiChats/${i}`, chat(String(i),i));
});
describe('AI chat archive', () => {
  it('moves the oldest chat only after a local copy exists, promotes and deletes', async () => {
    await saveAiChat('test',chat('11',11));
    expect(memory.docs.size).toBe(10);
    expect(JSON.parse(values.get(archiveKey)!)[0].id).toBe('1');
    await saveAiChat('test',chat('1',12));
    expect(memory.docs.size).toBe(10);
    expect(JSON.parse(values.get(archiveKey)!).map((c: AiChat) => c.id)).toEqual(['2']);
    await deleteAiChat('test','2');
    expect(JSON.parse(values.get(archiveKey)!)).toEqual([]);
  });
  it('does not delete any cloud chat if local storage is unavailable', async () => {
    storage.setItem.mockImplementation(() => { throw new Error('storage full'); });
    await expect(saveAiChat('test',chat('11',11))).rejects.toThrow('storage full');
    expect(memory.docs.size).toBe(10);
    expect(memory.batches).toBe(0);
  });
  it('isolates the local archive by account', async () => {
    await saveAiChat('test',chat('11',11));
    await saveAiChat('other',chat('1',1));
    expect(JSON.parse(values.get(archiveKey)!)[0].id).toBe('1');
    expect(values.has('ff.ai.archive.v1.other')).toBe(false);
  });
});
