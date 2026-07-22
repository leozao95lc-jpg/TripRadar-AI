# 2. Análise Crítica, Riscos e Diferenciais

## 2.1 Pontos fortes da ideia

- Mercado validado: Hopper (EUA) e Kayak "Price Forecast" provam que existe demanda
  por recomendação de timing de compra.
- Nicho pouco atendido no Brasil: nenhum player nacional forte combina monitoramento
  contínuo + IA explicável + notificação multicanal (WhatsApp é um baita diferencial
  para o público BR).
- Modelo de receita expansível (passagens → hotéis → seguro → eSIM → afiliados) sem
  precisar reconstruir a base.

## 2.2 Pontos fracos / desafios

- Sem dado histórico próprio no dia 1, a "IA" no início é heurística estatística, não
  machine learning de verdade — isso precisa ser comunicado internamente para não
  prometer mais do que existe.
- Baixa margem em venda de passagem aérea (comissões de 1–5%) — o negócio não se
  sustenta só com isso; precisa da cauda de produtos auxiliares.
- CAC alto em turismo (SEO e conteúdo são o canal mais barato, mas lento).

## 2.3 Riscos técnicos

| Risco | Impacto | Mitigação |
|---|---|---|
| Depender de scraping para preços | Alto (bloqueios, ilegal/ToS, dado instável) | Usar exclusivamente APIs oficiais desde o início (Amadeus Self-Service, Kiwi Tequila, Duffel, Skyscanner via RapidAPI) — nunca scraping, nem para monitoramento nem para emissão |
| Custo de chamadas a APIs GDS | Médio–alto conforme escala | Cache agressivo (Redis), polling escalonado por popularidade da rota (rotas mais buscadas são atualizadas com mais frequência), não fazer polling em tempo real de todo alerta a cada minuto |
| Volume de dados de série histórica | Médio | Usar tabela otimizada para série temporal (ex.: extensão TimescaleDB sobre Postgres) com agregação/rollup diário após N dias, ao invés de manter granularidade fina para sempre |
| Fan-out de notificação (milhões de alertas verificados) | Alto na escala | Arquitetura orientada a eventos/filas desde o design, mesmo rodando em monólito; jobs idempotentes |
| Custo de canais pagos (WhatsApp Business API, SMS) | Médio | E-mail e push no plano free; WhatsApp/Telegram/SMS como diferencial pago (Premium), com orçamento monitorado |
| Falsos positivos da IA ("vale esperar" quando na verdade não cai) | Médio (confiança do usuário) | Sempre expor o racional e o nível de confiança, nunca uma promessa categórica |

## 2.4 Riscos comerciais

- **Concorrência estabelecida** com grande orçamento de marketing (Google, Kayak,
  123Milhas). Estratégia de entrada deve ser nicho + boca a boca + SEO de cauda longa
  ("passagem Florianópolis Madrid barata"), não competir em CAC pago no dia 1.
- **Sazonalidade** de receita (alta em períodos de férias/feriados).
- **Dependência de fornecedor único** de dados/emissão no início — mitigar desenhando
  a camada de integração para múltiplos provedores desde o começo (ver arquitetura),
  mesmo implementando apenas um no MVP.

## 2.5 Riscos regulatórios (⚠️ importantes, leiam antes do roadmap)

- **LGPD**: o produto coleta dados pessoais sensíveis o suficiente (preferências de
  viagem, e-mail, telefone, e futuramente dados de pagamento/documento para emissão).
  Necessário: base legal clara, política de privacidade, consentimento granular por
  canal de notificação, direito de exclusão de conta, minimização de dados
  (não armazenar dado de cartão — delegar a um gateway PCI-compliant).
- **Venda de passagens aéreas no Brasil**: para emitir bilhetes como agência é
  necessário registro CADASTUR e, tipicamente, acreditação IATA (ou operar via um
  **consolidador/parceiro já acreditado**, que é o caminho mais rápido).
  **⚠️ Decisão pendente:** no lançamento, o TripRadar deve (a) redirecionar a compra
  para um parceiro/agência já licenciada (mais simples, sem risco regulatório, receita
  via comissão de afiliado) ou (b) buscar acreditação própria (mais lento, mais
  margem no longo prazo)? A recomendação deste documento é **(a) no MVP/Beta**, e
  avaliar **(b)** apenas na fase de Escala.
- **PCI-DSS**: se em algum momento o TripRadar processar pagamento diretamente (ex.:
  assinatura Premium), usar um gateway terceirizado (Stripe, Pagar.me) que absorve o
  escopo de PCI — nunca armazenar dado de cartão em banco próprio.
- **Publicidade de preço**: preços exibidos precisam refletir o valor real
  praticável (evitar prática de preço "isca"), especialmente relevante se a plataforma
  algum dia veicular anúncios de tarifas.
- **Termos de uso de terceiros**: qualquer integração (Google Flights, Skyscanner,
  etc.) precisa respeitar os ToS — de novo, reforça a decisão de usar APIs oficiais.

## 2.6 Diferenciais competitivos a priorizar

1. **IA explicável**: toda recomendação vem com o "porquê" (dado histórico citado),
   nunca uma caixa-preta.
2. **Notificação onde o brasileiro está**: WhatsApp como canal Premium é um
   diferencial forte frente aos concorrentes globais.
3. **Flexibilidade de busca real**: múltiplos aeroportos de origem/destino e
   datas flexíveis, tratados como cidadãos de primeira classe no modelo de dados
   (não um "extra" gambiarrado depois).
4. **Transparência de histórico**: gráficos de preço honestos (min/médio/máx),
   inclusive quando a recomendação for "não compre ainda".
5. **Roadmap de expansão natural**: um único perfil de viagem do usuário
   (origem/destino/datas favoritas) alimenta cross-sell de hotel, carro, seguro e
   eSIM sem re-cadastro.
