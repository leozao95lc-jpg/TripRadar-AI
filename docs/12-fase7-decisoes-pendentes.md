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

## Registro de decisões oficiais

As decisões abaixo foram confirmadas e passam a valer como diretriz para todo
trabalho futuro de Fase 7 — não são mais recomendações deste documento, são
decisão tomada. Os itens que **não** aparecem aqui (ex.: qual parceiro de
passagem/hotel/seguro específico) continuam em aberto; ver cada seção para o
que ainda falta decidir.

1. ✅ **Compra por redirecionamento para parceiro no lançamento** — Modelo A
   (§0), não Modelo B. Confirma a recomendação; resolve a Decisão 0.1.
2. ✅ **Hotéis e seguro seguem o mesmo padrão** — cross-sell de afiliado
   (redirecionamento), não busca própria dentro do produto. Resolve a pergunta
   de produto no início de §1 e §2.
3. ✅ **Milhas permanecem na versão lite até existir demanda comprovada** —
   nenhuma frente de parceria com programas de milhas (Smiles, LATAM Pass,
   TudoAzul) antes de haver sinal de uso da tabela de referência atual.
   Resolve a Decisão 3.1.
4. ✅ **Câmbio oferece histórico e contexto, sem previsões** — Opção A (§4)
   confirmada para implementação; Opção C descartada definitivamente, não só
   desaconselhada. Resolve a Decisão 4.1.
5. ✅ **Search Provider e Booking Provider são conceitos definitivamente
   separados na arquitetura** — formaliza a ressalva técnica que estava no
   final de §0 como decisão de arquitetura, não mais só uma observação.
   Detalhado em §7 (novo).
6. ✅ **Prioridade estratégica: evoluir para um assistente de custo total da
   viagem, não só um monitor de passagens** — reposiciona como os itens desta
   Fase 7 devem ser lidos e sequenciados daqui em diante. Detalhado em §8
   (novo), com implicações em `00-visao-geral.md` e `02-mvp-roadmap.md`.

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

**✅ Decisão oficial 0.1:** Modelo A (redirecionamento simples) para o lançamento
da compra de passagem. Mesma razão que `01-analise-e-riscos.md` já deu para
CADASTUR: validar demanda e reduzir risco regulatório/operacional antes de
assumir a complexidade (e a exposição) do Modelo B. Revisitar o Modelo B só
quando já existir volume que justifique negociar melhor comissão E capacidade
operacional de suporte pós-venda — nenhum dos dois existe ainda.

**⚠️ Decisão ainda pendente 0.2:** qual parceiro/agência para o Modelo A? Isso
não é uma escolha técnica (qualquer um vira "um link com UTM"), é uma escolha
comercial: cobertura de rotas (nacional vs. internacional), reputação (evitar
repetir o problema de confiança já flagrado sobre a Decolar em
`08-revisao-estrategica-latam.md`), e se o parceiro aceita ser citado como "onde
comprar" sem prejudicar o posicionamento de "TripRadar é quem tem a
inteligência, não quem vende" que é o diferencial central do produto. Continua
em aberto — ver pergunta 1 em §10.

**Se o Modelo B for revisitado no futuro:** vale a ressalva técnica que agora é
decisão de arquitetura oficial, não só observação — ver §7.

---

## 1. Hotéis

**Pergunta de produto antes da técnica:** hotel entra como cross-sell de
redirecionamento (mesmo Modelo A acima, um banner/e-mail contextual depois que o
usuário já tem um alerta de voo pra um destino) ou como uma busca de hotel própria
dentro do produto (com preço, filtro, monitoramento de tarifa — replicando pra hotel
o que já existe pra voo)?

A segunda opção é um produto novo inteiro (motor de busca+preço+UI própria), não uma
feature — e não há nenhum dado ainda de que o usuário do TripRadar (que veio pelo
monitoramento de passagem) quer isso do mesmo lugar.

**✅ Decisão oficial:** hotel entra como cross-sell simples de afiliado (mesmo
Modelo A de §0), não como busca própria. Consistente com `02-mvp-roadmap.md`,
que já colocava hotéis na Fase 4/Escala, não na Fase 7 imediata.

