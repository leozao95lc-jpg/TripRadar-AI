# Coisas normais no Brasil que na Espanha são estranhas 🇧🇷🇪🇸

Reel vertical de 55 s (1080×1920, 30 fps) feito 100% em código: as ilustrações vetoriais, as animações, a tipografia, as legendas, a trilha e os efeitos sonoros. Cada quadro é uma função do tempo, então o mesmo projeto roda **no navegador** (player) e **renderiza o MP4** quadro a quadro.

## Como gerar

```bash
pip install numpy                     # áudio
python3 tools/build_timeline.py       # cronograma -> js/timeline.js + legendas.srt
python3 tools/audio.py                # trilha + efeitos + mix -> audio/mix.wav (+ stems)
node tools/render.js                  # -> output/brasil-espanha.mp4 (precisa de playwright + ffmpeg)
node tools/render.js --stills 2.9,18  # quadros avulsos para revisão em output/stills/
```

Player: sirva a pasta (`python3 -m http.server`) e abra `index.html`. Ele tem play/scrub, uma sobreposição das zonas seguras do Instagram e exportação em WebM direto do navegador (tempo real).

**Configuração de exportação:** H.264 High, yuv420p, CRF 19 com teto de 9 Mbps, 30 fps; áudio AAC 192 kbps 48 kHz, normalizado para −14 LUFS / −1,5 dBTP.

## Estrutura

| Arquivo | Função |
|---|---|
| `tools/narracao.json` | Texto falado (`tts`) e texto da legenda (`cap`) de cada fala |
| `tools/build_timeline.py` | **Fonte da verdade do tempo**: janelas das cenas, início das falas, efeitos sonoros. Mexeu aqui, vídeo, áudio e SRT acompanham |
| `js/engine.js` | Easing, câmera virtual, bandeiras, personagens, ícones, transições, granulação |
| `js/scenes.js` | As 8 cenas (câmera, cenário, camada de títulos) |
| `js/main.js` | Compositor: transições, indicador 1/6…6/6, legendas sincronizadas |
| `audio/narracao/*.wav` | Narração por frase (TTS offline) |
| `legendas.srt` | Legendas sincronizadas (39 blocos) |

## Cenas e tempos

| # | Tempo | Tópico | Texto na tela |
|---|---|---|---|
| 1 | 0,0–3,5 | Gancho | NO BRASIL 🇧🇷 NORMAL / NA ESPANHA 🇪🇸 ESTRANHO? |
| 2 | 3,5–11,0 | Escova no trabalho | ESCOVAR OS DENTES NO TRABALHO 🪥 |
| 3 | 11,0–17,0 | Papel no vaso | PAPEL NO VASO OU NO LIXO? |
| 4 | 17,0–24,4 | 10x sem juros | 10X SEM JUROS? 🇧🇷 / PREÇO INTEGRAL? 🇪🇸 |
| 5 | 24,4–31,0 | Empacotar | VOCÊ EMPACOTA 🛒 / E PAGA PELA SACOLA |
| 6 | 31,0–39,6 | Jantar | JANTAR ÀS 19H? 😳 / AQUI, MAIS TARDE! |
| 7 | 39,6–45,8 | Domingo | ESQUECEU NO SÁBADO? / BOA SORTE NO DOMINGO 😅 |
| 8 | 45,8–55,0 | CTA | QUAL TE PEGARIA PRIMEIRO? / CONTA AÍ NOS COMENTÁRIOS 👇 |

## Roteiro de locução (para regravar com voz humana)

A narração atual é uma voz sintética offline de baixa qualidade e funciona como **guia de tempo**. Para publicar, o recomendado é regravar com a sua voz: grave cada frase em um arquivo, com o mesmo nome, em `audio/narracao/` e rode `build_timeline.py` → `audio.py` → `render.js`. As legendas se ajustam à duração real de cada frase.

```
s1a  Se você fizer isso na Espanha, vão te olhar torto.
s2a  No Brasil é normal.
s2b  Aqui, se você aparece com a escova no banheiro do escritório, vira assunto.
s3a  Aqui o papel vai no vaso.
s3b  O lixinho do lado? Quase não existe.
s4a  Tênis em dez vezes sem juros?
s4b  Aqui isso praticamente não existe. Ou você paga, ou não leva.
s5a  No caixa ninguém te ajuda.
s5b  E a sacola você paga.
s6a  Aqui às dezenove horas você ainda está lanchando.
s6b  Jantar é às vinte e uma, vinte e duas horas.
s7a  Domingo grande parte do comércio fecha.
s7b  Esqueceu de comprar no sábado? Problema seu.
s8a  Qual dessas te pegaria primeiro? Comenta aí.
s8b  E se você mora fora, conta o que te deixou chocado.
```

Se uma frase regravada ficar mais longa que a janela da cena, ajuste `STARTS`/`SCENES` em `tools/build_timeline.py`.

## Trocar as ilustrações por fotos de IA (opcional)

Salve a imagem como `assets/ai/<chave>.jpg` (1080×1920) e adicione a chave em `js/ai_images.js`. Ela substitui o cenário ilustrado daquela cena com movimento Ken Burns, e os títulos, legendas e transições continuam por cima. Prompts sugeridos (Midjourney/Ideogram/Flux, `--ar 9:16`):

- **gancho**: *Editorial street photo in a sunny Spanish old-town street with ochre facades and iron balconies, a smiling Brazilian man in a green t-shirt holding a toothbrush, two locals nearby glancing at him with mild amused surprise, natural expressions, 35mm, warm light, vertical composition, no text*
- **escova**: *Modern office restroom, a man in a light-blue shirt with a lanyard brushing his teeth at the mirror, a female colleague entering the door and glancing with discreet amused surprise, clean editorial photography, soft daylight, vertical, no text*
- **papel**: *Clean contemporary Spanish bathroom, white toilet with toilet paper holder on the wall, no trash bin next to the toilet, minimal, bright, editorial interior photo, vertical, no text*
- **parcelado**: *Contemporary sneaker store, a single colorful sneaker on a round display podium under a spotlight, shelves of sneakers blurred in the background, vertical, no text, no logos*
- **sacola**: *Modern Spanish supermarket checkout, a customer packing groceries into his own reusable bag at the end of the conveyor belt, cashier scanning, short queue behind, realistic, natural, vertical, no text*
- **jantar**: *Spanish street terrace at dusk, string lights turning on, people starting to arrive at restaurant tables, warm tones, blue hour sky, vertical, no text*
- **domingo**: *Spanish neighborhood shopping street on a Sunday, several small shops with metal shutters down, one shop still lit, a man looking at his watch with a light frustrated expression, vertical, no text*

Revise sempre mãos, rostos e textos gerados pela IA antes de publicar.

## Legenda sugerida para o post

> Qual dessas te pegaria primeiro? 👇 Comenta o número (1 a 6)!
> Se você mora fora, conta o que mais te chocou 🇧🇷🇪🇸
>
> #brasileirosnaespanha #morarnaespanha #vidanaespanha #espanha #brasileirosnoexterior #choquecultural #intercambio #imigração

## Créditos e licenças

- Fontes: Anton e Montserrat (SIL Open Font License, Google Fonts), incluídas em `assets/fonts/`.
- Voz sintética: Piper TTS, voz `pt-br-edresson-low`, treinada no [TTS-Portuguese-Corpus](https://github.com/Edresson/TTS-Portuguese-Corpus) (CC BY 4.0). Se publicar com essa voz, mantenha o crédito.
- Trilha e efeitos: sintetizados por `tools/audio.py`, originais deste projeto.
