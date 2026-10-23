# Espanha Organizada — guia de lançamento (v1.0.0)

Planejador pessoal para brasileiros que vão estudar na Espanha. É um arquivo HTML único (`index.html`), sem servidor, sem cadastro e sem dependências externas.

- **URL publicada:** `https://leozao95lc-jpg.github.io/TripRadar-AI/espanha-organizada/`
- **Painel pessoal original:** `docs/viagens/painel-espanha/` (não foi alterado)

---

## 1. Funcionalidades implementadas

| Módulo | O que faz |
|---|---|
| Configuração guiada | 8 perguntas (todas podem ser puladas), resumo final, opção de ver exemplo ou importar backup. Avisos específicos por tipo de estudo; com “outra modalidade” ou “não sei”, indica verificar na fonte oficial. |
| Visão geral | Saudação, destino, contagem para a chegada, progresso real (tarefas concluídas/total), pendentes/em andamento/atrasadas, documentos prontos, resumo do orçamento, fase atual, 5 tarefas prioritárias (atrasadas → prazo em 14 dias → etapas anteriores à fase atual → prioridade), próximas datas, atalhos e lembrete de backup. |
| Checklist | 39 tarefas de exemplo em 8 etapas. Criar, editar, concluir, excluir (com confirmação) e reordenar (↑/↓). Status, prioridade, prazo, categoria, observações e link. Filtros por status (incluindo “atrasadas”), etapa, categoria e prioridade. |
| Documentos | Apenas metadados (sem upload). Situação, emissão, validade, apostila e tradução (“verificar / necessário / feito / não necessário”), pessoa (titular/acompanhante), link da fonte. Alertas de vencido, vencendo em até 60 dias e vencendo antes da chegada. Categorias personalizáveis. |
| Financeiro | Previsto × realizado por linha, em EUR ou BRL. Câmbio informado pelo usuário, com data da cotação (alerta se tiver mais de 30 dias). Linhas sem câmbio ficam fora do total, com aviso. Totais, restante, folga ou déficit frente ao orçamento declarado, reserva disponível e distribuição por categoria. |
| Cronograma | Chegada (do perfil) + eventos + prazos de tarefas. Eventos ligados a tarefas. Seções Atrasadas / Próximas / Passadas, com alerta visual para os próximos 7 dias. Avisa que não há notificações fora do app. |
| Primeiros dias | Etapa 8 do checklist agrupada em 10 categorias (Moradia, Empadronamiento, Conta bancária…), com aviso sobre a aplicabilidade e links oficiais. |
| Fontes oficiais | 8 fontes com órgão, finalidade e data de verificação, mais links próprios do usuário (consulado, ayuntamiento etc.). |
| Dados e privacidade | Editar perfil, exportar/importar backup JSON validado, imprimir ou salvar o resumo em PDF, restaurar o modelo (exige digitar RESTAURAR), apagar tudo (exige digitar APAGAR), sair do modo exemplo e explicação clara sobre o armazenamento. |

**Robustez:** salvamento automático com indicador “Salvo às hh:mm”. Detecta quando o navegador bloqueia o armazenamento (aba anônima). Se os dados salvos estiverem corrompidos, preserva uma cópia em vez de sobrescrever e oferece o download. Sincroniza entre abas abertas ao mesmo tempo. Pede ao navegador armazenamento persistente. Valida datas, valores (`1.250,00`, `1250.00`, `1.500`) e links (só `http`/`https`). Escapa todo texto digitado.

**Privacidade comprovável:** a página tem uma política de segurança de conteúdo (`connect-src 'none'`, sem scripts, fontes ou imagens externas). O navegador bloqueia qualquer envio de dados pela rede. Nos testes automatizados, nenhuma requisição externa foi feita.

## 2. Problemas encontrados no painel original

O painel original não foi alterado. Os problemas abaixo justificam ter criado o produto separado:

1. **Vazamento de dados (crítico):** a sincronização com o Firebase grava todos os visitantes no mesmo documento `app/planner`, com login anônimo. Qualquer pessoa que abre a URL pública lê e pode sobrescrever o seu planejamento pessoal. Se fosse vendido assim, os compradores veriam os dados uns dos outros.
2. **Informação falsa ao usuário:** o rodapé diz “nada é enviado para nenhum servidor”, mas o Firebase envia tudo.
3. **Dados pessoais publicados:** nomes, advogada, voos, datas e endereço da base estão escritos direto no HTML, em uma URL pública.
4. **Conteúdo fixo no código:** datas, tarefas e cards estão no HTML. Não dá para personalizar sem reescrever.
5. **Sem backup/importação** e sem confirmação nas ações que afetam o planejamento inteiro.
6. **Dependências externas** (Google Fonts, Leaflet, Firebase, OpenStreetMap): o IP do usuário vai para terceiros, e o painel quebra sem rede.

**O que foi reaproveitado:** a arquitetura de arquivo único, o padrão de saneamento do estado (`normalizeState`), o escape de HTML e a validação de links, o parser de números em pt-BR e a lógica de “próximas ações derivadas do estado real”.

## 3. Publicar ou atualizar

O GitHub Pages serve a pasta `/docs` da branch `claude/spain-trip-first-days-m8oke1`.

1. Edite `docs/espanha-organizada/index.html`.
2. Ao mudar algo relevante, aumente `APP_VERSION`. Se mudar o **formato dos dados**, aumente `SCHEMA` e trate a migração em `normalizeState`.
3. Faça commit e push na branch acima. O Pages republica em 1–2 minutos.
4. Os dados dos usuários não são afetados por atualizações: eles ficam no navegador, sob a chave `espanhaOrganizada.v1`.

