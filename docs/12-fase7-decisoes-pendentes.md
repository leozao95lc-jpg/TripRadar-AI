# 12. Fase 7 — Decisões Pendentes (Evolução do Produto)

> Diferente da Fase 6 (Amadeus), onde a pergunta bloqueante era **"como"** integrar,
> aqui a pergunta bloqueante é quase sempre **"com quem"** e **"sob que estrutura
> legal"** — decisões de negócio/jurídicas, não técnicas. Implementar antes de
> resolvê-las é o tipo de trabalho que se joga fora quando a resposta vier (ex.:
> construir checkout embutido com um parceiro e descobrir depois que o parceiro
> certo era outro, ou que o modelo devia ser afiliado simples). Nenhuma linha de
> código foi escrita para os itens abaixo; isto é só a análise.
>
> Este documento assume o que já foi decidido em `01-analise-e-riscos.md` §2.5 e
> `02-mvp-roadmap.md` §3.6 — não repete a análise de risco regulatório geral, só
> aprofunda as decisões específicas de cada vertical da Fase 7.

## 0. A decisão-mãe: o que "comprar por parceiro" significa de fato

Todo o resto deste documento depende desta decisão primeiro. `01-analise-e-riscos.md`
já recomendou **redirecionar para parceiro/agência já licenciada no MVP/Beta**, em
vez de buscar acreditação própria (CADASTUR/IATA) — essa parte está resolvida. O que
**não** está resolvido é qual dos dois modelos de "parceiro" o TripRadar vai operar,
porque eles têm implicações de produto, responsabilidade e engenharia bem diferentes:

| | **Modelo A — Redirecionamento simples (afiliado)** | **Modelo B — Checkout embutido (API de consolidador)** |
|---|---|---|
| Como funciona | Botão "Ver oferta" sai do TripRadar para o site do parceiro/agência; a compra acontece 100% fora | Usuário paga dentro do TripRadar; o TripRadar chama a API do parceiro (ex.: Duffel) pra emitir o bilhete, e um gateway (Stripe/Pagar.me) processa o pagamento |
| Responsabilidade pós-venda (reembolso, remarcação, no-show) | Do parceiro, integralmente — o TripRadar nunca aparece nessa conversa | Ambígua por padrão — o usuário comprou "no TripRadar", então o suporte de primeira linha tende a cair pro TripRadar mesmo o parceiro sendo quem emite |
| Exposição a chargeback/fraude de pagamento | Nenhuma | Direta (mesmo delegando o gateway, a reconciliação e a decisão de reembolsar é do TripRadar) |
| Risco de "isso já configura intermediação de venda" (CADASTUR) | Mais defensável — jurídico deve confirmar, mas afiliado puro é o modelo mais comum pra evitar essa exigência | Mais exposto — quanto mais o TripRadar "parece" a agência (paga, emite, dá suporte), mais forte o argumento de que precisa de licença própria |
| Receita | Comissão de afiliado (tipicamente 1–3%, definida pelo parceiro) | Margem maior possível, mas negociada por volume — no início, provavelmente pior que afiliado até haver escala |
| Esforço de engenharia | Baixo (é um link com tracking) | Alto (fluxo de pagamento, PCI-scope via gateway, tratamento de falha de emissão, estado de pedido) |

**⚠️ Decisão pendente 0.1:** Modelo A ou B para o lançamento da compra de passagem?
A recomendação deste documento é **A**, pela mesma razão que `01-analise-e-riscos.md`
já deu para CADASTUR: validar demanda e reduzir risco regulatório/operacional antes
de assumir a complexidade (e a exposição) do Modelo B. Modelo B só compensa quando
já existe volume que justifique negociar melhor comissão E capacidade operacional de
suporte pós-venda — nenhum dos dois existe ainda.

**⚠️ Decisão pendente 0.2:** Se Modelo A, qual parceiro/agência? Isso não é uma
escolha técnica (qualquer um vira "um link com UTM"), é uma escolha comercial:
cobertura de rotas (nacional vs. internacional), reputação (evitar repetir o
problema de confiança já flagrado sobre a Decolar em `08-revisao-estrategica-latam.md`),
e se o parceiro aceita ser citado como "onde comprar" sem prejudicar o
posicionamento de "TripRadar é quem tem a inteligência, não quem vende" que é o
diferencial central do produto.

**Se Modelo B for escolhido no futuro:** `02-mvp-roadmap.md` já aponta Duffel como
"mais rápido de integrar tecnicamente" — vale uma ressalva técnica que não estava
explícita antes: **Duffel é uma API de busca+emissão, não a mesma coisa que a
integração Amadeus da Fase 6** (que é só busca/preço, via Flight Offers Search).
A `FlightSearchProvider` de `modules/providers` não cobre emissão — um adapter de
emissão seria uma porta nova (`FlightBookingProvider` ou similar), não uma extensão
da existente. E cobertura de tarifa doméstica brasileira em GDS internacionais como
Duffel historicamente é mais fraca que a de um consolidador local — outro motivo pra
essa escolha ser validada com dado de cobertura real antes de integrar, não suposta.

