import { expect, it } from 'vitest';
import { compatibleAiModel, defaultAiModel } from './aiModels';
it('repairs a stale Groq model in Google settings', () => expect(compatibleAiModel('google', 'llama-3.3-70b-versatile')).toBe('gemini-3.8-flash'));
it('repairs retired Groq model', () => expect(compatibleAiModel('groq', 'llama-3.3-70b-versatile')).toBe(defaultAiModel('groq')));
it('preserves an editable compatible model', () => expect(compatibleAiModel('google', 'gemini-3.6-flash')).toBe('gemini-3.6-flash'));