**⚠️ Decisão ainda pendente 1.1:** qual programa de afiliados de hotel
(Booking.com Partner Program, Expedia Rapid API/Affiliate, HotelBeds)? Cada um
tem cobertura, comissão e complexidade de integração diferentes — mas para o
modelo de cross-sell simples (link com tracking, não busca própria), a escolha
é predominantemente comercial (comissão, confiabilidade de pagamento, marca)
mais do que técnica. Não há necessidade de decidir isso antes de outras
prioridades — é a peça de menor risco/urgência deste documento inteiro.

---

## 2. Seguro viagem

Mesma estrutura regulatória do problema de passagem, só que para seguro: no
Brasil, intermediar venda de seguro exige ser corretor de seguros registrado na
SUSEP, ou operar através de um parceiro já licenciado. `01-analise-e-riscos.md`
não cobriu isso explicitamente (só falou de CADASTUR para passagem) — vale
registrar aqui como o mesmo tipo de risco.

**✅ Decisão oficial:** parceiro via afiliado (mesmo Modelo A de §0), nunca
corretagem própria no início.

**⚠️ Decisão ainda pendente 2.1:** qual parceiro — uma insurtech com programa de
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

**✅ Decisão oficial 3.1:** manter a tabela "lite" (curadoria manual periódica) e
**não** abrir nenhuma frente de parceria com programas de milhas brasileiros até
haver sinal de demanda validada — por exemplo, % de usuários que efetivamente
interagem com o painel de milhas hoje. Negociar acesso a dado de programa de
milhas é um processo lento e de relacionamento; gastar esse capital antes de
saber se o usuário sequer usa a feature "lite" seria esforço desperdiçado — o
tipo de decisão que este engajamento tem evitado sistematicamente (ver
"não-escopo" em `11-provider-integration-strategy.md` §8, mesmo princípio
aplicado aqui). Nenhuma ação necessária até o sinal de demanda aparecer.

**⚠️ Decisão ainda em aberto 3.2 (separada da anterior, não bloqueada por ela):**
a monetização via afiliado de
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

**✅ Decisão oficial 4.1:** Opção A (histórico e contexto) confirmada para
implementação assim que fizer sentido no roadmap de frontend — nenhum bloqueio
de negócio. Opção C (previsão) **descartada definitivamente**, não apenas
desaconselhada: é a única decisão deste documento inteiro que era de risco de
produto, não de parceria/licença, e o risco (câmbio é notoriamente difícil de
prever; uma previsão errada mina exatamente a confiança que
`01-analise-e-riscos.md` §2.3 identifica como central) foi julgado alto demais
para o ganho. Opção B (provedor de câmbio pago) fica em espera até haver
orçamento de dado disponível — não decidida nem descartada, só não prioritária
agora.

---

## 7. Search Provider e Booking Provider são conceitos definitivamente separados

Isso estava registrado como "ressalva técnica" no final de §0; agora é decisão
de arquitetura oficial, então merece seção própria.

`modules/providers` (Fase 6) define `FlightSearchProvider` — uma porta que só
faz uma coisa: dado uma rota/data, devolve ofertas com preço (`FlightOffer`).
O `AmadeusFlightProvider` implementa exatamente isso, e só isso. **Nenhum
adapter de emissão/compra (Duffel ou qualquer outro, no Modelo B, se e quando
for revisitado) deve implementar ou estender `FlightSearchProvider`** — emitir
um bilhete é uma capacidade categoricamente diferente (envolve pagamento,
dados de passageiro, estado de pedido, cancelamento/remarcação), não um método
a mais na mesma interface.

**O que isso significa na prática, quando a Fase 7 chegar no Modelo B (se
chegar):**
- Uma porta nova, própria — algo como `FlightBookingProvider` em
  `modules/providers/application/ports.py` (ou um módulo novo, `booking`, se o
  escopo justificar um bounded context próprio com seu próprio ciclo de vida
  de pedido) — não um método adicional em `FlightSearchProvider`.
- `FlightSearchProvider` continua podendo evoluir (novo provedor de busca,
  cache, circuit breaker — tudo que já existe na Fase 6) **sem nenhum risco de
  vazar preocupação de pagamento/emissão** para dentro dela.