---

## 1. Hotéis

**Pergunta de produto antes da técnica:** hotel entra como cross-sell de
redirecionamento (mesmo Modelo A acima, um banner/e-mail contextual depois que o
usuário já tem um alerta de voo pra um destino) ou como uma busca de hotel própria
dentro do produto (com preço, filtro, monitoramento de tarifa — replicando pra hotel
o que já existe pra voo)?

A segunda opção é um produto novo inteiro (motor de busca+preço+UI própria), não uma
feature — e não há nenhum dado ainda de que o usuário do TripRadar (que veio pelo
monitoramento de passagem) quer isso do mesmo lugar. `02-mvp-roadmap.md` já coloca
hotéis na Fase 4/Escala, não na Fase 7 imediata — este documento concorda e reforça:
**começar como cross-sell simples de afiliado é a única opção que não exige
decisão de provedor de busca de hotel nenhuma para começar a gerar receita
marginal.**

**⚠️ Decisão pendente 1.1:** Qual programa de afiliados de hotel (Booking.com
Partner Program, Expedia Rapid API/Affiliate, HotelBeds)? Cada um tem cobertura,
comissão e complexidade de integração diferentes — mas para o modelo de
cross-sell simples (link com tracking, não busca própria), a escolha é
predominantemente comercial (comissão, confiabilidade de pagamento, marca) mais
do que técnica. Não há necessidade de decidir isso antes de outras prioridades —
é a peça de menor risco/urgência deste documento inteiro.

---

## 2. Seguro viagem

Mesma estrutura regulatória do problema de passagem, só que para seguro: no
Brasil, intermediar venda de seguro exige ser corretor de seguros registrado na
SUSEP, ou operar através de um parceiro já licenciado. `01-analise-e-riscos.md`
não cobriu isso explicitamente (só falou de CADASTUR para passagem) — vale
registrar aqui como o mesmo tipo de risco, com a mesma recomendação: **parceiro
via afiliado (Modelo A), nunca corretagem própria no início.**

**⚠️ Decisão pendente 2.1:** Qual parceiro — uma insurtech com programa de
afiliados já pronto (ex.: perfis como 90 Seguro Viagem, Seguros Promo) ou uma
seguradora tradicional com parceria direta? Insurtechs tendem a ter onboarding de
afiliado mais rápido; seguradora tradicional pode ter melhor cobertura/preço mas
processo de parceria mais lento. Sem informação de volume esperado, não dá pra
recomendar um lado — é uma decisão que precisa de uma conversa comercial, não de
mais análise deste documento.

**Prioridade:** mais baixa que hotéis — seguro de viagem é um produto de
attach-rate menor e mais dependente de contexto de viagem internacional
específico (já é nicho dentro do nicho). Manter em Fase 4/Escala como já está no
roadmap.

---

## 3. Milhas (evolução além do "lite")

O MVP já entrega uma versão "lite": tabela de referência estática de valor por
milha por programa (cents-per-mile), mantida manualmente, sem integração em tempo
real — decisão já tomada e implementada em `08-revisao-estrategica-latam.md`.
"Milhas" na Fase 7 significa evoluir isso, e aqui a decisão pendente é
principalmente sobre **onde vale a pena investir esforço de parceria**, não sobre
arquitetura:

- **Smiles, LATAM Pass e TudoAzul não têm API pública de desenvolvedor.** Isso não
  é uma lacuna técnica que uma escolha de biblioteca resolve — é uma parceria de
  negócio (ou não existe caminho nenhum sem acordo comercial direto com o
  programa). Nenhuma decisão de arquitetura antecipa isso; só uma conversa
  comercial com os programas (ou aceitar que não vai haver dado em tempo real) resolve.

**⚠️ Decisão pendente 3.1:** Vale abrir uma frente de parceria com programas de
milhas brasileiros agora, ou manter a tabela "lite" (curadoria manual periódica)
até haver sinal de demanda validada — por exemplo, % de usuários que efetivamente
interagem com o painel de milhas hoje? Recomendação: **esperar o sinal de
demanda.** Negociar acesso a dado de programa de milhas é um processo lento e de
relacionamento; gastar esse capital de relacionamento antes de saber se o usuário
sequer usa a feature "lite" é risco de esforço desperdiçado — o tipo de decisão
que este engajamento tem evitado sistematicamente (ver "não-escopo" em
`11-provider-integration-strategy.md` §8, mesmo princípio aplicado aqui).

**⚠️ Decisão pendente 3.2 (separada da anterior):** a monetização via afiliado de
cartão/clube de milhas já foi sinalizada em `08-revisao-estrategica-latam.md`
como oportunidade ("audiência já qualificada pelo consultor de milhas") — isso é
uma parceria de marketing de produto financeiro (ex.: cartões com pontuação de
milhas), completamente independente de ter ou não API de programa de milhas. Pode
avançar em paralelo, sem depender da decisão 3.1, e tem menor complexidade
regulatória que os itens 0–2 (não é intermediação de venda de passagem/seguro,
é publicidade/afiliação financeira — ainda assim vale checar exigência de
disclosure de publicidade paga, mas é um risco bem menor).

