# De Mala y Cuia — Central digital

Página única (link da bio) do Leonardo e da Marcelly. HTML/CSS/JS puros, sem build,
sem banco de dados, ~40 KB + fontes.

```
sites/demalaycuia/
├── index.html        estrutura + biblioteca de ícones (SVG)
├── style.css         identidade visual (cores oficiais em :root)
├── config.js         ← ÚNICO ARQUIVO DO DIA A DIA: links, cards, redes, GA4
├── script.js         renderização, UTM e eventos de analytics
├── netlify.toml      cabeçalhos de segurança e cache
├── _redirects        links curtos /leo e /marcelly (com UTM)
├── robots.txt
└── assets/img/       logo, favicon, ícone iOS, imagem de compartilhamento
```

## 1. Testar localmente
```bash
cd sites/demalaycuia
python3 -m http.server 8000
```
Abra http://localhost:8000. Para simular a bio da Marcelly:
http://localhost:8000/?utm_source=instagram&utm_medium=bio&utm_campaign=marcelly

## 2. Publicar no Netlify (grátis)
**Opção rápida:** app.netlify.com → *Add new site → Deploy manually* → arraste a pasta `demalaycuia`.

**Opção recomendada (atualiza sozinho a cada commit):** *Add new site → Import from Git* →
escolha o repositório → **Base directory:** `sites/demalaycuia` → **Build command:** vazio →
**Publish directory:** `sites/demalaycuia` → Deploy.

Depois: *Site configuration → Change site name* (ex.: `demalaycuia` → `demalaycuia.netlify.app`).

**Domínio próprio:** *Domain management → Add a domain* → siga o DNS indicado (HTTPS é automático).
Em seguida troque `https://demalaycuia.netlify.app/` em `index.html` (canonical e og:*) pelo domínio novo.

## 3. Atualizar os links
Em `config.js`, substitua todo valor `PREENCHER_...` pela URL real (sempre começando com `https://`).
- URL inválida/vazia em card ativo → o card aparece como **Em breve** (nunca link quebrado).
- URL inválida em rede social → a rede não aparece.

**Links para as bios:**
- Leonardo: `https://SEU-SITE/leo`
- Marcelly: `https://SEU-SITE/marcelly`

(redirecionam com a UTM correta — ver `_redirects`).

## 4. Adicionar um card
Copie um objeto de `resources` em `config.js`, cole no fim da lista e ajuste. Exemplo:
```js
{
  id: "planilha-custo-de-vida",          // único, sem espaços
  title: "Planilha de custo de vida",
  description: "Compare aluguel, mercado e transporte entre cidades.",
  icon: "sheet",                          // youtube, book, calculator, instagram, play, map, sheet, chat, plane, tag, star, link
  url: "https://...",
  cta: "Baixar planilha",
  category: "produto",                    // conteudo | produto | ferramenta | servico | parceria
  type: "guide",
  order: 40,                              // menor = mais acima
  status: "active",                       // active | soon | disabled
  featured: false,                        // destaque laranja (máx. 1–2)
  badge: "Grátis",                        // opcional
  newTab: true,
  utm: true,                              // acrescenta UTM no link de saída
},
```
Nova categoria: adicione em `categories`. Quando passar de ~6 cards, mude `site.layout` para `"category"`.
Novo ícone: adicione um `<symbol id="i-NOME">` no sprite do `index.html`.

## 5. Mudar status
`status: "soon"` → visual tracejado, selo EM BREVE, não clicável (mas o clique é medido como interesse).
`status: "active"` + `url` válida → card clicável.
`status: "disabled"` → some da página sem apagar a configuração.

**Lançar a calculadora:** preencha `url` e mude `status` para `"active"`.

## 6. Inserir o logotipo
Salve o arquivo em `assets/img/logo-demalaycuia.svg` e em `config.js`:
`logo: "assets/img/logo-demalaycuia.svg"`. Se o arquivo falhar, o logotipo textual permanece.
Troque também `favicon.svg`, `apple-touch-icon.png` (180×180) e `og-image.png` (1200×630).

## 7. Google Analytics 4
1. Crie a propriedade GA4 → *Fluxo de dados Web* → copie o ID `G-XXXXXXXXXX`.
2. Cole em `config.js → analytics.ga4Id`. Pronto: o script só carrega se houver ID.
3. GA4 → *Administrador → Definições personalizadas* → crie dimensões de evento:
   `origin_profile`, `resource_id`, `resource_category`, `resource_type`, `social_profile`.
4. Marque `resource_click` como **evento-chave** (conversão).

| Evento | Quando | Responde |
|---|---|---|
| `bio_visit` (+ page_view automático) | abertura da página | acessos totais e por perfil |
| `resource_click` | clique em card ativo | cliques por card, e-book, YouTube, calculadora |
| `resource_interest` | clique em card "Em breve" | demanda antes do lançamento |
| `social_click` | clique em rede social | tráfego para cada perfil |

Todos os eventos levam `origin_profile` (`leonardo`, `marcelly`, `instagram_sem_utm`, `direto`, `outro`).
Para depurar: `analytics.debug: true` e abra o console do navegador.