- Um mesmo provedor comercial (ex.: se um dia a Amadeus ou a Duffel forem
  usadas tanto pra busca quanto pra emissão) pode ter DUAS classes adapter
  diferentes, uma por porta — não uma classe que implementa as duas
  interfaces, para não criar acoplamento entre um caso de uso que hoje é
  público/sem autenticação de usuário (busca) e outro que é sensível e
  transacional (compra).

Esta decisão não exige nenhuma ação agora — não há `FlightBookingProvider`
para construir enquanto a Decisão 0.1 mantiver o Modelo A. Ela existe para que,
quando/se o Modelo B for revisitado, ninguém (nem uma sessão futura deste
mesmo assistente) tente atalhar estendendo `FlightSearchProvider` por
conveniência de curto prazo.

---

## 8. Reposicionamento: assistente de custo total da viagem

Esta é a decisão de maior alcance deste documento — não é sobre um item
específico da Fase 7, é sobre **como ler todos eles daqui em diante**.

**✅ Decisão oficial:** o TripRadar deixa de ser enquadrado, na ambição de longo
prazo, como "monitor de preço de passagem que também empurra hotel/seguro como
cross-sell avulso" e passa a ser enquadrado como **um assistente de custo total
da viagem** — a pergunta que o produto responde deixa de ser só "quando devo
comprar esta passagem" e passa a incluir "quanto esta viagem inteira vai custar,
e onde dá pra economizar em cada parte dela".

**O que muda de fato, e o que não muda:**
- **Não muda o MVP nem o que já está construído.** O core continua sendo
  monitoramento de preço de passagem — isso não é substituído, é o ponto de
  entrada de um produto maior.
- **Não antecipa nenhuma implementação nova.** Hotel, seguro, milhas e câmbio
  continuam exatamente com o escopo e a sequência decididos acima (cross-sell
  de afiliado, lite, histórico sem previsão) — o reposicionamento é de
  narrativa/arquitetura de informação, não uma ordem para construir mais agora.
- **Muda a lente para decisões de produto futuras**, em particular:
  - Dá uma razão de ser coerente para por que hotel/seguro/milhas/câmbio
    pertencem ao mesmo produto, em vez de parecerem bolt-ons desconexos
    grudados num monitor de passagem — eles são facetas do "quanto a viagem
    custa", não features soltas.
  - Sugere (sem decidir agora — fica para quando a Fase 7 tática avançar) que
    o modelo de dados eventualmente precisa de um conceito de "viagem"
    (agregando passagem + hotel + seguro + milhas + câmbio de uma mesma
    jornada) em vez de cada vertical viver isolada. Isso é uma implicação a
    ser detalhada em `04-modelo-dados.md` quando (e só quando) a implementação
    de fato começar — registrar aqui não é autorização para modelar agora.
  - Deve influenciar o texto de produto (`00-visao-geral.md` §1.1, proposta de
    valor) e a métrica norte (`02-mvp-roadmap.md` §3.7) — ver ambos, já
    atualizados com uma nota apontando pra esta decisão.

**Por que registrar isso agora, sem implementar nada:** decisões de
posicionamento de produto têm efeito imediato em como as decisões táticas
seguintes (qual parceiro, qual dado, qual UI) são avaliadas, mesmo antes de
qualquer código — errar essa lente cedo custa retrabalho de arquitetura de
informação mais tarde, o mesmo racional de "resolver antes de construir" que
guia este documento inteiro.

---

## 9. Tabela-resumo de sequenciamento