**Recomendado antes de vender:** publicar o produto em um repositório e domínio próprios (ex.: `app.espanhaorganizada.com`). Três motivos:
- O localStorage é **vinculado à origem**. Se a URL mudar depois do lançamento, os compradores “perdem” os dados, a menos que façam o backup.
- O repositório atual expõe seu painel pessoal no mesmo domínio.
- Um domínio próprio passa mais confiança.

Mude a URL **antes** do primeiro cliente, não depois.

## 4. Entrega do produto após a compra

Não existe controle de acesso no app. Quem tiver o link consegue usar. Opções, da mais simples para a mais robusta:

| Opção | Como funciona | Proteção real |
|---|---|---|
| A. Link na página de obrigado (Hotmart, Kiwify, Gumroad, Lemon Squeezy) | Após o pagamento, o checkout mostra e envia por e-mail a URL do app | Nenhuma: o link pode ser compartilhado |
| B. Arquivo para download | O checkout entrega o `index.html` (funciona aberto localmente) + PDF de instruções | Nenhuma, mas o produto parece um “arquivo comprado” |
| C. Área de membros da plataforma | A URL fica dentro da área de membros | Dificulta o compartilhamento casual |
| D. Licença verificada (futuro) | Código de licença validado por um endpoint (Lemon Squeezy/Gumroad têm API de licença) | Real, mas exige servidor e mudar a política de segurança |

Para validar com os primeiros compradores, **A ou C bastam**. Com €14,90, o custo de pirataria é menor que o de construir autenticação agora. Mensagem sugerida para o e-mail de entrega:

> Seu acesso: [URL]. Salve nos favoritos ou “Adicione à tela de início”. Seus dados ficam só neste navegador — use **Dados → Exportar backup** com frequência e para trocar de aparelho.

## 5. Limitações conhecidas

- Sem sincronização entre aparelhos. O backup é manual (o app lembra o usuário a cada 14 dias).
- O Safari (iOS) pode apagar dados de sites não visitados por cerca de 7 dias, a menos que o app seja adicionado à tela de início. Isso precisa entrar no e-mail de entrega.
- Não há notificações nem lembretes por e-mail: os alertas só aparecem com o app aberto.
- O câmbio é manual, de propósito (não há fonte confiável sem servidor).
- As fontes oficiais foram localizadas em 23/10/2026 por pesquisa nos sites oficiais. Daqui não foi possível abrir as páginas para conferir o conteúdo atual (rede bloqueada no ambiente). **Clique em cada link antes do lançamento.**
- O modelo é pensado para brasileiros. A fonte de antecedentes criminais é a da Polícia Federal. Para outros países de origem, o usuário precisa ajustar.
- Ao reordenar com filtros ativos, a tarefa troca de lugar com a vizinha da lista completa da etapa, não com a vizinha visível.
- Não há proteção de acesso (veja a seção 4).
- Sem modo escuro e sem idioma além do português.

## 6. Checklist para liberar o lançamento

Itens cobertos pelo teste automatizado (Chromium, desktop 1280px e celular 375px; 72/72 aprovados em 23/10/2026) estão marcados com ✅. Os demais são manuais.

- [x] ✅ Configuração guiada completa, com validação de orçamento e data
- [x] ✅ Texto digitado com HTML é exibido como texto (sem injeção)
- [x] ✅ Concluir tarefa atualiza o progresso e persiste após recarregar
- [x] ✅ Criar, editar, reordenar, filtrar e excluir tarefa (com confirmação)
- [x] ✅ Link `javascript:` é recusado
- [x] ✅ Documento com validade anterior à emissão é recusado; alertas de validade funcionam
- [x] ✅ Cálculos: 1.500 − 200,50 = 1.299,50; R$ 620 ÷ 6,2 = € 100; exibição em BRL; valor negativo recusado
- [x] ✅ Linha em outra moeda sem câmbio fica fora do total, com aviso
- [x] ✅ Evento com data obrigatória, ligado a tarefa, com alerta de prazo próximo
- [x] ✅ Exportar → apagar tudo → importar restaura os mesmos dados
- [x] ✅ Backup inválido ou JSON quebrado é recusado com mensagem
- [x] ✅ Restaurar modelo mantém o perfil e os links
- [x] ✅ Apagar tudo exige digitar APAGAR e limpa o armazenamento
- [x] ✅ Dados corrompidos: aviso + cópia preservada
- [x] ✅ Modo exemplo identificado e com saída para configuração limpa
- [x] ✅ Resumo de impressão gerado
- [x] ✅ Nenhuma rolagem horizontal em 375px nas 8 telas
- [x] ✅ Zero erros no console e zero requisições externas
- [ ] Abrir cada uma das 8 fontes oficiais e confirmar que a página está correta
- [ ] Testar em iPhone (Safari) e Android (Chrome), incluindo “Adicionar à tela de início”
- [ ] Imprimir/salvar PDF de verdade no celular e no computador
- [ ] Importar no celular um backup exportado no computador
- [ ] Revisão do texto por alguém que nunca viu a ferramenta (entende sem explicação?)
- [ ] Revisar com profissional habilitado os textos das tarefas e documentos de exemplo
- [ ] Definir a URL definitiva **antes** do primeiro cliente (seção 3)
- [ ] Página de vendas com aviso: “não é assessoria jurídica; dados ficam no seu navegador”
- [ ] Termos de uso e política de privacidade curtos na página de vendas
- [ ] Configurar o e-mail de entrega (seção 4) com instruções de backup
