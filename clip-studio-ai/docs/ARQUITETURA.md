# CLIP STUDIO AI — Arquitetura

Documento de referência técnica: auditoria do ambiente, arquitetura, estrutura, dependências,
decisões e custos externos. Para instalar e usar, veja o [README](../README.md); para a situação
atual do projeto, [PROJECT_STATUS.md](../PROJECT_STATUS.md).

## 1. Auditoria do ambiente de desenvolvimento

Ambiente em que o projeto foi construído e testado (container Linux, 4 vCPUs, 15 GB de RAM, sem GPU):

| Ferramenta | Versão encontrada | Situação |
|---|---|---|
| Python | 3.13.18 | OK. A imagem Docker usa 3.12 (base `python:3.12-slim`) |
| Node.js / npm | 22.23.4 / 10.9.9 | OK |
| Docker | 29.9.2 | OK. As duas imagens foram construídas e a pilha completa foi executada |
| FFmpeg / FFprobe | 6.1.1 (local) e 7.1.5 (imagem Docker) | OK. Com `libass`, `loudnorm`, `zscale`, `tonemap` e `flite` |
| Redis | 7.0.15 | OK |

### Incompatibilidades e obstáculos encontrados

| # | Problema | Como apareceu | Solução adotada |
|---|---|---|---|
| 1 | `faster-whisper` 1.2.1 quebra com PyAV 19 (`open() got an unexpected keyword argument 'metadata_errors'`) | Só no teste com transcrição real; os testes simulados passavam | O sistema já extrai o áudio em WAV 16 kHz com FFmpeg, então passa a ler esse WAV diretamente e entrega as amostras ao modelo. O decodificador PyAV deixa de ser usado |
| 2 | Os segmentos do Whisper não são frases: são blocos de ~5 s que começam e terminam no meio de uma frase | Transcrição real em português: 11 de 12 blocos terminavam no meio da frase | Ressegmentação por frases usando os timestamps por palavra (seção 5) |
| 3 | Em espanhol, o modelo `small` trocou pontos por vírgulas (uma "frase" de 20 s) | Transcrição real em espanhol | Frases acima de 15 s são divididas na pausa mais forte, de preferência depois de vírgula |
| 4 | TypeScript 7 (compilador novo) é a versão mais recente, sem garantia de compatibilidade com o Next.js 16 | Verificação de versões antes de instalar | Fixado em TypeScript 5.9 |
| 5 | SQLite devolve datas sem fuso; o navegador as interpretaria como horário local (3 h de erro no Brasil) | Revisão do código | A API serializa todas as datas em UTC explícito; o tempo decorrido é calculado no servidor |
| 6 | Vídeos HDR (iPhone, câmeras) convertidos para H.264 8 bits saem com cores lavadas | Revisão + teste com vídeo HDR sintético | Detecção de HLG/PQ e conversão automática para SDR (tone mapping) na prévia e no render |
| 7 | Travas de arquivo do SQLite não são confiáveis em pastas compartilhadas do Docker Desktop (Windows/macOS) | Análise de risco | No Docker o banco fica em volume nomeado; os vídeos continuam na pasta `storage/` |
| 8 | Em redes restritas o download do modelo Whisper falha no protocolo Xet do Hugging Face | Download real do modelo | `HF_HUB_DISABLE_XET=1` usa o download HTTP comum |
| 9 | Docker Hub devolve `429 Too Many Requests` para downloads anônimos em IP compartilhado | Build das imagens | Repetir após alguns minutos ou `docker login` |

Os itens 1, 2 e 3 só apareceram quando o pipeline rodou com o modelo real. É o motivo de o
projeto ter um teste opcional de transcrição real e uma amostra de saída real do Whisper nos
testes de regressão.

## 2. Visão geral

