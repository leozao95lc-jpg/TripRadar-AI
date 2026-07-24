# 11. Provider Integration Strategy

> Documento de estratégia, escrito antes da primeira linha da integração com a
> Amadeus (Fase 6). Objetivo: garantir que a integração com qualquer provedor de
> dados de voo — Amadeus hoje, Duffel/Kiwi amanhã — não acople o produto a um único
> fornecedor, e que falhas de terceiro (rate limit, indisponibilidade, mudança de
> contrato) tenham um caminho de degradação previsível em vez de virarem incidente.
> Nenhum código de integração foi escrito ainda; isto é só a estratégia.

## 0. O que já existe hoje (ponto de partida real, não hipotético)

A base para isto já está no código, não é uma proposta do zero:

- `modules/providers/application/ports.py` define `FlightSearchProvider` (ABC) com
  um único método, `search(origin_iata, destination_iata, departure_date,
  return_date, cabin_class, passengers) -> list[FlightOffer]`. Este é o **único
  ponto de acoplamento** entre o resto do sistema e qualquer provedor concreto.
- `modules/providers/infrastructure/mock_provider.py` implementa `MockFlightProvider`,
  determinístico (seed por hash da rota+data), já em uso em produção de fato (é o
  provedor default, `flight_provider="mock"` em `shared/config.py`).
- `modules/providers/domain/entities.py` define `FlightOffer`, o formato canônico
  já normalizado que `price_monitoring` e `alerts` consomem — eles nunca veem o
  formato bruto de nenhum provedor.
- `docs/07-estrutura-projeto.md` §8.1 já proíbe qualquer módulo importar
  `providers/infrastructure` ou `providers/domain` diretamente; o consumo é só via
  `application/ports.py`. Esta regra é o que torna o resto deste documento possível
  — sem ela, "trocar de provedor" seria um refactor, não uma troca de config.
- `shared/config.py` já tem `flight_provider: str = "mock" | "amadeus"`,
  `amadeus_api_key`, `amadeus_api_secret`, `amadeus_base_url`, mas **nenhum**
  timeout, retry ou circuit-breaker config — isso é a lacuna que a Seção 4 fecha.
- `redis_url` existe em config mas não é usado em lugar nenhum do código — é a
  lacuna que a Seção 3 fecha.
- Não há `tenacity`, `pybreaker` ou qualquer lib de resiliência instalada.
  `httpx` já é dependência (não usado ainda para chamadas de provedor real).
- `workers/price_polling_worker.py` já referencia
  `modules.providers.infrastructure.amadeus_provider.AmadeusFlightProvider` — o
  arquivo **não existe**. Esse é literalmente o próximo arquivo a ser criado, e
  tudo abaixo é a especificação de como ele deve se comportar.

O resto deste documento assume essa estrutura e propõe o que falta em cima dela —
não redesenha nada que já funciona.

---

## 1. Critérios para escolher e trocar provedores

Um provedor de dados de voo é avaliado nestes eixos, nesta ordem de peso para o
mercado LatAm que é a aposta do produto (ver `08-revisao-estrategica-latam.md`):

| Critério | Por que pesa | Como medir |
|---|---|---|
| Cobertura de rotas Brasil ⇄ exterior e Brasil doméstico | Sem isso o produto não serve o mercado-alvo | % das `SEED_ROUTES` + rotas mais criadas em `search_alerts` que retornam resultado não-vazio, medido em sandbox antes de contratar |
| Custo por request/contrato | Define o teto de frequência de polling viável | Custo mensal projetado = `price_polling_batch_size` × rotas ativas × polls/dia × preço unitário |
| Rate limit contratado | Define o `price_polling_batch_size` e o intervalo mínimo entre polls | Limite documentado pelo provedor (requests/segundo e/ou requests/mês) |
| Política de cache/redistribuição no contrato (ToS) | GDS tradicionais proíbem cachear preço de venda além de uma janela curta — ver Seção 3 | Ler a cláusula de "cache/display" do contrato antes de implementar, não depois |
| Latência típica de resposta | Afeta o timeout e a experiência da página pública `/voos/[origin]/[destination]` | p50/p95 medido em sandbox |
| Qualidade dos dados (fare rules, bagagem, conexões) | Afeta o quanto o TripScore e a futura "compra por parceiro" (Fase 7) podem confiar no dado | Amostragem manual comparando com o preço real no site da companhia |
| Complexidade de auth/onboarding | Afeta o tempo até o primeiro provedor real em produção | OAuth2 client-credentials (caso Amadeus) é simples; providers com aprovação manual de conta atrasam o roadmap |
| SLA/uptime histórico | Afeta com que frequência o circuit breaker (Seção 4) vai abrir | Status page pública do provedor, se existir |

