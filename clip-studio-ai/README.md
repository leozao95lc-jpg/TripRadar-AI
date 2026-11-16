# CLIP STUDIO AI

Ferramenta privada que transforma vídeos longos em cortes verticais para Instagram Reels,
YouTube Shorts e TikTok.

O fluxo é: importar o vídeo → transcrever (no próprio computador) → a IA sugere os melhores
momentos → você revisa, ajusta e aprova → o sistema renderiza em 1080×1920 com legendas → você baixa.

Nada é renderizado sem a sua aprovação, e o vídeo nunca sai do seu servidor: só o texto da
transcrição é enviado à API Claude.

- Situação do projeto, o que já foi testado e o que falta: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Arquitetura, decisões técnicas e custos: [docs/ARQUITETURA.md](docs/ARQUITETURA.md)

> Este diretório é autocontido e independente do TripRadar AI, que vive no mesmo repositório.

---

## 1. Requisitos

| Item | Mínimo | Observação |
|---|---|---|
| Docker + Docker Compose | Docker Desktop recente ou Docker Engine 24+ | É a forma recomendada de rodar |
| Memória RAM | 8 GB | O modelo de transcrição padrão usa cerca de 2 GB durante o processamento |
| Disco | 20 GB livres | Vídeos longos ocupam vários GB cada; as imagens Docker somam ~2 GB e o modelo de transcrição, 1,6 GB |
| Processador | 4 núcleos | A transcrição roda em CPU; mais núcleos = mais rápido |
| Internet | Na instalação e na 1ª transcrição | Para baixar as imagens e o modelo Whisper |
| Chave da API Anthropic | Para a análise com IA | Sem ela o resto funciona: transcrição, cortes manuais, render |

Para rodar sem Docker: Python 3.12+, Node.js 22+, FFmpeg 6+ (com `libass`) e Redis 7+.

## 2. Instalação

Na pasta `clip-studio-ai`:

```bash
cp .env.example .env
```

Abra o arquivo `.env` e preencha pelo menos:

- `APP_PASSWORD`: a senha de acesso à ferramenta.
- `SECRET_KEY`: uma sequência aleatória de 32 ou mais caracteres. Para gerar uma:

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

- `ANTHROPIC_API_KEY`: a chave criada em https://console.anthropic.com (pode ficar para depois).

## 3. Execução

```bash
docker compose up --build -d
```

Na primeira vez o build leva alguns minutos. Depois:

- Aplicação: http://localhost:3000
- Documentação da API (Swagger): http://localhost:8000/docs

Para acompanhar o que está acontecendo:

```bash
docker compose logs -f worker
```

Para parar:

```bash
docker compose down
```

## 4. Como usar

1. **Entre** com a senha definida em `APP_PASSWORD`.
2. **Crie um projeto** (botão "Novo projeto") e **importe um vídeo** MP4, MOV ou M4V.
3. Na página do vídeo, clique em **Transcrever e analisar**. A barra de etapas no topo mostra em
   que ponto o processamento está, com o tempo decorrido.
4. **Revise os cortes sugeridos**: assista ao trecho, ajuste início e fim, edite título, gancho e
   CTA. A IA explica por que escolheu cada trecho. Aprove ou rejeite.
5. Em um corte aprovado, escolha destino (Reels, Shorts, TikTok), enquadramento e legenda, e
   clique em **Renderizar vídeo vertical**.
6. Ao terminar, aparece o aviso de exportação concluída com o botão **Baixar vídeo**. O histórico
   de exportações fica no Dashboard.

Em **Canal e legendas** você define a identidade do canal (nome, descrição, cores, logo) e cria
estilos de legenda próprios a partir dos três presets (Clean, Dinâmico, De Mala y Cuia).

Sem a chave da Anthropic você ainda pode usar **+ Corte manual** e renderizar normalmente.

## 5. Configuração (variáveis de ambiente)

Todas ficam no arquivo `.env`. Segredos nunca são gravados no código nem no banco.

