# CLIP STUDIO AI

Ferramenta privada que transforma vídeos longos em cortes verticais (Reels, Shorts, TikTok):
importa o vídeo, transcreve localmente, usa a Claude para sugerir os melhores momentos, passa
pela revisão humana e só então renderiza em 1080×1920 com legendas.

> Este diretório é autocontido e independente do TripRadar AI, que vive no mesmo repositório.

## Como rodar

```bash
cp .env.example .env
```

Preencha `APP_PASSWORD`, `SECRET_KEY` (32+ caracteres) e `ANTHROPIC_API_KEY`. Depois:

```bash
docker compose up --build
```

- Aplicação: http://localhost:3000
- API e documentação Swagger: http://localhost:8000/docs
- Arquivos (vídeos, transcrições, exports, banco SQLite, modelo Whisper): `./data`

Na primeira transcrição o worker baixa o modelo Whisper (precisa de internet nesse momento).

### Sem Docker (desenvolvimento)

```bash
cd backend && pip install -r requirements-dev.txt && alembic upgrade head
```

```bash
uvicorn app.main:app --reload
```

```bash
python -m app.worker
```

```bash
cd frontend && npm install && npm run dev
```

Requer FFmpeg e Redis locais. Testes: `cd backend && pytest`.

## Arquitetura

```
frontend/  Next.js + React + TypeScript + Tailwind (dashboard, projetos, revisão, legendas)
backend/
  app/routers/      API REST (FastAPI + Pydantic)
  app/jobs.py       fila Redis/RQ; estado, progresso, log, tentativas e cancelamento no SQLite
  app/tasks.py      pipeline: áudio -> transcrição -> análise -> (revisão) -> render
  app/transcription.py  Faster-Whisper (local)
  app/editorial.py  AI Editorial Engine (Claude + regras determinísticas)
  app/render.py     FFmpeg: corte, 9:16, legendas ASS, loudnorm, fade, logo
  app/framing.py    enquadramento; ponto de extensão para MediaPipe (fase 2)
  app/subtitles.py  SRT, ASS e presets (Clean, Dinâmico, De Mala y Cuia)
  migrations/       Alembic
```

Estados do vídeo: `pending → transcribing → transcribed → analyzing → awaiting_review → rendering → completed` (ou `failed`).

## Decisões que valem conhecer

- **A IA não escreve o texto do corte.** Ela aponta índices de segmentos da transcrição; o backend
  remonta o texto a partir do que foi realmente dito, ajusta início/fim para fronteira de frase,
  limita a duração e remove sobreposições. Índice inválido é descartado, não "consertado".
- **Privacidade.** Só texto e timestamps da transcrição vão para a API Claude. Vídeo e áudio não saem do servidor.
- **Ninguém é escondido.** O enquadramento padrão (`fit`) mantém o quadro original inteiro sobre
  fundo desfocado. Recorte 9:16 só por escolha explícita, com aviso.
- **Legendas fora dos rostos.** No modo `fit` a legenda fica na faixa abaixo da imagem, o que
  garante que não cobre ninguém. No recorte manual não há detecção de rostos ainda: o sistema avisa.
- **Nada é renderizado sem aprovação** (a API devolve 409).
- **Autenticação.** Senha compartilhada + cookie HttpOnly assinado; todos os endpoints de dados e
  arquivos exigem sessão. Para expor fora de localhost, coloque atrás de HTTPS e use `COOKIE_SECURE=true`.

## Limitações conhecidas do MVP

- Sem identificação de falantes (o Whisper não faz diarização; nada é inventado).
- Enquadramento inteligente (MediaPipe) é fase 2; a interface `FaceDetector` já existe.
- Um único worker: a retomada de jobs interrompidos assume isso.
- A prévia de legenda nas configurações é aproximada (CSS); o resultado fiel é o do render.