**Critério de troca/expansão** (quando adicionar um segundo provedor, não só
substituir o primeiro): um provedor entra na composição quando resolve uma
lacuna de cobertura ou custo que o(s) provedor(es) atual(is) não cobre — nunca
"porque existe". A entrada de um segundo provedor é decisão de produto (dado:
% de buscas sem resultado, ou custo/request acima do orçamento), não decisão
técnica isolada.

**O que muda ao trocar de provedor, e o que não muda:**

| Muda | Não muda |
|---|---|
| Nova classe em `providers/infrastructure/<nome>_provider.py` implementando `FlightSearchProvider` | `FlightOffer` (contrato de saída) |
| `flight_provider` em config aponta para o novo | Nenhuma linha em `price_monitoring`, `alerts`, `recommendations` |
| Credenciais novas em Secrets Manager | O worker (`price_polling_worker.py`) — ele só resolve o provider por config |
| Mapeamento de erro específico do provedor (Seção 5) | O modelo `PriceSnapshotModel` (já tem `source_provider: str`, preparado para múltiplos provedores desde o desenho original) |

Isso só é verdade **se** a regra de dependência do §8.1 continuar sendo
respeitada: se algum código futuro importar `amadeus_provider` diretamente em
vez de passar por `FlightSearchProvider`, a troca deixa de ser trivial. Este é
o item de maior risco de erosão arquitetural da Fase 6 e deve ser pego em code
review, não só nesta doc.

---

## 2. Limites de uso e custos por API

Modelo de controle, não valores específicos de contrato (esses variam por
negociação e não pertencem a um doc versionado em git):

- **Orçamento de requests é um recurso do worker, não do provedor.** Hoje
  `price_polling_batch_size` (default 50) já limita quantas rotas o worker
  processa por execução — isso é o ponto de controle certo, só falta ele ser
  também sensível ao limite contratado do provedor ativo.
- Proposta de config nova por provedor (não implementada ainda, é o formato
  esperado):
  ```
  PROVIDER_LIMITS = {
      "amadeus": {"max_requests_per_minute": N, "max_requests_per_month": M},
      "mock":    {"max_requests_per_minute": None, "max_requests_per_month": None},
  }
  ```
  `None` = sem limite (caso do mock). O worker consulta esse limite antes de
  decidir quantas rotas pollar naquela execução — se o limite mensal contratado
  já foi atingido, o worker **não falha**, ele reduz para pollar só as rotas
  com alerta ativo (nunca as `SEED_ROUTES` de SEO), e loga
  `provider_quota_exceeded` em vez de estourar erro.
- **Alarme de custo, não só de erro.** Um circuit breaker (Seção 4) pega falha
  técnica; ele não pega "estamos gastando 3x o projetado porque o número de
  alertas ativos cresceu". Isso precisa de uma métrica própria —
  `provider_requests_total{provider="amadeus"}` contada por dia/mês e comparada
  contra o teto contratado — para o time de produto decidir *antes* de estourar
  a fatura, não depois.
- **Cada provedor novo entra com seu próprio teto configurado desde o commit
  inicial.** Não existe "vamos integrar primeiro e configurar limite depois" —
  isso é exatamente o tipo de decisão que gera custo não planejado.

---

## 3. Políticas de cache e invalidação

Este é o ponto onde a natureza do dado (preço de passagem) importa mais do que
qualquer escolha técnica de cache: **GDS/agregadores tradicionalmente proíbem
em contrato exibir ou reutilizar um preço de "shopping" além de uma janela
curta sem re-verificação**, porque o preço muda em tempo real e uma cotação
velha exibida como válida é, no limite, propaganda enganosa. Isso define a
política, não o inverso.

Dois tipos de dado, duas políticas diferentes:

