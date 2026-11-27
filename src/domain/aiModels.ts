export function defaultAiModel(provider: string): string {
  return provider ? 'auto' : '';
}

export function compatibleAiModel(provider: string, model: string): string {
  const name = model.trim();
  if (name === 'auto') return name;
  if (!name || (provider === 'google' && !/^gemini-/i.test(name)) || (provider === 'groq' && (/^gemini-/i.test(name) || name === 'llama-3.3-70b-versatile'))) return defaultAiModel(provider);
  return name;
}