| Variável | Padrão | Para que serve |
|---|---|---|
| `APP_PASSWORD` | — (obrigatória) | Senha de acesso |
| `SECRET_KEY` | — (obrigatória, 32+ caracteres) | Assina a sessão de login |
| `SESSION_HOURS` | `168` | Duração do login, em horas |
| `LOGIN_MAX_FAILURES` | `8` | Tentativas de senha erradas por IP a cada 10 minutos |
| `CORS_ORIGINS` | `http://localhost:3000` | Endereço(s) do frontend autorizados a chamar a API |
| `PUBLIC_API_URL` | `http://localhost:8000` | Endereço da API visto pelo navegador (usado no build do frontend) |
| `COOKIE_SECURE` | `false` | Use `true` quando servir por HTTPS |
| `ANTHROPIC_API_KEY` | vazio | Chave da API Claude (análise editorial) |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Modelo usado na análise |
| `ANTHROPIC_EFFORT` | `high` | Profundidade do raciocínio: `low`, `medium`, `high`, `xhigh`, `max` |
| `WHISPER_MODEL` | `large-v3-turbo` | Modelo de transcrição (ver tabela abaixo). Aceita também o caminho de uma pasta |
| `WHISPER_DEVICE` | `auto` | `cpu`, `cuda` ou `auto` |
| `WHISPER_COMPUTE_TYPE` | `int8` | `int8` em CPU; `float16` em GPU |
| `MAX_UPLOAD_MB` | `8192` | Tamanho máximo de upload |
| `MIN_FREE_DISK_MB` | `2048` | Folga de disco exigida para aceitar uploads e renders |
| `RENDER_CRF` | `18` | Qualidade do vídeo (menor = melhor e maior; 18 é visualmente sem perdas) |
| `RENDER_PRESET` | `medium` | Velocidade do encoder x264 (`veryfast` … `slow`) |
| `JOB_MAX_ATTEMPTS` | `2` | Tentativas automáticas em caso de erro inesperado |

Variáveis que o `docker-compose.yml` já define e normalmente não precisam ser mexidas:
`STORAGE_DIR`, `DATABASE_URL`, `REDIS_URL`.

### Qual modelo de transcrição usar

Medição feita com o código do projeto em uma máquina de 4 vCPUs, sem GPU, sobre cerca de um
minuto de fala sintetizada em cada idioma (áudio limpo, uma voz). O erro é a taxa de palavras
erradas em relação ao texto original.

| `WHISPER_MODEL` | Download | Erro em português | Erro em espanhol | Pontuação das frases | Tempo para 1 h de vídeo | Memória |
|---|---|---|---|---|---|---|
| `small` | 0,5 GB | 7,0% | 4,4% | Falhou em espanhol (trocou pontos por vírgulas) | 17 a 25 min | 0,9 GB |
| `medium` | 1,5 GB | 4,0% | 0,5% | Boa | 38 a 60 min | 2,5 GB |
| `large-v3-turbo` (padrão) | 1,6 GB | 2,5% | 1,1% | Boa | 22 a 32 min | 2,1 GB |

O padrão é `large-v3-turbo`: errou menos em português, pontuou corretamente nos dois idiomas e
custa cerca de 30% mais tempo que o `small`. A pontuação importa mais do que parece, porque os
cortes são definidos por frase: onde o modelo erra o ponto final, o corte perde precisão.

Limite desta medição: fala real, com ruído, música ou duas pessoas falando ao mesmo tempo, erra
mais do que fala sintetizada. A ordem entre os modelos deve se manter, os percentuais não. Vale
repetir a comparação com um episódio real do canal.

## 6. Comandos úteis

Ver o estado dos serviços:

```bash
docker compose ps
```

Reiniciar só o processamento (os trabalhos interrompidos são retomados sozinhos):

```bash
docker compose restart worker
```

Atualizar depois de baixar uma versão nova do código:

```bash
docker compose up --build -d
```

Cópia de segurança do banco de dados. O arquivo é gravado em `storage/clipstudio-backup.db`; os
vídeos e exportações já ficam na pasta `storage/`, então copiar essa pasta depois do comando
guarda tudo:

```bash
docker compose exec api python -c "import sqlite3; o=sqlite3.connect('/db/clipstudio.db'); d=sqlite3.connect('/storage/clipstudio-backup.db'); o.backup(d); d.close()"
```

Rodar os testes automatizados:

```bash
docker compose run --rm --no-deps -v ./backend/tests:/app/tests api sh -c "pip install -q pytest==9.2.0 httpx==0.28.1 && pytest -q"
```

Os testes usam um banco e uma pasta temporários; não tocam nos seus projetos.

Gerar um vídeo de teste curto (30 s, com fala sintetizada) para validar o pipeline:

```bash
docker compose run --rm --no-deps -v ./backend/tests:/app/tests api python -m tests.make_test_video /storage/video_teste.mp4
```

O arquivo aparece em `storage/video_teste.mp4`; importe-o pela interface. A fala é em inglês
(é o que o sintetizador embutido no FFmpeg oferece), suficiente para conferir o fluxo.

## 7. Rodando sem Docker (desenvolvimento)

Instalar e criar o banco, a partir da pasta `clip-studio-ai` (o `.env` da seção 2 também vale aqui):

```bash
cd backend && pip install -r requirements-dev.txt && alembic upgrade head
```

API (dentro de `backend/`):

```bash
uvicorn app.main:app --reload
```

Worker, em outro terminal, também dentro de `backend/` (precisa de um Redis em `localhost:6379`):

```bash
python -m app.worker
```

Frontend, em outro terminal, a partir da pasta `clip-studio-ai`:

