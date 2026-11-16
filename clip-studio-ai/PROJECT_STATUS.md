# CLIP STUDIO AI — Situação do projeto

Atualizado em 16/11/2026.

## Resumo

As cinco etapas do plano estão implementadas e o sistema roda de ponta a ponta em Docker: upload,
transcrição real, revisão, renderização vertical com legendas e download.

**O que ainda não foi validado: a chamada real à API Claude.** O código da análise editorial foi
testado até a fronteira da rede (com o SDK oficial e um servidor simulado), mas nenhuma requisição
chegou à Anthropic, porque não havia chave no ambiente de desenvolvimento. A qualidade das
sugestões da IA, portanto, é desconhecida. É o primeiro item das próximas tarefas.

## Etapas concluídas

| Etapa | Situação | Como foi validada |
|---|---|---|
| 1. Fundação: estrutura, frontend, backend, banco, Docker, dashboard | Concluída | As duas imagens Docker foram construídas e a pilha completa (Redis, API, worker, web) foi executada |
| 2. Vídeos: upload, armazenamento, player, metadados | Concluída | Testes automatizados e upload de 110 MB pelo navegador |
| 3. Inteligência: transcrição, integração Claude, análise editorial, sugestão de cortes | Transcrição concluída. Análise implementada, **sem validação com a API real** | Transcrição com o modelo real em português, espanhol e inglês. Regras dos cortes testadas sobre transcrição real |
| 4. Edição: editor, ajuste de timestamps, legendas, renderização | Concluída | Render real com FFmpeg em todos os modos, com conferência visual dos quadros |
| 5. Exportação: download, histórico, testes completos | Concluída | Download pelo navegador; acesso sem sessão recusado |

## O que foi executado de verdade e o que não foi

| Funcionalidade | Validação | Tipo |
|---|---|---|
| Upload em streaming, validação de extensão e de conteúdo, limites | Testes automatizados e navegador | Real |
| Metadados (duração, resolução, FPS, áudio, HDR) | FFprobe sobre vídeos gerados | Real |
| Player com avanço e retrocesso | Navegador | Real |
| Extração de áudio | FFmpeg | Real |
| Transcrição e detecção de idioma | Faster-Whisper `small`, `medium` e `large-v3-turbo` | Real, com fala sintetizada (uma voz, áudio limpo) |
| Segmentação em frases | Testes de regressão sobre a saída real do modelo | Real |
| Requisição à API Claude e leitura da resposta | SDK oficial com servidor simulado: formato da requisição, stream de eventos, erros | Parcial |
| Qualidade das sugestões da IA (títulos, ganchos, escolha dos trechos) | Não validada | — |
| Regras dos cortes: fronteira de frase, duração, duplicidade, texto vindo da transcrição | Testes automatizados, inclusive sobre transcrição real | Real |
| Render: quadro completo, recorte, legendas, fade, logo, vídeo sem áudio | FFmpeg, com verificação do arquivo gerado e dos quadros | Real |
| Conversão HDR → SDR | FFmpeg sobre vídeo HDR gerado artificialmente | Real, sem arquivo de câmera |
| Fila, progresso, cancelamento, novas tentativas | Redis e RQ | Real |
| Retomada após queda | Worker encerrado à força no meio de um render, na pilha Docker; ao reiniciar, retomou e concluiu | Real |
| Autenticação, limite de tentativas, bloqueio de acesso sem sessão | Testes automatizados e navegador | Real |
| Enquadramento com detecção de rostos (MediaPipe) | Só a regra de decisão, com rostos simulados | Fase 2 |
| Identificação de falantes | Não implementada | — |

## Testes executados

Suíte automatizada do backend: **43 testes; 42 passam na execução padrão e 1 é opcional** (precisa
baixar o modelo Whisper). Executada em 16/11/2026 em dois ambientes: Python 3.13 com FFmpeg 6.1 e
dentro da imagem Docker (Python 3.12 com FFmpeg 7.1).

| Arquivo | Testes | O que cobre |
|---|---|---|
| `test_api.py` | 5 | Autenticação obrigatória, validação de upload, pipeline completo (upload → transcrição → análise → edição → render → download → exclusão do projeto), falha na análise preservando a transcrição, configurações |
| `test_units.py` | 10 | Regras editoriais (texto vindo da transcrição, fronteiras de frase, duplicados, duração, pontuação), prompt sem dados além do texto, path traversal, SRT e ASS, regra de não esconder participantes |
| `test_segmentation.py` | 10 | Reagrupamento em frases sobre saída real do Whisper em português e espanhol, frases longas, abreviações, reticências, legendas SRT |
| `test_editorial_sdk.py` | 9 | Chamada à API Claude pelo SDK oficial com servidor simulado: formato da requisição, privacidade do conteúdo enviado, leitura do stream, chave inválida, limite de uso, indisponibilidade, recusa, resposta cortada, resposta malformada |
| `test_recovery.py` | 4 | Falha inesperada com nova execução, cancelamento, retomada de trabalhos interrompidos |
| `test_media_variants.py` | 4 | Vídeo HDR, vídeo sem áudio, logo queimado no vídeo (conferido por cor do pixel), limite de tentativas de login e datas em UTC |
| `test_real_transcription.py` | 1 (opcional) | Transcrição real com o modelo Whisper, corte e render com legenda. Passou em 16/11/2026 com o modelo `tiny` |

