# life-os-coach

Backend mínimo (Node + Express) para o módulo **Coach IA** do LIFE OS
(`docs/life-os/index.html`). Única função: receber a mensagem do usuário e o
contexto do dia, chamar a API da Anthropic com a chave guardada no servidor,
e devolver a resposta. O front-end estático (GitHub Pages) nunca vê a chave.

## Rodar localmente

```bash
cd apps/life-os-coach
cp .env.example .env   # preencha ANTHROPIC_API_KEY
npm install
npm start
```

Servidor sobe em `http://localhost:3000`. Teste com:

```bash
curl -X POST http://localhost:3000/api/coach \
  -H "Content-Type: application/json" \
  -d '{"message":"Hoje corri 30min, o que priorizo agora?","history":[],"context":{}}'
```

## Deploy (Render — Web Service manual, sem Blueprint)

Este backend é intencionalmente separado do `render.yaml` da raiz do repo
(que é para a API principal do TripRadar). Para não colidir com ele, o deploy
aqui é feito criando um serviço manualmente:

1. No dashboard da Render: **New → Web Service**.
2. Conecte este repositório, branch `claude/spain-trip-first-days-m8oke1`
   (ou a branch onde este código estiver).
3. **Root Directory:** `apps/life-os-coach`
4. **Runtime:** Node
5. **Build Command:** `npm install`
6. **Start Command:** `npm start`
7. Em **Environment**, adicione:
   - `ANTHROPIC_API_KEY` — sua chave da Anthropic (console.anthropic.com)
   - `CORS_ORIGIN` — a URL do GitHub Pages onde o LIFE OS está publicado
     (ex: `https://leozao95lc-jpg.github.io`)
8. Deploy. Copie a URL pública gerada (ex: `https://life-os-coach.onrender.com`).
9. No LIFE OS → **Configurações → Coach IA**, cole essa URL em
   "URL do backend do coach" e salve.

No plano gratuito da Render o serviço "dorme" sem uso — a primeira mensagem
do dia pode demorar ~30s para responder enquanto ele acorda. Isso é esperado.

## Endpoints

- `GET /health` — healthcheck.
- `POST /api/coach` — body `{ message: string, history?: {role,content}[], context?: object }`,
  retorna `{ reply: string }`.