```bash
cd frontend && npm install && npm run dev
```

Testes (não precisam de Redis, de internet nem da chave da Anthropic):

```bash
cd backend && pytest
```

Teste opcional com transcrição real (baixa o modelo Whisper `tiny`):

```bash
cd backend && CLIPSTUDIO_REAL_WHISPER=1 WHISPER_MODEL=tiny pytest tests/test_real_transcription.py
```

## 8. Estrutura de pastas

```
clip-studio-ai/
├── frontend/            Next.js + React + TypeScript + Tailwind
├── backend/             FastAPI + SQLAlchemy + RQ + FFmpeg + Faster-Whisper
│   ├── app/             código da API, do worker e dos serviços
│   ├── migrations/      migrações do banco (Alembic)
│   ├── fonts/           fontes das legendas (licença OFL)
│   └── tests/           testes automatizados e gerador do vídeo de teste
├── storage/             arquivos, separados por tipo e por projeto
│   ├── originals/       vídeos enviados
│   ├── audio/           áudio extraído para a transcrição
│   ├── transcripts/     transcrições em JSON e SRT
│   ├── clips/           legendas de cada corte (.ass e .srt)
│   ├── exports/         vídeos verticais prontos
│   └── temp/            arquivos temporários (limpos automaticamente)
├── docs/                arquitetura e decisões
├── docker-compose.yml
├── .env.example
├── README.md
└── PROJECT_STATUS.md
```

Dentro de cada pasta de `storage/` há uma subpasta por projeto. Durante o uso aparecem também
`storage/previews/` (versão leve do vídeo para o player), `storage/brand/` (logo) e
`storage/models/` (modelo Whisper baixado).

## 9. Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| A API não sobe: "Defina APP_PASSWORD e SECRET_KEY" | `.env` ausente ou incompleto | Preencha as duas variáveis; `SECRET_KEY` precisa de 32+ caracteres |
| "Muitas tentativas de acesso" no login | Senha errada várias vezes | Aguarde 10 minutos ou reinicie a API: `docker compose restart api` |
| "Não foi possível conectar ao servidor" na tela | A API não está rodando ou `PUBLIC_API_URL` está errada | `docker compose ps` e `docker compose logs api` |
| Upload recusado: "Formato não aceito" ou "conteúdo não corresponde" | Extensão ou arquivo fora de MP4/MOV/M4V | Converta o arquivo; arquivos renomeados são detectados |
| "Espaço em disco insuficiente" | Disco perto do limite | Libere espaço ou reduza `MIN_FREE_DISK_MB` |
| Transcrição falha: "Não foi possível carregar o modelo Whisper" | Sem internet na primeira execução, ou rede que bloqueia o Hugging Face | Conecte-se e tente de novo. Em rede corporativa, acrescente `HF_HUB_DISABLE_XET=1` ao `.env`; em último caso baixe o modelo manualmente e aponte `WHISPER_MODEL` para a pasta |
| Transcrição muito lenta | Modelo grande para a máquina | Use um modelo menor em `WHISPER_MODEL` |
| Nomes próprios ou pontuação errados na transcrição | Modelo pequeno | Use um modelo maior (tabela da seção 5) |
| Análise falha: "ANTHROPIC_API_KEY não configurada" ou "Chave inválida" | Chave ausente ou incorreta | Corrija no `.env` e rode `docker compose up -d`. A transcrição já feita é mantida |
| O player não toca o vídeo | MOV/HEVC que o navegador não reproduz | Rode "Transcrever e analisar": o sistema gera uma versão de visualização |
| Trabalho parado em "Em execução" | O worker caiu no meio | `docker compose restart worker`: ele retoma ou encerra o trabalho |
| "Já existe um processamento em andamento" | Só um processamento por vídeo e um render por corte | Aguarde ou cancele o trabalho atual |
| Erro `429 Too Many Requests` no `docker compose up --build` | Limite de downloads anônimos do Docker Hub | Aguarde alguns minutos e repita, ou faça `docker login` |
| Quero acessar de outro computador da rede | Por segurança as portas só abrem em `localhost` | Ajuste `PUBLIC_API_URL`, `CORS_ORIGINS` e as portas no `docker-compose.yml`. Fora da rede local, use HTTPS e `COOKIE_SECURE=true` |
| Lentidão geral no Windows | Projeto em pasta do Windows acessada pelo Docker/WSL2 | Coloque a pasta do projeto dentro do sistema de arquivos do WSL2 |
| Arquivos de `storage/` pertencem ao root (Linux) | Os containers rodam como root | `sudo chown -R $USER storage` |

Se o erro não estiver na tabela, abra o trabalho na tela (botão **Log**): o detalhe técnico fica
registrado ali, e a mensagem principal diz o que aconteceu em linguagem simples.
