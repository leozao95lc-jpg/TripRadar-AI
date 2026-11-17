# Eleições antecipadas na Espanha — Reel de 29,5 s

Vertical 1080×1920, 30 fps, com narração, legendas, trilha e efeitos. Este projeto usa o mesmo motor de `../video-brasil-espanha` (veja o README de lá para os detalhes técnicos).

```bash
python3 tools/build_timeline.py && python3 tools/audio.py && node tools/render.js   # -> output/eleicoes-espanha.mp4
python3 tools/import_voz.py audio/fonte/VOZ.mp3    # trocar a narração (ajuste a tabela CUTS)
```

## Roteiro

| Cena | Tempo | Fala |
|---|---|---|
| Gancho | 0–3,2 | A Espanha vai às urnas antes da hora. |
| Data | 3,2–9,4 | Dia 29 de novembro, os espanhóis escolhem 350 deputados. |
| Motivo | 9,4–16,6 | Tudo porque o Congresso derrubou os decretos de moradia de Sánchez. / Era pra ser só em 2027. |
| Maioria | 16,6–21,6 | Pra governar: 176 cadeiras. Ou alianças. |
| Quem vota | 21,6–25,6 | E atenção: sem nacionalidade espanhola, você não vota. |
| CTA | 25,6–29,5 | Muda alguma coisa? Comenta aí. |

## Checagem dos fatos (consultado em 17/11/2026)

- A antecipação foi anunciada por Pedro Sánchez em 5/10/2026, depois que o Congresso rejeitou dois decretos de moradia. Junts, PP e Vox votaram contra. Fontes: [Al Jazeera](https://www.aljazeera.com/news/2026/10/5/spanish-prime-minister-pedro-sanchez-announces-snap-election) e [IMI Daily](https://www.imidaily.com/europe/spain-to-hold-snap-election-on-november-29-after-congress-rejects-housing-decrees/).
- As Cortes foram dissolvidas em 6/10/2026, por decreto publicado no BOE. A votação é em 29/11/2026, e estão em jogo as 350 cadeiras do Congresso. Fonte: [Wikipedia](https://en.wikipedia.org/wiki/2026_Spanish_general_election).
- A eleição estava prevista para 2027. Fontes: [La Jornada](https://www.jornada.com.mx/2026/10/06/mundo/020n1mun) e [Chequeado](https://chequeado.com/el-explicador/elecciones-anticipadas-en-espana-2026-todo-lo-que-tenes-que-saber-sobre-los-comicios-para-definir-el-nuevo-gobierno/).
- A maioria absoluta é de 176 das 350 cadeiras.
- Nas eleições gerais só votam cidadãos espanhóis (LOREG). Estrangeiros residentes podem votar apenas em eleições municipais, e só quando há acordo de reciprocidade com o país de origem.

O vídeo não traz pesquisas nem projeções, que mudam toda semana e deixariam o conteúdo desatualizado em poucos dias.

Narração: Piper TTS, voz `pt-br-edresson-low` (CC BY 4.0), usada como guia. Para publicar, troque por uma voz humana ou do ElevenLabs.
