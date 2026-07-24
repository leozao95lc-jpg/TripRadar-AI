# 1. Visão Geral

## 1.1 Proposta de valor

> "Você não precisa ficar comparando preços todo dia. O TripRadar observa a rota por
> você, entende se o preço atual é bom pelo histórico dela, e te avisa — com o
> motivo — na hora certa de comprar."

O diferencial não é a busca (isso todo metabuscador faz), é a **camada de
inteligência sobre o tempo**: histórico, sazonalidade e explicação em linguagem
natural do porquê comprar agora ou esperar.

> **Atualização (decisão registrada em `12-fase7-decisoes-pendentes.md` §8):** a
> ambição de longo prazo do produto deixou de ser só "monitor de preço de
> passagem" e passa a ser um **assistente de custo total da viagem** — passagem
> continua sendo o núcleo e a porta de entrada, mas hotel, seguro, milhas e
> câmbio deixam de ser cross-sells desconexos e passam a ser lidos como facetas
> da mesma pergunta ("quanto esta viagem custa, e onde dá pra economizar"). Isso
> não muda o MVP nem antecipa nenhuma implementação nova — é a lente para
> decisões de produto futuras, detalhada no documento referenciado.

## 1.2 Público-alvo e personas

| Persona | Necessidade principal | Como o produto atende |
|---|---|---|
| **Viajante ocasional** (família planejando férias) | Não quer pagar caro nem ficar checando preço todo dia | Alerta passivo com preço-alvo |
| **Intercambista** | Precisa de datas flexíveis e passagem de ida (ou multidestino) e é sensível a preço | Busca flexível, múltiplos aeroportos de origem/destino |
| **Nômade digital / viajante frequente** | Quer decidir rápido, valoriza dados e comparação entre aeroportos alternativos | Dashboard com histórico rico, comparação de aeroportos, Premium |
| **Caçador de promoção** | Quer ser o primeiro a saber de uma queda de preço | Notificação instantânea (WhatsApp/Telegram/push) |
| **Brasileiro viajando ao exterior** | Preço em BRL, sensibilidade a variação cambial, milhas de programas nacionais (Smiles, Latam Pass, TudoAzul) | Precificação em BRL, futura integração com programas de milhas |

## 1.3 Concorrência e posicionamento

| Concorrente | O que faz bem | Onde o TripRadar se diferencia |
|---|---|---|
| Google Flights | Busca rápida, "acompanhar preço" simples | IA explicável, alertas multi-canal, histórico profundo, foco Brasil |
| Skyscanner / Kayak | Cobertura ampla de OTAs | Monitoramento contínuo + recomendação, não só comparação pontual |
| 123Milhas / MaxMilhas | Forte no público BR, milhas | UX moderna, transparência de dados, IA de timing de compra |
| Hopper | IA de previsão de preço, "watch" e congelamento de preço | Hopper é a referência mais próxima globalmente — precisamos superá-lo em explicabilidade e em foco no mercado brasileiro (BRL, companhias e feriados locais) |

**Não copiar**: o visual deve se inspirar em Google Flights (clareza), Airbnb
(confiança/fotografia), Stripe/Linear (precisão e velocidade percebida) e Notion
(hierarquia de informação), mas com identidade visual própria.

## 1.4 O que o produto NÃO é (no lançamento)

- Não é uma agência de viagens full-service no dia 1 (ver riscos regulatórios em
  `01-analise-e-riscos.md`).
- Não faz scraping de resultados de busca de terceiros.
- Não promete "prever o futuro" — a IA explica probabilidade com base em histórico,
  nunca garante queda de preço.
