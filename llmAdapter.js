class LLMAdapter {
  constructor(opts = {}) {
    this.provider = opts.provider || 'ollama';
    this.model = opts.model || (this.provider === 'ollama' ? 'llama3.2:3b' : 'gpt-4o-mini');
    this.endpoint = opts.endpoint || 'http://localhost:11434';
    this.apiKey = opts.apiKey !== undefined ? opts.apiKey : (process.env.OPENAI_API_KEY || '');
    this.timeout = opts.timeout || 30000;
  }

  async ask(prompt, system) {
    try {
      if (this.provider === 'ollama') return await this._ollama(prompt, system);
      if (this.provider === 'openai') return await this._openai(prompt, system);
      return { ok: false, error: 'Bilinmeyen sağlayıcı: ' + this.provider };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _ollama(prompt, system) {
    const body = { model: this.model, prompt, stream: false };
    if (system) body.system = system;
    const res = await fetch(this.endpoint + '/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) return { ok: false, error: 'Ollama ' + res.status + ': ' + res.statusText };
    const json = await res.json();
    return { ok: true, data: { text: json.response, model: json.model, tokens: json.eval_count } };
  }

  async _openai(prompt, system) {
    if (!this.apiKey) return { ok: false, error: 'OPENAI_API_KEY gerekli' };
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.apiKey,
      }, body: JSON.stringify({ model: this.model, messages }),
      signal: AbortSignal.timeout(this.timeout),
    });
    if (!res.ok) return { ok: false, error: 'OpenAI ' + res.status + ': ' + res.statusText };
    const json = await res.json();
    const choice = json.choices && json.choices[0];
    return { ok: true, data: { text: choice.message.content, model: json.model, tokens: json.usage?.total_tokens } };
  }
}

module.exports = LLMAdapter;