| Item | Status | Tipo de bloqueio restante | Prioridade sugerida |
|---|---|---|---|
| 0. Modelo de compra (A/B) | ✅ Decidido — Modelo A | — | Resolvido |
| 0. Escolha do parceiro de passagem | ⚠️ Em aberto | Negócio | 1º — próximo bloqueio real |
| 1. Hotéis — padrão (cross-sell vs. busca própria) | ✅ Decidido — cross-sell | — | Resolvido |
| 1. Hotéis — escolha do parceiro | ⚠️ Em aberto | Negócio (baixo risco) | 3º |
| 2. Seguro — padrão (cross-sell vs. corretagem própria) | ✅ Decidido — cross-sell | — | Resolvido |
| 2. Seguro — escolha do parceiro | ⚠️ Em aberto | Negócio + jurídico (SUSEP) | 4º |
| 3.1 Parceria de dado de milhas | ✅ Decidido — adiado até sinal de demanda | — | Nenhuma ação agora |
| 3.2 Afiliado financeiro (cartão/milhas) | ⚠️ Em aberto, opcional | Negócio, baixa complexidade | Pode começar a qualquer momento, independente |
| 4. Câmbio avançado (A — histórico) | ✅ Decidido — implementar | — | Pode implementar já |
| 4. Câmbio avançado (B — provedor pago) | Em espera (não decidido nem descartado) | Orçamento | Quando houver orçamento |
| 4. Câmbio avançado (C — previsão) | ✅ Decidido — descartado | — | Não fazer |
| 7. Separação Search/Booking Provider | ✅ Decidido — arquitetura registrada | — | Sem ação até o Modelo B ser revisitado |
| 8. Reposicionamento "custo total da viagem" | ✅ Decidido — lente adotada | — | Sem ação de implementação imediata |

## 10. O que ainda falta para destravar o resto

As seis decisões de §"Registro de decisões oficiais" estão tomadas. O que
resta é só escolha de parceiro comercial. §11 traz um levantamento inicial de
candidatos (pesquisa web, não conversa comercial real) para embasar essa
escolha — a decisão final continua sendo sua.

Nenhuma delas bloqueia o item 4-A (câmbio histórico) nem o item 3.2 (afiliado
financeiro de milhas), que já podem avançar a qualquer momento, de forma
independente — nem a §7/§8 (arquitetura e reposicionamento), que já estão
registradas e não pedem nenhuma ação imediata.

---

## 11. Levantamento de candidatos a parceiro (pesquisa inicial)

> Pesquisa feita em julho de 2026 via busca web — não é uma conversa
> comercial real, é um ponto de partida para comparar opções antes de
> abordar qualquer um deles. Percentuais de comissão variam por acordo
> individual e mudam com frequência; confirmar direto com cada programa
> antes de decidir. Fontes ao final de cada bloco.

### 11.1 Passagem — a escolha mais importante

O TripRadar monitora preço **entre companhias** (a Amadeus busca múltiplas
cias por rota) — isso muda o que "bom parceiro" significa aqui: um afiliado
de uma companhia só (GOL, LATAM, Air France) é estruturalmente ruim pra esse
caso de uso, porque se a oferta mais barata encontrada for de outra
companhia, o redirecionamento não leva a ela. **Vale eliminar programas de
afiliado por companhia aérea individual da lista de candidatos por esse
motivo, não só por comissão.**

| Candidato | Comissão | Cobertura | Observação |
|---|---|---|---|
| **TravelPayouts** (rede Aviasales/Jetradar) | ~1,1–1,5% em voos, ~4–5% em hotel, também cobre seguro/carro | Agrega ~100 marcas de viagem, busca/deep-link **multi-companhia** por rota+data | **Candidato mais forte**: um único cadastro cobre passagem, hotel *e* seguro — resolve as três decisões pendentes com uma relação comercial só. Pagamento mensal, mínimo de saque $50 |
| **Kiwi.com (Tequila API)** | Historicamente ~3%, hoje negociado por parceria | Multi-companhia, deep-link por itinerário | ⚠️ Parcerias novas de API hoje são **só por convite** — não é mais cadastro aberto; precisa abordagem direta, não é um "criar conta e pronto" |
| **Decolar (via Awin)** | 2,5% CPA | Multi-companhia (é uma OTA) | ⚠️ Cadastro exige ser **pessoa jurídica que atua exclusivamente com venda/promoção de viagens, habilitada por autoridade de turismo competente** — isso reintroduz exatamente o tipo de exigência regulatória que a Decisão 0.1 (Modelo A) foi escolhida pra evitar. Some ao problema de marca já flagrado em `08-revisao-estrategica-latam.md`. **Não recomendado** |
| **Hurb (Clube Hurb)** | Não divulgado publicamente | Multi-companhia (é uma OTA) | Programa ativo (15 mil+ afiliados), mas sem informação técnica de deep-link/API encontrada na pesquisa — precisaria contato direto pra avaliar viabilidade técnica |
| GOL / LATAM / Air France (afiliado direto) | 1–2,5% conforme cia | Só aquela companhia | **Descartado** pelo motivo estrutural acima |

