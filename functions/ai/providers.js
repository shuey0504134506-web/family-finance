'use strict';

// Provider transport layer. No credentials are stored here.
// Keep endpoints fixed: arbitrary URLs could expose secrets or enable SSRF.
const endpoints = Object.freeze({
  openai: 'https://api.openai.com/v1/chat/completions',
  xai: 'https://api.x.ai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
});

function buildRequest({ provider = 'google', model, apiKey, system, messages, maxTokens = 4096, thinkingConfig }) {
  if (typeof model !== 'string' || !model.trim() || typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Missing AI model or credentials');
  }
  if (!Array.isArray(messages) || messages.some(m => !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string')) {
    throw new Error('Invalid AI messages');
  }
  const headers = { 'content-type': 'application/json' };
  if (provider === 'google') {
    headers['x-goog-api-key'] = apiKey;
    return {
      url: 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse',
      headers,
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens, ...(thinkingConfig ? { thinkingConfig } : {}) },
      },
    };
  }
  if (!Object.hasOwn(endpoints, provider)) throw new Error('Unsupported AI provider');
  if (provider === 'anthropic') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    return { url: endpoints[provider], headers, body: { model, system, messages, max_tokens: maxTokens, stream: true } };
  }
  headers.authorization = 'Bearer ' + apiKey;
  return { url: endpoints[provider], headers, body: {
    model, messages: [{ role: 'system', content: system }, ...messages],
    ...(provider === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
    stream: true,
  } };
}

module.exports = { buildRequest };