```
 Navegador
    │
    │ interface (HTML/JS)                 http://localhost:3000
    ▼
 ┌────────────────────┐
 │ web   (Next.js)    │
 └────────────────────┘
    │
    │ chamadas REST + cookie de sessão    http://localhost:8000
    │ upload em streaming · player com Range
    ▼
 ┌────────────────────┐   lê/grava   ┌─────────────────────────────┐
 │ api   (FastAPI)    │─────────────▶│ SQLite  (projetos, vídeos,  │
 └────────────────────┘              │ transcrições, cortes, jobs) │
    │ enfileira                      └─────────────────────────────┘
    ▼                                             ▲
 ┌────────────────────┐                           │ progresso, log, resultados
 │ redis (fila RQ)    │                           │
 └────────────────────┘                           │
    │ entrega o trabalho                          │
    ▼                                             │
 ┌────────────────────┐───────────────────────────┘
 │ worker (RQ)        │──▶ FFprobe / FFmpeg     (áudio, prévia, render)
 │                    │──▶ Faster-Whisper       (transcrição local)
 │                    │──▶ API Claude           (recebe só o texto da transcrição)
 └────────────────────┘
          │
          ▼
   storage/  (arquivos por tipo e por projeto)
```

- **web** e **api** são independentes: o frontend só conversa com o backend pela API REST.
- A **api** nunca faz trabalho pesado: valida, grava e enfileira. Tudo que demora roda no **worker**.
- O registro `Job` no banco é a fonte de verdade do andamento. A interface consulta esse registro
  a cada 1,5 s enquanto houver algo em execução.

## 3. Pipeline e estados

```
UPLOAD → ARMAZENAMENTO → EXTRAÇÃO DE ÁUDIO → TRANSCRIÇÃO → ANÁLISE EDITORIAL → REVISÃO → RENDERIZAÇÃO → EXPORTAÇÃO
```

Estados do vídeo: `pending` → `transcribing` → `transcribed` → `analyzing` → `awaiting_review` →
`rendering` → `completed`, ou `failed`. O estado `uploading` do enunciado existe só no navegador
(o registro do vídeo é criado quando o upload termina e o arquivo é validado). `transcribed` foi
acrescentado para o vídeo já transcrito que ainda não passou pela análise.

Tipos de trabalho (`jobs.job_type`): `process` (transcrição + análise), `transcribe`, `analyze`, `render`.

Comportamento da fila:

| Requisito | Como é atendido |
|---|---|
| Identificação única | O ID do job no banco é o mesmo ID no Redis/RQ |
| Logs | Cada job guarda o log das etapas; erros inesperados guardam o stack trace no log, e o usuário vê uma mensagem simples |
| Tentativas controladas | Erros de negócio (arquivo inválido, chave ausente) falham na hora, com mensagem clara. Erros inesperados são repetidos até `JOB_MAX_ATTEMPTS` |
| Cancelamento | Job na fila é removido; job em execução é interrompido no próximo ponto de checagem (o FFmpeg é encerrado em menos de 1 s) |
| Recuperação | Ao subir, o worker reenfileira ou encerra os jobs que ficaram órfãos |
| Limpeza de temporários | Cada job trabalha em `storage/temp/job_<id>`, apagada ao final (sucesso, erro ou cancelamento). Uploads parciais (`.part`) antigos são removidos na subida da API |

## 4. Estrutura de pastas

```
clip-studio-ai/
├── frontend/src/
│   ├── app/                    páginas: login, dashboard, projetos, vídeo, configurações
│   ├── components/             Shell, editor de cortes, acompanhamento de jobs, componentes de UI
│   └── lib/api.ts              cliente da API, tipos e formatadores
├── backend/app/
│   ├── main.py                 aplicação FastAPI
│   ├── config.py               configuração por variáveis de ambiente
│   ├── security.py             login, sessão assinada, limite de tentativas
│   ├── models.py / schemas.py  tabelas (SQLAlchemy) e contratos da API (Pydantic)
│   ├── routers/core.py         autenticação, dashboard, projetos, jobs, exportações, configurações
│   ├── routers/media.py        upload, vídeos, transcrição, análise, cortes, render
│   ├── storage.py              caminhos, proteção contra path traversal, espaço em disco, limpeza
│   ├── media.py                FFprobe/FFmpeg, progresso, cancelamento, HDR
│   ├── transcription.py        Faster-Whisper e segmentação em frases
│   ├── editorial.py            AI Editorial Engine
│   ├── subtitles.py            SRT, ASS e presets de legenda
│   ├── framing.py              enquadramento vertical e interface para detecção de rostos
│   ├── render.py               montagem do comando de render e presets de destino
│   ├── jobs.py / tasks.py      fila e execução dos trabalhos
│   └── worker.py               entrada do worker
├── storage/<área>/<id do projeto>/    originals, audio, transcripts, clips, exports, previews
└── storage/temp/                      trabalho em andamento
```

