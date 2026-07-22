# TripRadar AI — Documentação de Planejamento e Arquitetura

Este diretório contém a análise completa do produto **antes** de qualquer linha de
código de implementação, conforme solicitado: primeiro entender o problema, os
riscos e o desenho técnico; só então construir.

## Índice

1. [Visão geral, público e proposta de valor](00-visao-geral.md)
2. [Análise crítica, riscos e diferenciais competitivos](01-analise-e-riscos.md)
3. [MVP e roadmap por fases](02-mvp-roadmap.md)
4. [Arquitetura do sistema e decisões técnicas](03-arquitetura.md)
5. [Modelo de dados](04-modelo-dados.md)
6. [Design de APIs](05-apis.md)
7. [Diagramas de arquitetura](06-diagramas.md)
8. [Estrutura de pastas do projeto](07-estrutura-projeto.md)
9. [Revisão estratégica — diferenciação para a América Latina](08-revisao-estrategica-latam.md)

## Como ler isso

Cada documento termina com as decisões que ficaram em aberto ou que dependem de uma
escolha de negócio (ex.: emitir passagem própria vs. redirecionar para parceiro).
Essas decisões estão marcadas com **⚠️ Decisão pendente**. A implementação só deve
começar depois que este conjunto de documentos for revisado e essas decisões,
resolvidas.

## Resumo executivo

- **O que é:** um "Google Flights com memória e opinião" — monitora rotas, aprende o
  padrão histórico de preço e recomenda quando comprar, com explicação.
- **Maior risco não técnico:** vender passagem exige ser agência de viagens
  licenciada (CADASTUR) ou operar por trás de um parceiro/GDS habilitado — isso não é
  trivial e não deve bloquear o lançamento do produto de monitoramento.
- **Maior risco técnico:** depender de scraping para dados de preço é frágil e viola
  termos de uso dos motores de busca; o produto precisa nascer sobre APIs oficiais
  (Amadeus, Duffel, Kiwi Tequila), mesmo que isso limite o volume de buscas no início.
- **MVP recomendado:** monitoramento de preço + alertas por e-mail **e WhatsApp**,
  consultor de milhas-lite, sinal de câmbio e feed público de ofertas para SEO — sem
  compra integrada e sem cobrança. O core de monitoramento continua enxuto; o que
  muda é o canal (WhatsApp) e o contexto (milhas, câmbio) que já nascem pensados
  para o viajante latino-americano, sem inflar custo (ver
  [`08-revisao-estrategica-latam.md`](08-revisao-estrategica-latam.md)).
- **Ambição de longo prazo:** ser a plataforma de referência de descoberta,
  monitoramento e compra inteligente de viagens da América Latina — competindo não
  em cobertura de busca (onde Google Flights/Kayak/Skyscanner já vencem), mas em
  inteligência de compra localizada, confiança e canal nativo (WhatsApp), pontos
  estruturalmente fracos dos concorrentes globais e da Decolar.
