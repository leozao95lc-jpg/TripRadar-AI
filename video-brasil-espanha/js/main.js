// Compositor: escolhe a cena pelo tempo, aplica câmera, transições, legendas e acabamento.
'use strict';

const TRANS = 0.42; // duração da transição entre cenas (s)
const HIGHLIGHT = /^(espanha|torto|normal|escova|escritório|assunto|vaso|lixinho|existe|10x|juros|paga|leva|caixa|ninguém|sacola|19h|lanchando|jantar|21h|22h|domingo|fecha|sábado|problema|primeiro|comenta|chocado)$/i;
const PLATES = {}; // imagens de IA opcionais (assets/ai/<chave>.jpg)

function loadPlates() {
  const list = window.AI_IMAGES || [];
  return Promise.all(list.map(key => new Promise(res => {
    const img = new Image(); img.onload = () => { PLATES[key] = img; res(); }; img.onerror = () => res();
    img.src = `assets/ai/${key}.jpg`;
  })));
}

function sceneAt(t) {
  const S = TL.scenes;
  for (let i = 0; i < S.length; i++) if (t < S[i].end || i === S.length - 1) return i;
  return S.length - 1;
}

function drawPlate(ctx, img, lt, D) {
  const k = lt / D, z = 1.04 + k * 0.1;
  const s = Math.max(W / img.width, H / img.height) * z;
  ctx.drawImage(img, W / 2 - img.width * s / 2 + Math.sin(k * 2) * 20, H / 2 - img.height * s / 2, img.width * s, img.height * s);
  ctx.fillStyle = vgrad(ctx, 0, H, [[0, 'rgba(0,0,0,0.45)'], [0.35, 'rgba(0,0,0,0)'], [0.7, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
  ctx.fillRect(0, 0, W, H);
}

function drawScene(ctx, i, t) {
  const sc = TL.scenes[i], def = SCENE_DEFS[sc.key];
  const lt = t - sc.start, D = sc.end - sc.start;
  ctx.save();
  if (PLATES[sc.key]) drawPlate(ctx, PLATES[sc.key], lt, D);
  else {
    const [cx, cy, z] = def.cam(lt);
    camera(ctx, cx, cy, z);
    def.world(ctx, lt, D, t);
  }
  ctx.restore();
  ctx.save(); def.ui(ctx, lt, D, t); ctx.restore();
}

function topicChip(ctx, t) {
  const i = sceneAt(t), n = TL.scenes[i].n;
  if (n < 2 || n > 7) return;
  const lt = t - TL.scenes[i].start, k = E.outBack(prog(lt, 0.1, 0.4));
  // barra de progresso de 6 segmentos
  for (let j = 0; j < 6; j++) {
    const x = 300 + j * 82, done = j < n - 2, cur = j === n - 2;
    fillRR(ctx, x, 196, 70, 10, 5, 'rgba(255,255,255,0.35)');
    if (done || cur) fillRR(ctx, x, 196, 70 * (done ? 1 : clamp(lt / (TL.scenes[i].end - TL.scenes[i].start))), 10, 5, C.accent);
  }
  withT(ctx, 200, 201, k, 0, () => {
    softShadow(ctx, 10, 4, 0.3); fillRR(ctx, -74, -30, 148, 60, 30, C.ink); noShadow(ctx);
    ctx.font = `44px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.accent; ctx.fillText(`${n - 1}/6`, 0, 3);
  });
}

function captions(ctx, t) {
  const c = TL.captions.find(c => t >= c.t0 && t < c.t1);
  if (!c) return;
  const k = E.outBack(prog(t, c.t0, c.t0 + 0.14));
  const size = 60, y = 1470;
  ctx.save();
  ctx.font = `800 ${size}px ${FONT_BODY}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  const words = c.text.split(' '), space = ctx.measureText(' ').width;
  let total = words.reduce((a, w) => a + ctx.measureText(w).width, 0) + space * (words.length - 1);
  const sc = Math.min(1, 940 / total);
  ctx.translate(W / 2, y); ctx.scale(k * sc, k * sc);
  // fundo suave para legibilidade
  ctx.fillStyle = 'rgba(10,10,14,0.55)'; rr(ctx, -total / 2 - 30, -size * 0.78, total + 60, size * 1.56, 22); ctx.fill();
  let x = -total / 2;
  for (const w of words) {
    const clean = w.replace(/[,.?!…]/g, '');
    ctx.lineWidth = 12; ctx.strokeStyle = C.ink; ctx.strokeText(w, x, 4);
    ctx.fillStyle = HIGHLIGHT.test(clean) ? C.accent : '#fff'; ctx.fillText(w, x, 4);
    x += ctx.measureText(w).width + space;
  }
  ctx.restore();
}

function renderAt(ctx, t) {
  t = clamp(t, 0, TL.duration - 1e-3);
  ctx.save();
  ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
  const i = sceneAt(t);
  // transições: centradas em cada fronteira de cena
  let wipe = -1;
  for (let j = 1; j < TL.scenes.length; j++) {
    const b = TL.scenes[j].start;
    if (Math.abs(t - b) < TRANS / 2) wipe = (t - (b - TRANS / 2)) / TRANS;
  }
  drawScene(ctx, i, t);
  vignette(ctx, 0.38);
  topicChip(ctx, t);
  captions(ctx, t);
  if (wipe >= 0) bandWipe(ctx, wipe, (i % 2) ? 1 : -1);
  grain(ctx, t, 0.06);
  ctx.restore();
}

window.VIDEO = { renderAt, loadPlates, TL: () => TL };