## 5. Decisões técnicas

### 5.1 A IA aponta trechos; o backend monta o corte

A Claude recebe a transcrição numerada por frase e devolve, para cada corte, o índice da primeira
e da última frase, além de título, gancho, justificativa, CTA, pontuação e categoria. O backend
valida a resposta com Pydantic e aplica regras determinísticas:

| Requisito do produto | Garantia |
|---|---|
| Não inventar falas | O texto do corte é remontado a partir da transcrição; o que a IA escrever como "transcrição" é ignorado |
| Não começar no meio de uma frase / não terminar com frase incompleta | As unidades são frases. Se uma unidade não termina em pontuação final, o corte é estendido até a fronteira real; se não couber, o corte recebe um aviso visível na revisão |
| Timestamps dentro do vídeo | Calculados a partir das palavras, limitados à duração; a edição manual é validada na API |
| Evitar duplicados | Cortes com sobreposição acima de 30% são descartados, ficando o de maior pontuação |
| Respeitar decisões anteriores | Trechos aprovados, renderizados ou rejeitados não voltam em uma nova análise |
| Duração | Acima do máximo, o corte é encurtado até a última frase que cabe; fora da faixa preferencial, recebe aviso |
| Índice inexistente | O corte é descartado, nunca "consertado" por aproximação |

O que **não** tem garantia determinística e depende do julgamento da IA (e da sua revisão):
autonomia do trecho, preservação do sentido original e qualidade do título e do gancho.

A pontuação de 0 a 100 é uma avaliação editorial relativa. A interface diz isso explicitamente:
não é previsão de visualizações.

### 5.2 Segmentação em frases

O Whisper devolve blocos de ~5 s. Com os timestamps por palavra, o sistema reagrupa as palavras em
frases (pontuação final, com tratamento de abreviações e reticências), separa em silêncios acima
de 2 s e divide frases com mais de 15 s na pausa mais forte. Essas frases são a unidade usada na
tela de transcrição, no prompt da IA e na definição dos cortes.

### 5.3 Enquadramento: ninguém é escondido

O padrão é `fit`: o quadro original inteiro, reduzido, sobre uma cópia dele mesmo ampliada e
desfocada. Todos os participantes continuam visíveis por construção. O recorte 9:16 (`crop`) só
acontece por escolha explícita, com foco horizontal definido pelo usuário e um aviso.

Fase 2 (MediaPipe): `framing.py` já define `FaceDetector`, `FaceBox` e `plan_framing`. A regra
está implementada e testada com caixas de rosto simuladas: se a união dos rostos não couber em
9:16, o plano devolve `fit` com aviso, em vez de cortar alguém. Falta apenas o detector real.

### 5.4 Legendas fora dos rostos

No modo `fit`, a posição "automática" coloca a legenda na faixa abaixo da imagem, dentro da zona
segura das redes — por isso não cobre ninguém. Em recorte manual ou posição manual não há detecção
de rostos: o sistema registra um aviso em vez de prometer o que não verifica.

As legendas são geradas em ASS e queimadas pelo `libass`, com destaque da palavra falada (a partir
dos timestamps por palavra) e as fontes embarcadas em `backend/fonts/`.

### 5.5 Upload e arquivos

- O navegador envia o arquivo bruto no corpo da requisição (sem `multipart`), lendo do disco em
  blocos. O backend grava em blocos de 4 MB fora do event loop. Nenhum dos dois carrega o vídeo em memória.
- Validação em três camadas: extensão, assinatura do arquivo (átomos MP4/QuickTime) e `ffprobe`
  (precisa ter faixa de vídeo e duração).
- O arquivo é salvo com um ID gerado, nunca com o nome enviado; o nome original é só rótulo.
- Todo acesso a disco passa por `storage.resolve`, que recusa qualquer caminho fora de `storage/`.
- O player usa um endpoint autenticado com suporte a `Range`. Não existe URL pública para os originais.

### 5.6 Autenticação

Ferramenta privada, sem cadastro de usuários: uma senha compartilhada (`APP_PASSWORD`) gera um
token assinado com HMAC, entregue em cookie `HttpOnly` e `SameSite=Lax`. Todos os endpoints de
dados e de arquivos exigem sessão; ficam abertos apenas login, logout, verificação de saúde e a
documentação da API. Há limite de tentativas de senha por IP.