| Tipo de dado | O que é hoje no código | Política de cache |
|---|---|---|
| **Snapshot de preço monitorado** (o que `price_monitoring` já persiste) | `PriceSnapshotModel`, escrito pelo worker a cada poll, nunca sobrescrito | **Não é cache — é histórico.** Não expira, não é invalidado. É a fonte da página pública de rota e do TripScore. Cada linha já carrega `collected_at`; a "idade" do dado é sempre visível para quem consome (ex.: "preço monitorado pela última vez há 3h"), nunca apresentada como preço de compra garantido. |
| **Resultado de busca ao vivo** (o que uma futura tela de "buscar agora" ou o fluxo de "compra por parceiro" da Fase 7 vai precisar) | Ainda não existe no código | **TTL curto, sim, mas o valor exato é definido pelo contrato de cada provedor, não por uma constante global.** Proposta: `PROVIDER_CACHE_TTL_SECONDS` por provedor em config (ex.: 15–30 min é uma faixa comum entre GDS para *shopping* results, mas o número real vem do contrato assinado, não deste doc). Chave de cache = `(provider, origin, destination, departure_date, return_date, cabin_class, passengers)` — os mesmos parâmetros de `FlightSearchProvider.search()`, para que o cache fique no nível da porta, não dentro de cada implementação. |

**Onde o cache vive:** Redis (`redis_url` já em config, hoje não utilizado — é
exatamente para isso que ele foi provisionado desde a Fase 1, ver
`03-arquitetura.md` §4.1). Um `CachedFlightSearchProvider` que **decora**
qualquer `FlightSearchProvider` (mock, Amadeus, o próximo) é a forma certa de
implementar isso — cache não é responsabilidade do provider concreto, é uma
camada em volta dele. Isso mantém `AmadeusFlightProvider` focado só em falar
com a Amadeus.

**Invalidação:**
- Por TTL (padrão) — nunca "cache eterno até alguém invalidar manualmente".
- Sem invalidação ativa por evento neste momento (não existe hoje nenhum
  webhook de provedor avisando "preço mudou"; se um provedor futuro oferecer
  isso, entra como otimização, não como requisito do MVP da Fase 6).
- **Nunca cachear para o fluxo de compra.** Qualquer tela que redirecione o
  usuário para comprar (Fase 7, "compra por parceiro") deve re-verificar o
  preço direto no provedor antes do redirect — usar um preço cacheado ali é o
  cenário exato que o contrato do provedor proíbe e que quebra a confiança do
  usuário no produto.

---

## 4. Retries, timeouts e circuit breaker

Nenhuma dessas três coisas existe no código hoje. Proposta:

**Timeouts** — dois valores por provedor, não um só (padrão `httpx`):
```
PROVIDER_TIMEOUTS = {
    "amadeus": {"connect_seconds": 3, "read_seconds": 8},
}
```
Timeout de connect curto (a rede não deveria estar lenta para abrir conexão);
timeout de read mais generoso mas finito — o worker roda em lote
(`price_polling_batch_size` rotas por execução) e uma chamada travada não pode
travar o lote inteiro.

**Retries** — via `tenacity` (a adicionar como dependência; não reinventar):
- Só em erros **idempotentes e transitórios**: timeout, `5xx`, erro de conexão.
- **Nunca** retry automático em `4xx` (exceto `429`, tratado como sinal de rate
  limit, não de bug) — um `400` de parâmetro inválido não vira válido tentando
  de novo, e re-tentar mascara um bug de mapeamento de request.
- Backoff exponencial com jitter, máximo 3 tentativas, teto de espera total
  curto o bastante para não estourar o orçamento de tempo de uma execução do
  worker (que processa `price_polling_batch_size` rotas em sequência hoje —
  ver Seção 7 sobre paralelização futura).
- Se o provedor devolver `Retry-After`, respeitar o header em vez do backoff
  calculado.

**Circuit breaker** — por provedor, não global:
- Estado fechado (normal) → abre depois de N falhas consecutivas (proposta:
  5) → em aberto, todas as chamadas falham rápido sem tocar a rede por um
  período de cooldown (proposta: 60s) → half-open, deixa 1 chamada de teste
  passar → fecha se ela for bem-sucedida, reabre se não.
- Efeito prático: se a Amadeus cair, o worker para de martelar uma API fora
  do ar (o que só pioraria a situação e queimaria cota) e cai direto na
  estratégia de fallback (Seção 6) para cada rota daquele lote, em vez de
  gastar o timeout completo por rota.