**Recomendação:** avaliar TravelPayouts primeiro — não só pela comissão, mas
por resolver as três verticais (passagem, hotel, seguro) com uma única
integração/relação comercial, o que é uma vantagem prática real dado que
"escolher parceiro" é hoje o principal item que resta nesta lista. Kiwi.com
fica como alternativa de qualidade potencialmente maior, se e quando a
abordagem por convite for viável.

Fontes: [Travelpayouts review](https://affiliation-direct.net/en/travelpayouts-platform/), [Kiwi.com affiliate program API – Travelpayouts Help Center](https://support.travelpayouts.com/hc/en-us/articles/360019237899-Kiwi-com-affiliate-program-API), [Better for Business – Kiwi.com](https://media.kiwi.com/articles-and-interviews/better-for-business-kiwi-com-takes-a-new-approach-to-partnerships/), [Programa de Afiliados Decolar na Awin](https://bomdemarca.com.br/blog/programa-de-afiliados-decolar), [Clube Hurb](https://www.mercadoeeventos.com.br/noticias/agencias-e-operadoras/clube-hurb-lanca-programa-para-indicar-amigos-e-ganhar-comissao/), [Programa de Afiliados Azul, Latam e Gol](https://voopassagensaereas.com.br/programa-de-afiliados-azul-latam-gol-e-avianca), [Air France afiliação](https://wwws.airfrance.com.br/information/prepare/services/affiliation).

### 11.2 Hotel

| Candidato | Comissão | Observação |
|---|---|---|
| **TravelPayouts** (mesma rede) | ~4–5% revenue share | Mesma vantagem de integração única já citada acima |
| **Booking.com Affiliate Partner Program** | ~4–4,8% | Cadastro direto simples (formulário + revisão de 1–5 dias úteis), marca forte e reconhecida pelo viajante brasileiro, dashboard próprio de deep links |

**Recomendação:** se TravelPayouts for escolhido para passagem, começar
usando a mesma rede pra hotel evita abrir uma segunda relação comercial
antes de haver volume que justifique. Booking.com direto é a opção natural
se/quando o cross-sell de hotel mostrar tração suficiente pra valer uma
integração dedicada.

Fontes: [Booking.com Affiliate Program 2026 — getlasso](https://getlasso.co/affiliate/booking/), [Booking.com Affiliate Partners](https://partnerships.booking.com/).

### 11.3 Seguro viagem

| Candidato | Comissão | Observação |
|---|---|---|
| **TravelPayouts** (mesma rede) | Não detalhado na pesquisa | Mesma vantagem de integração única |
| **Real Seguro Viagem** | Não divulgado | Programa de indicação direto, sem desconto no repasse |
| **Assistente de Viagem** | Até 25%, progressivo | Comissão mais alta entre os candidatos levantados |
| **Allianz Travel BR** | Não divulgado | Marca grande/estabelecida (75+ anos), modelo B2B2C — provavelmente onboarding mais lento pra um afiliado pequeno |

**Recomendação:** dado que seguro já é o item de menor prioridade em §2
(attach-rate esperado menor), começar pela mesma rede TravelPayouts (se
escolhida acima) em vez de abrir uma terceira relação comercial agora;
revisitar com um parceiro dedicado (Assistente de Viagem pela comissão, ou
Real Seguro Viagem) só quando houver sinal real de demanda — mesmo racional
já aplicado à decisão de milhas em §3.1.

Fontes: [Real Seguro Viagem — Programa de Indicadores](https://app.seguroviagem.srv.br/indica/), [Assistente de Viagem — Afiliados](https://assistentedeviagem.com.br/seguro-viagem/afiliados), [Allianz Travel BR na Awin](https://ui.awin.com/merchant-profile/24143).
