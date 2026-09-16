// Backend mínimo do Coach IA do LIFE OS.
// Única responsabilidade: receber {message, history, context} do front-end
// estático (GitHub Pages) e chamar a API da Anthropic guardando a chave
// aqui no servidor — o front-end nunca vê a ANTHROPIC_API_KEY.
'use strict';

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (!API_KEY) {
  console.warn('[life-os-coach] ANTHROPIC_API_KEY não configurada — /api/coach vai retornar erro 500 até você definir essa variável de ambiente.');
}

const anthropic = API_KEY ? new Anthropic({ apiKey: API_KEY }) : null;

const app = express();
app.use(express.json({ limit: '200kb' }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS.includes('*') ? true : ALLOWED_ORIGINS,
  })
);

app.get('/health', (_req, res) => res.json({ ok: true }));

const SYSTEM_PROMPT = `Você é o Coach do LIFE OS, o painel pessoal de evolução de vida do Léo (Leonardo).
Ele vai te contar o que fez e o que pretende fazer; seu trabalho é ajudar a decidir os próximos passos.

Regras de estilo:
- Seja direto e prático. Sem elogios vazios, sem "ótima pergunta", sem enrolação.
- Respostas curtas: normalmente 2 a 6 frases. Use listas curtas só quando ajudar a decidir.
- Aponte riscos, inconsistências ou prioridades mal colocadas antes de validar o que ele disse.
- Consistência importa mais que perfeição — um dia ruim não é motivo para culpa, mas também não finja que não aconteceu.
- Use o contexto (nível, XP, streaks, metas do dia, carreira, finanças) para dar conselhos concretos, não genéricos.
- Nunca dê diagnóstico médico ou psicológico. Para sono/humor/alimentação, comente comportamento, não saúde clínica.
- Responda sempre em português do Brasil.`;

app.post('/api/coach', async (req, res) => {
  try {
    if (!anthropic) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
    }
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Campo "message" é obrigatório.' });
    }

    const messages = [
      ...(Array.isArray(history) ? history : [])
        .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: `Contexto atual do LIFE OS (JSON): ${JSON.stringify(context || {})}\n\nMensagem do Léo: ${message}`,
      },
    ];

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    res.json({ reply: reply || 'Não consegui gerar uma resposta agora. Tente novamente.' });
  } catch (err) {
    console.error('[life-os-coach] erro em /api/coach:', err);
    res.status(500).json({ error: 'Falha ao consultar o coach. Tente novamente em instantes.' });
  }
});

app.listen(PORT, () => {
  console.log(`[life-os-coach] rodando na porta ${PORT}`);
});