- Estado do breaker (fechado/aberto/half-open) é logado em toda transição —
  `provider_circuit_breaker_state_changed` — e é a métrica mais importante de
  observar operacionalmente (Seção 8), porque ela é o sinal mais direto de
  "o provedor está com problema" antes que qualquer alerta de usuário dispare.

**Erros de nossa própria validação nunca entram no circuit breaker.** Se
`origin_iata` malformado gerar erro, isso é bug no nosso código chamador, não
falha do provedor — não deve contar para abrir o breaker.

---

## 5. Normalização de dados entre provedores

O contrato de normalização já existe: `FlightOffer`
(`modules/providers/domain/entities.py`). A regra daqui em diante é que **todo
provedor novo mapeia para esse formato dentro da própria classe do provider**
— `price_monitoring`, `alerts` e `recommendations` nunca sabem qual provedor
gerou o dado, exceto pelo campo `source_provider: str` que já existe em
`PriceSnapshot`/`PriceSnapshotModel` especificamente para permitir auditar e
comparar por origem sem vazar o formato bruto de nenhum provedor para cima.

Pontos de atenção específicos ao mapear Amadeus (e qualquer provedor GDS
similar) para `FlightOffer`:

| Divergência entre provedores | Tratamento |
|---|---|
| Moeda de resposta (Amadeus pode responder em EUR/USD dependendo do mercado do endpoint) | Converter para `BRL` no momento da normalização usando a tabela `exchange_rates` já existente no domínio (`modules/price_monitoring`), nunca armazenar preço em moeda estrangeira em `PriceSnapshot` sem converter — o resto do sistema assume `currency` consistente por linha, não faz conversão em leitura |
| Nomenclatura de classe de cabine (varia por provedor: `ECONOMY` vs `Y` vs `economy`) | Mapa fixo por provider, no próprio `<provider>_provider.py`, para o enum `CabinClass` já usado no domínio |
| Conexões/múltiplos trechos | `FlightOffer.stops: int` já é a simplificação adotada — um provedor que devolve o itinerário completo (cada perna, horários, aeroportos de conexão) é **resumido** para esse inteiro na normalização; dado completo de itinerário não é escopo do MVP (é candidato a campo adicional só se um caso de uso concreto precisar, não especulativamente) |
| Ausência de resultado vs erro | Lista vazia (`[]`) de `FlightOffer` para "não há voos nessa rota/data" — isso **não é erro**, não deve acionar retry nem circuit breaker. Erro é só falha em obter resposta, não resposta vazia válida |
| Preço "a partir de" vs preço fechado por assento | `FlightOffer.price_cents` representa a oferta mais barata retornada pelo provedor para aquela busca — se um provedor futuro devolver múltiplas ofertas por busca, `search()` já retorna `list[FlightOffer]`, então isso não exige mudança de contrato, só que o `PollRoutePrice` (que hoje já itera `list[FlightOffer]`) continue escolhendo o menor preço para o snapshot, como já faz |

---

## 6. Tratamento de indisponibilidade e estratégia de fallback

Cadeia de degradação, nesta ordem — cada nível só é tentado se o anterior
falhar, e cada nível é mais "velho"/menos preciso que o anterior, nunca mais
enganoso:

1. **Provedor primário** (Amadeus, via circuit breaker + retry da Seção 4).
2. **Cache** (Seção 3) — só para o fluxo de busca ao vivo, dentro do TTL
   contratualmente permitido. Não se aplica ao worker de polling (que grava
   histórico, não lê cache) nem ao fluxo de compra (nunca cacheado).
3. **Provedor secundário**, se e quando existir um segundo configurado — não
   existe hoje, mas a interface já permite: um `FallbackFlightProvider` que
   recebe uma lista ordenada de `FlightSearchProvider` e tenta cada um até um
   responder, é uma composição, não uma mudança na porta.