Nos testes padrão, a transcrição e a resposta da IA são substituídas por dados fixos para que a
suíte rode em menos de um minuto, sem internet e sem chave. O produto nunca usa esses dados.

Validações manuais, feitas em 15 e 16/11/2026:

- **Ponta a ponta pelo navegador, na pilha Docker**: login, criação de projeto, upload de 110 MB,
  transcrição com `large-v3-turbo` dentro do container, 14 frases exibidas, corte manual,
  aprovação, render em 16,5 s, aviso de exportação concluída, download de 4,8 MB, histórico no
  dashboard. Nenhum erro no console do navegador.
- **Transcrição em português e espanhol** (cerca de 1 minuto por idioma): idioma detectado com
  99,9% de confiança nos dois casos. Comparativo de modelos no README, seção 5.
- **Queda do worker** no meio de um render de 55 s: trabalho retomado na segunda tentativa.
- **Comandos do README** de geração do vídeo de teste e de cópia de segurança, executados na pilha.

O build Docker neste ambiente foi feito imagem por imagem e precisou de um ajuste de proxy e
certificados que existe só aqui. Os Dockerfiles do repositório não contêm esse ajuste; o comando
`docker compose up --build`, como está no README, ainda não rodou em uma máquina comum.

## Funcionalidades pendentes

| Item | Situação |
|---|---|
| Enquadramento inteligente com detecção de rostos (MediaPipe) | Fase 2. A interface e a regra de decisão já existem em `backend/app/framing.py` |
| Organização da transcrição por falante | Não implementada. O Whisper não identifica falantes, e nada é inferido |
| Garantia de legenda fora dos rostos em recorte manual | Depende da detecção de rostos. Hoje o sistema avisa |
| Renderização em lote (todos os cortes aprovados de uma vez) | Não implementada; cada corte é renderizado individualmente |
| Aceleração por GPU na transcrição | Não suportada na imagem Docker atual |
| Integração contínua (CI) | Não configurada |

## Problemas e limitações conhecidos

1. **Chamada real à API Claude nunca executada.** Risco: algum detalhe do formato ser recusado pela
   API. Se acontecer, a mensagem de erro do trabalho traz o motivo devolvido pela Anthropic.
2. **Transcrição testada só com fala sintetizada.** Fala real, com ruído, música ou pessoas falando
   ao mesmo tempo, erra mais. Os percentuais do comparativo não se aplicam diretamente.
3. **HDR testado só com vídeo artificial.** A conversão pode deixar a imagem um pouco mais escura
   que o original. Falta testar com um arquivo real de iPhone.
4. **Recorte 9:16 manual não detecta rostos.** Pode deixar alguém de fora e a legenda pode cobrir
   um rosto. O sistema avisa nos dois casos; o padrão (quadro completo) não tem esse risco.
5. **Vídeo de origem já vertical:** não sobra faixa livre para a legenda, que vai para a zona
   inferior, sobre a imagem, com aviso.
6. **A prévia de legenda em "Canal e legendas" é aproximada.** O resultado fiel é o do render.
7. **Um único worker.** Os trabalhos são processados um por vez; a retomada após queda assume isso.
8. **Memória na transcrição:** além do modelo (cerca de 2 GB), o áudio ocupa perto de 0,5 GB por
   hora de vídeo.
9. **Sair não invalida a sessão no servidor**, só apaga o cookie. Para encerrar todas as sessões,
   troque a `SECRET_KEY`.
10. **O limite de tentativas de login fica em memória** e zera quando a API reinicia.
11. **A documentação da API (`/docs`) abre sem login.** Mostra apenas a lista de endpoints, sem dados.
12. **O código está no repositório do TripRadar AI**, em uma pasta isolada. Recomenda-se mover para
    um repositório próprio.

## Próximas tarefas

Por ordem de prioridade:

1. **Validar a análise com a chave real.** Preencher `ANTHROPIC_API_KEY`, processar o vídeo de teste
   e depois um episódio real. Conferir no log do trabalho o consumo de tokens e comparar com a
   estimativa de custo em `docs/ARQUITETURA.md`.
2. **Rodar um episódio real do canal do início ao fim** e registrar os indicadores abaixo.
3. **Calibrar o prompt editorial** com base nos cortes que você aprovou e rejeitou.
4. **Testar um vídeo HDR real** (iPhone) e ajustar a conversão de cores se necessário.
5. **Mover para repositório próprio** e configurar CI rodando a suíte a cada alteração.
6. **Fase 2: detecção de rostos** (MediaPipe) para o recorte inteligente e para o posicionamento da legenda.
7. Renderização em lote dos cortes aprovados.
8. Identificação de falantes, se o formato dos episódios justificar.

## Indicadores para acompanhar

Os dados para calcular estes números já ficam gravados (situação de cada corte, horários dos
trabalhos e consumo de tokens no log):

| Indicador | Para que serve |
|---|---|
| Taxa de aprovação: cortes aprovados ÷ cortes sugeridos | Mede a qualidade editorial da IA. É o número que decide se o prompt precisa de ajuste |
| Cortes aprovados sem ajuste de tempo | Mede a precisão das fronteiras dos cortes |
| Tempo de processamento por hora de vídeo | Dimensiona a máquina e a escolha do modelo de transcrição |
| Custo de IA por corte aprovado | Custo real da análise, já descontadas as sugestões rejeitadas |
| Tempo de revisão por episódio | O ganho operacional de verdade: quanto tempo humano o sistema economiza |
