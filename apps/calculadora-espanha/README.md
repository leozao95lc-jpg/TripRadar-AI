# Calculadora de Imigração — Brasil para Espanha (De Mala y Cuia)

Aplicação web estática: HTML + CSS + JavaScript puro. Sem build, sem dependências, sem banco de dados.
Nenhum dado do usuário é salvo (sem cookies, sem localStorage, sem envio para servidor).

## Arquivos

| Arquivo      | O que editar ali |
|--------------|------------------|
| `config.js`  | Links do Instagram/YouTube, link público, cotação inicial, valores padrão |
| `app.js`     | Lista `CAMPOS` (adicionar/remover/renomear itens de custo) e a lógica de cálculo |
| `styles.css` | Cores da marca (variáveis no topo), fontes e layout |
| `index.html` | Textos fixos, etapas 1 e 4, rodapé |

## Regras de cálculo

- Etapa 2 em **R$**, etapas 3 e 4 em **€**. Tudo é convertido para R$ pela cotação antes de somar.
- Itens "por pessoa" são multiplicados pelo nº de pessoas (o usuário pode trocar entre total e por pessoa).
- Bagagem = custo por mala × malas por pessoa × pessoas.
- Reserva = meses × gasto mensal do grupo (somada uma única vez).
- Margem opcional (0/5/10/15%) aplicada sobre o subtotal.
- Total em € = total em R$ ÷ cotação.

## Publicar (link público para a bio)

Qualquer hospedagem estática serve. As mais simples:

1. **Netlify Drop**: arraste a pasta `calculadora-espanha` em https://app.netlify.com/drop e você recebe um link na hora.
2. **Vercel**: importe o repositório e defina *Root Directory* = `apps/calculadora-espanha`, sem comando de build.
3. **GitHub Pages**: copie a pasta para um repositório próprio e ative Pages (branch `main`, pasta raiz).

Depois de publicar, preencha `APP_URL` em `config.js` com o link final (ele vai no texto compartilhado).

## Testar localmente

Abra `index.html` no navegador, ou rode `python3 -m http.server` dentro da pasta.