---

## 4. Câmbio avançado

O MVP já tem um "sinal de câmbio": ingestão diária de câmbio (USD/EUR → BRL) via
API gratuita/barata, usado como fator qualitativo ("câmbio favorável/desfavorável")
somado à recomendação de preço. O roadmap não define o que "avançado" significa —
esta é a decisão de escopo que falta, não uma decisão de parceiro/licença como as
anteriores:

| Opção | O que muda | Risco |
|---|---|---|
| **A. Visualização histórica** — mostrar gráfico de tendência de câmbio ao lado do preço, sem mudar fonte de dado nem lógica de recomendação | Só UI/apresentação | Baixo — nenhuma decisão de negócio bloqueia, é puramente uma tarefa de produto/frontend |
| **B. Provedor de câmbio mais granular** — trocar a fonte gratuita atual por um serviço pago com mais frequência de atualização/histórico mais longo | Custo recorrente novo, decisão de fornecedor | Baixo-médio — decisão de compra simples, não regulatória |
| **C. Recomendação combinando previsão de câmbio + preço** ("espere N dias, câmbio deve melhorar X%") | Muda a natureza da recomendação de descritiva para preditiva sobre câmbio | **Alto** — câmbio é notoriamente difícil de prever; uma previsão errada mina exatamente a confiança que `01-analise-e-riscos.md` §2.3 já identificou como o risco central do produto ("falsos positivos da IA... sempre expor o racional, nunca uma promessa categórica") |

**⚠️ Decisão pendente 4.1:** este documento recomenda explicitamente **A agora,
B quando houver orçamento de dado disponível, e C não** (ou, no máximo, C
reformulado como "aqui está a tendência histórica" em vez de "aqui está a
previsão") — não porque falte parceiro ou licença, mas porque C é o único item
deste documento inteiro que é uma decisão de **risco de produto**, não de
negócio/jurídica. Não é algo que precise de resposta externa para prosseguir — é
algo que este documento já está recomendando não fazer, e registra aqui para
não ser reintroduzido sem essa ressalva.

---

## 5. Tabela-resumo de sequenciamento

| Item | Tipo de bloqueio | Precisa de decisão externa (sua) antes de começar? | Prioridade sugerida |
|---|---|---|---|
| 0. Modelo de compra (A/B) | Negócio + jurídico | **Sim** — é a decisão mais crítica, define o padrão que 1 e 2 reaproveitam | 1º |
| 0. Escolha do parceiro de passagem | Negócio | **Sim** | Junto com a de cima |
| 1. Hotéis (cross-sell afiliado) | Negócio (qual programa) | Sim, mas de baixo risco/reversível | 3º — depois de validar o modelo 0 |
| 2. Seguro (cross-sell afiliado) | Negócio + jurídico (SUSEP) | Sim | 4º — menor attach-rate esperado que hotel |
| 3.1 Parceria de dado de milhas | Negócio, e de baixa urgência | Não — recomendação é esperar sinal de demanda | Adiado deliberadamente |
| 3.2 Afiliado financeiro (cartão/milhas) | Negócio, baixa complexidade regulatória | Sim, mas pode andar em paralelo a qualquer outro item | Pode começar a qualquer momento, independente |
| 4. Câmbio avançado (A) | Nenhum — é só produto/frontend | Não | Pode implementar já, sem esperar nada |
| 4. Câmbio avançado (B/C) | B: compra de dado / C: não recomendado | B sim (orçamento); C não deveria prosseguir | B fica pra quando houver orçamento; C fica registrado como não-recomendado |

## 6. O que eu preciso de você para destravar isto

Perguntas diretas, na ordem em que bloqueiam o resto:

1. **Modelo de compra**: redirecionamento simples (afiliado) ou checkout embutido?
   (Recomendação: afiliado, para o lançamento.)
2. **Parceiro de passagem**: já existe alguma conversa comercial em andamento com
   alguma agência/consolidador, ou parto do zero para levantar opções?
3. **Hotel e seguro**: confirma que ambos entram só como cross-sell de afiliado
   por enquanto (sem busca própria), como já estava implícito no roadmap?
4. **Milhas**: concorda em adiar a busca de parceria de dado de programa até haver
   sinal de uso da versão "lite" atual? Se sim, nenhuma ação é necessária agora.
5. **Câmbio avançado**: posso implementar a Opção A (visualização histórica) como
   próximo passo já, sem esperar decisão nenhuma sua — confirma?

Itens 3.2 (afiliado financeiro) e 4-A (câmbio histórico) não têm nenhum bloqueio
de negócio real — posso começar por eles enquanto as decisões acima amadurecem,
se fizer sentido para você.