4. **Resposta degradada, nunca resposta falsa:**
   - Para o **worker de polling**: se todos os provedores falharem para uma
     rota, a rota simplesmente não gera snapshot naquela execução — o sistema
     já é desenhado para isso (histórico esparso é normal, `GetPriceHistory`
     já lida com janelas de dados incompletas). Não inventar um preço.
   - Para a **página pública de rota** (`/voos/[origin]/[destination]`): já
     existe hoje o padrão certo — `fetchHistorySafely()` no
     `apps/web/src/app/voos/[origin]/[destination]/page.tsx` engole erro e
     cai no empty state "Ainda não monitoramos esta rota" em vez de derrubar a
     página. Esse mesmo princípio (nunca 5xx para o usuário final por causa de
     um provedor terceiro fora do ar) é o que se estende para qualquer tela
     nova que dependa de dado de provedor.
   - Para o **MockProvider**: ele não é só "ambiente de dev" — ele é
     literalmente o último nível de fallback utilizável em produção se
     necessário (ex.: incidente prolongado do provedor real), porque já gera
     preços plausíveis e determinísticos. Usar o mock como fallback de última
     instância em produção deve ser uma decisão explícita e visível (log
     `provider_fallback_to_mock` com nível de alerta, não silencioso), nunca
     um comportamento que passa despercebido — o objetivo é nunca fingir
     silenciosamente que um dado sintético é um dado real de mercado.

**Nunca falhar "para cima" por causa de provedor terceiro** é o princípio que
une esta seção: uma falha de provedor deve, no pior caso, resultar em dado
mais velho ou ausente, nunca em erro 500 exposto ao usuário ou em preço
inventado apresentado como real.

---

## 7. Observabilidade por provedor

Convenção de métricas/logs (nomes propostos, seguindo o padrão `snake_case`
de evento já usado em `price_polling_worker.py`):

- `provider_request_started` / `provider_request_succeeded` /
  `provider_request_failed` — sempre com `provider=`, `route=`, e em caso de
  falha, `error_type=` (timeout | rate_limited | auth_error | validation_error
  | server_error | circuit_open).
- `provider_circuit_breaker_state_changed` — `provider=`, `from_state=`,
  `to_state=`.
- `provider_fallback_used` — `provider_failed=`, `fallback_level=` (cache |
  secondary_provider | mock | none_available).
- `provider_quota_exceeded` — `provider=`, `limit_type=` (per_minute |
  per_month).

Isso é suficiente para responder, sem acessar o provedor externo diretamente:
"quanto está custando", "está degradando", "quantas rotas estão sem dado
fresco agora e por quê". Métricas agregadas (Prometheus/dashboards) são
consumo desses eventos estruturados, não uma segunda fonte de verdade — mantém
consistência com a decisão já tomada em `03-arquitetura.md` de usar
`structlog` como base de observabilidade desde a Fase 1.

---

## 8. Não-escopo explícito (para não superdimensionar a Fase 6)

Para não repetir o erro de construir abstração para um requisito hipotético:

- **Sem agregação/comparação de preço entre múltiplos provedores simultâneos**
  nesta fase — a Fase 6 troca "mock" por "um provedor real", não implementa
  "melhor preço entre N provedores". A interface suporta isso no futuro
  (`list[FlightSearchProvider]`), mas não é construído até haver um segundo
  provedor real contratado.
- **Sem seleção dinâmica de provedor por custo em tempo real** — isso é
  otimização de Fase 7+, depende de dado de uso real que só existe depois do
  primeiro provedor rodar em produção por tempo suficiente.
- **Sem cache distribuído multi-região** — um único Redis (já provisionado)
  é suficiente para o volume atual; reavaliar só se/quando isso virar gargalo
  medido, não antes.

---

## 9. Definition of done da Fase 6 à luz deste documento

A integração com a Amadeus só é considerada pronta quando, além de retornar
dado real:

- [ ] `AmadeusFlightProvider` implementa `FlightSearchProvider` sem que
      nenhum outro módulo precise mudar uma linha.
- [ ] Timeout, retry e circuit breaker configurados e testados com falha
      simulada (não só o caminho feliz).
- [ ] Erro do provedor nunca vira 500 para o usuário final, em nenhuma tela.
- [ ] Métricas da Seção 7 emitindo e visíveis.
- [ ] Limite de uso (Seção 2) configurado com o valor real do contrato antes
      do primeiro deploy em produção, não depois.
- [ ] Fallback para mock em caso de indisponibilidade total é explícito e
      logado, testado manualmente derrubando o acesso à Amadeus em sandbox.
