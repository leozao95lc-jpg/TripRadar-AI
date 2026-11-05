# MailerLite: entrega automática do capítulo 9

O lead entra pela calculadora, cai num grupo do MailerLite e uma automação envia o capítulo na hora.
A página não guarda nenhuma chave de API: ela usa o mesmo envio do formulário incorporado do MailerLite.

## 1. Subir o PDF
*Content* (ou *Sites*) → **File manager** → envie `Cafe_com_Imigracao_amostra_capitulo9.pdf` e copie o link.
Não anexe o PDF ao e-mail: anexos derrubam a entrega e o MailerLite não envia anexos. Use um botão com o link.

## 2. Grupo
*Subscribers* → *Groups* → crie **Amostra Café com Imigração – Cap. 9**.

## 3. Formulário
*Forms* → *Embedded forms* → crie **Calculadora – Cap. 9**:
- Campos: **Email** (obrigatório), **Name** e **Phone** (opcionais).
- Grupo: o do passo 2.
- **Double opt-in: desligado.** O consentimento já está na calculadora, e o e-mail de confirmação faz perder de 20% a 30% dos leads. Se preferir ligar, o capítulo só sai depois da confirmação.
- Salve, abra **Embed form → HTML code** e procure:
  `action="https://assets.mailerlite.com/jsonp/ACCOUNT_ID/forms/FORM_ID/subscribe"`
- Copie os dois números para `config.js`:

```js
MAILERLITE_ACCOUNT_ID: "123456",
MAILERLITE_FORM_ID: "987654321098765432",
HOTMART_URL: "https://...", // opcional
```

**Opcional (segmentação):** crie em *Subscribers → Fields* os campos `cidade`, `moradia`, `cenario` e `custo_mensal_eur` (texto). Depois ative-os em `MAILERLITE_CAMPOS_EXTRAS`. Com isso dá para mandar conteúdo diferente para quem planeja quarto em Valência e para quem planeja apartamento em Madri.

## 4. Automação
*Automations* → *Create* → gatilho **When subscriber joins a group** → grupo do passo 2 → ação **Email** (envio imediato).

### E-mail 1 (imediato): entrega

**Assunto:** Seu capítulo 9: moradia sem cair em golpe
**Pré-cabeçalho:** Os 4 cuidados que fizeram a gente pegar a chave no 3º dia em Valência

> Oi, {$name|default:'tudo bem'}!
>
> Aqui está o seu capítulo do Café com Imigração, completo e de graça:
>
> **[ Baixar o capítulo 9 (PDF) ]**
>
> De tudo o que a gente planejou, a moradia era o que mais tirava o nosso sono. No fim, pegamos a chave no terceiro dia em Valência, sem perder um centavo para golpista. No capítulo você encontra:
>
> - os 4 cuidados que protegeram a gente (e por que o segredo é fazer todos juntos);
> - quanto pagamos para entrar no quarto, com comprovante: € 1.503, dos quais € 680 voltam;
> - a conta do Airbnb que erramos por pouco, e como não repetir;
> - as cláusulas do contrato que mais pesam no bolso;
> - um checklist de 16 itens para usar antes de pagar qualquer coisa.
>
> Uma dica antes de abrir: pergunte se a reserva é descontada do primeiro aluguel. A nossa não foi.
>
> Um abraço,
> Marcelly e Léo · De Mala y Cuia

### E-mail 2 (2 dias depois): oferta do e-book

**Assunto:** O que veio depois da chave na mão
**Pré-cabeçalho:** R$ 50.254, do primeiro documento ao quarto montado

> Oi, {$name|default:'tudo bem'}!
>
> O capítulo 9 é um pedaço da nossa mudança. No Café com Imigração completo estão os outros 13: a estancia por estudos para o casal, os documentos em 9 dias úteis, o câmbio que realmente pesou e quanto gastamos de verdade (R$ 50.254, tudo com comprovante).
>
> De bônus, a planilha do Léo para calcular quantos meses o seu dinheiro aguenta.
>
> **[ Conhecer o e-book completo, R$ 97 ]**
> 15 dias de garantia pela Hotmart.
>
> Marcelly e Léo

## 5. Teste antes de divulgar
1. Publique a calculadora e cadastre um e-mail seu.
2. Confira se o assinante entrou no grupo e se o e-mail 1 chegou (veja também Spam e Promoções).
3. Clique no link do PDF pelo celular.

Se o cadastro mostrar "Não conseguimos enviar agora", confira os dois IDs no `config.js` e se o formulário está publicado no MailerLite.