Limite conhecido: sair apenas apaga o cookie; o token continua válido até expirar. Para invalidar
todas as sessões, troque a `SECRET_KEY`.

### 5.7 Privacidade

- Áudio e vídeo nunca saem do servidor. A transcrição é feita localmente.
- Para a API Claude vai somente o texto da transcrição com os timestamps, a configuração da
  análise e a descrição do canal. O log de cada análise registra isso.
- Não há download de vídeos por URL (YouTube ou outros): só upload de arquivos.

## 6. Modelo de dados

| Tabela | Campos principais | Relação |
|---|---|---|
| `projects` | id, name, description, created_at | 1 projeto → N vídeos, N jobs |
| `videos` | id, project_id, filename, file_path, proxy_path, size_bytes, duration, resolution, fps, has_audio, hdr_transfer, status, created_at | 1 vídeo → 1 transcrição, N cortes |
| `transcripts` | id, video_id (único), language, transcript_json, created_at | |
| `clips` | id, video_id, title, hook, start_time, end_time, duration, transcript, rationale, cta, editorial_score, category, warnings, status, render_options, created_at | 1 corte → N exportações |
| `exports` | id, clip_id, file_path, format, resolution, size_bytes, created_at | |
| `jobs` | id, project_id, video_id, clip_id, job_type, status, progress, stage, params, attempts, cancel_requested, error_message, log, created_at, updated_at | |
| `settings` | key, value (JSON) | identidade do canal e presets de legenda |

Todas as chaves estrangeiras usam `ON DELETE CASCADE`, com `PRAGMA foreign_keys=ON`. As migrações
ficam em `backend/migrations` (Alembic) e os testes rodam sobre elas.

## 7. Dependências e por que cada uma existe

**Backend**

| Pacote | Função |
|---|---|
| fastapi, uvicorn | API REST e servidor |
| pydantic, pydantic-settings | Validação dos contratos da API, da resposta da IA e da configuração |
| sqlalchemy, alembic | Banco de dados e migrações |
| rq, redis | Fila de trabalhos |
| faster-whisper | Transcrição local (traz ctranslate2, onnxruntime e numpy) |
| anthropic | SDK oficial da API Claude |
| pytest, httpx | Testes (apenas desenvolvimento) |

**Frontend**: next, react, react-dom, tailwindcss, typescript. Sem biblioteca de componentes, de
estado ou de requisições: os componentes são próprios e a comunicação usa `fetch`.

**Sistema**: FFmpeg (com `libass`) e Redis. No Docker já vêm nas imagens.

## 8. Custos externos potenciais

| Item | Custo | Observação |
|---|---|---|
| API Claude (análise editorial) | Estimativa: US$ 0,20 a 0,50 por hora de vídeo analisada | Único custo variável. Ver cálculo abaixo |
| Transcrição (Whisper) | Nenhum | Roda no seu computador; o custo é tempo de processamento |
| Servidor | Nenhum, se rodar no seu computador | Em nuvem, uma máquina de 4 vCPUs e 8 GB custa na faixa de US$ 20 a 40 por mês |
| Armazenamento | Disco local | 1 h de vídeo 1080p ocupa de 2 a 6 GB; cada corte exportado, de 10 a 20 MB por minuto |
| Docker Desktop | Gratuito para uso pessoal e pequenas empresas | Licença paga só para empresas maiores |
| FFmpeg, fontes, bibliotecas | Nenhum | Software livre; fontes sob licença OFL |

**Cálculo da API Claude** (estimativa, não medição: a chamada real ainda não foi executada).
Uma hora de fala tem cerca de 9 mil palavras. Com a numeração e os timestamps, o envio fica na
faixa de 25 a 35 mil tokens; a resposta, com o raciocínio, de 5 a 10 mil tokens. Com o modelo
padrão `claude-opus-5-5` (US$ 4 por milhão de tokens de entrada e US$ 20 de saída, na tabela
consultada em novembro de 2026), isso dá de US$ 0,20 a 0,50 por análise. Cada "Nova análise" é
uma nova cobrança. Oito episódios de uma hora por mês ficariam em torno de US$ 2 a 4.

Alavancas de custo, todas no `.env`: `ANTHROPIC_MODEL` (modelos menores custam uma fração) e
`ANTHROPIC_EFFORT`. O valor real aparece no console da Anthropic; vale conferir a primeira fatura
contra esta estimativa.
