export function defaultAiModel(provider: string): string {
  return provider === 'google' ? 'gemini-3.8-flash' : provider === 'groq' ? 'openai/gpt-oss-120b' : '';
}

export function compatibleAiModel(provider: string, model: string): string {
  const name = model.trim();
  if (!name || (provider === 'google' && !/^gemini-/i.test(name)) || (provider === 'groq' && (/^gemini-/i.test(name) || name === 'llama-3.3-70b-versatile'))) return defaultAiModel(provider);
  return name;
}
