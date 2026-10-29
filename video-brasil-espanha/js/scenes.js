// As 8 cenas. Cada cena = { cam(lt) -> [cx, cy, zoom, rot], world(ctx, lt, D, t), ui(ctx, lt, D, t) }
// world é desenhado sob a câmera virtual; ui em coordenadas de tela (títulos, selos).
// Se existir uma imagem de IA em assets/ai/<chave>.jpg (ver js/ai_images.js), ela substitui o "world".
'use strict';

const pop = (lt, a, d = 0.35) => prog(lt, a, a + d);
const camMix = (keys, lt) => {
  // keys: [[t, cx, cy, z, ease?], ...] interpola entre keyframes
  if (lt <= keys[0][0]) return keys[0].slice(1, 4);
  for (let i = 1; i < keys.length; i++) {
    if (lt <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], k = (b[4] || E.inOutCubic)((lt - a[0]) / (b[0] - a[0]));
      return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];
    }
  }
  return keys[keys.length - 1].slice(1, 4);
};
const shake = (lt, a, amp = 14, dur = 0.3) => { const k = 1 - prog(lt, a, a + dur); return k > 0 && lt >= a ? [Math.sin(lt * 90) * amp * k, Math.cos(lt * 70) * amp * k] : [0, 0]; };

// ====================== CENÁRIOS REUTILIZÁVEIS ======================
function spanishStreet(ctx, t, o = {}) {
  const dusk = o.dusk || 0, lit = o.lit || 0;
  // céu
  const day = [[0, '#8FD3FF'], [0.6, '#CDEBFF'], [1, '#FFE3BD']];
  ctx.fillStyle = vgrad(ctx, -400, 1300, day); ctx.fillRect(-600, -600, 2400, 2100);
  if (dusk) {
    ctx.save(); ctx.globalAlpha = dusk;
    ctx.fillStyle = vgrad(ctx, -400, 1300, [[0, '#14204A'], [0.5, '#5B3C8C'], [0.85, '#E0745A'], [1, '#FFB36B']]);
    ctx.fillRect(-600, -600, 2400, 2100); ctx.restore();
  }
  const B = o.buildings || [
    { x: -340, w: 560, h: 1300, col: '#E9B872' }, { x: 220, w: 420, h: 1420, col: '#D9825B' },
    { x: 640, w: 470, h: 1250, col: '#F2E2C4' }, { x: 1110, w: 460, h: 1340, col: '#E8A87C' }];
  const G = 1450, r = rng(9);
  for (const b of B) {
    const top = G - b.h;
    ctx.fillStyle = b.col; ctx.fillRect(b.x, top, b.w, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(b.x, top, b.w, 34); ctx.fillRect(b.x + b.w - 14, top, 14, b.h);
    const cols = Math.max(2, Math.floor(b.w / 150)), gap = b.w / cols;
    for (let y = top + 120; y < G - 380; y += 210) {
      for (let c = 0; c < cols; c++) {
        const wx = b.x + gap * c + gap / 2 - 36;
        const on = dusk && r() < lit * 1.1;
        r();
        fillRR(ctx, wx, y, 72, 124, 6, on ? '#FFD27A' : (dusk ? '#2E3557' : '#5C7A99'));
        if (!on && !dusk) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(wx + 8, y + 8, 14, 90); }
        ctx.fillStyle = '#2F6D50'; ctx.fillRect(wx - 30, y, 26, 124); ctx.fillRect(wx + 76, y, 26, 124);
        for (let k = 0; k < 5; k++) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(wx - 30, y + 10 + k * 24, 26, 4); ctx.fillRect(wx + 76, y + 10 + k * 24, 26, 4); }
        // varanda de ferro
        ctx.fillStyle = '#1F1F24'; ctx.fillRect(wx - 34, y + 124, 140, 8);
        for (let k = 0; k <= 7; k++) ctx.fillRect(wx - 32 + k * 19, y + 92, 4, 34);
        ctx.fillRect(wx - 34, y + 88, 140, 6);
        if (r() < 0.35) { circle(ctx, wx - 10, y + 80, 18, '#3E8E41'); circle(ctx, wx + 6, y + 74, 14, '#E63946'); }
      }
    }
    // térreo
    fillRR(ctx, b.x + 40, G - 300, b.w - 80, 300, 8, dusk ? 'rgba(40,30,40,0.85)' : 'rgba(60,45,40,0.75)');
    if (dusk && lit > 0.3) { ctx.save(); ctx.globalAlpha = (lit - 0.3) / 0.7; fillRR(ctx, b.x + 60, G - 280, b.w - 120, 260, 6, '#FFB347'); ctx.restore(); }
  }
  // toldo listrado
  const aw = o.awning ?? 1;
  if (aw) {
    const ax = 240, aw2 = 380, ay = G - 360;
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? C.esYellow : C.esRed; ctx.fillRect(ax + i * aw2 / 8, ay, aw2 / 8 + 1, 70); }
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? C.esYellow : C.esRed; ctx.beginPath(); ctx.arc(ax + i * aw2 / 8 + aw2 / 16, ay + 70, aw2 / 16, 0, Math.PI); ctx.fill(); }
    if (o.sign) { fillRR(ctx, ax + 90, ay - 80, 200, 64, 10, C.ink); ctx.font = `46px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.esYellow; ctx.fillText(o.sign, ax + 190, ay - 46); }
  }
  // calçada
  ctx.fillStyle = dusk ? '#8F8279' : '#D8CFC0'; ctx.fillRect(-600, G, 2400, 1200);
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 9; i++) { const yy = G + 20 + i * i * 9 + i * 30; ctx.fillRect(-600, yy, 2400, 4); }
  for (let i = -8; i < 16; i++) { ctx.beginPath(); ctx.moveTo(540 + i * 60, G); ctx.lineTo(540 + i * 220, H + 300); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.stroke(); }
  // poste
  ctx.fillStyle = '#1F1F24'; ctx.fillRect(966, G - 700, 16, 720); fillRR(ctx, 940, G - 760, 68, 80, 14, '#1F1F24');
  fillRR(ctx, 950, G - 748, 48, 54, 8, dusk ? '#FFE08A' : '#F4F1DE');
  if (dusk) { const g = ctx.createRadialGradient(974, G - 720, 10, 974, G - 720, 260); g.addColorStop(0, 'rgba(255,220,130,0.55)'); g.addColorStop(1, 'rgba(255,220,130,0)'); ctx.fillStyle = g; ctx.fillRect(700, G - 1000, 560, 560); }
}

function tileWall(ctx, x, y, w, h, base, lineC, size = 90) {
  ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = lineC; ctx.lineWidth = 3;
  for (let yy = y; yy <= y + h; yy += size * 0.6) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
  let row = 0;
  for (let yy = y; yy < y + h; yy += size * 0.6, row++) for (let xx = x + (row % 2) * size / 2; xx < x + w; xx += size) { ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx, yy + size * 0.6); ctx.stroke(); }
}

function toilet(ctx, x, y, s = 1) {
  softShadow(ctx, 30, 10, 0.18);
  fillRR(ctx, x - 100 * s, y - 360 * s, 200 * s, 170 * s, 18 * s, '#FFFFFF');
  noShadow(ctx);
  fillRR(ctx, x - 110 * s, y - 372 * s, 220 * s, 26 * s, 12 * s, '#F3F3F3');
  fillRR(ctx, x - 30 * s, y - 330 * s, 60 * s, 16 * s, 8 * s, '#C9D3DA');
  // bacia
  ctx.beginPath(); ctx.moveTo(x - 120 * s, y - 180 * s); ctx.quadraticCurveTo(x - 110 * s, y - 40 * s, x - 50 * s, y - 20 * s); ctx.lineTo(x - 60 * s, y); ctx.lineTo(x + 60 * s, y); ctx.lineTo(x + 50 * s, y - 20 * s); ctx.quadraticCurveTo(x + 110 * s, y - 40 * s, x + 120 * s, y - 180 * s); ctx.closePath();
  ctx.fillStyle = '#FAFAFA'; ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x + 40 * s, y - 170 * s, 70 * s, 150 * s);
  ellipse(ctx, x, y - 182 * s, 128 * s, 36 * s, '#EDEDED');
  ellipse(ctx, x, y - 182 * s, 96 * s, 24 * s, '#BFE6F5');
  ellipse(ctx, x - 20 * s, y - 188 * s, 36 * s, 7 * s, 'rgba(255,255,255,0.7)');
}
function paperRoll(ctx, x, y, s = 1) {
  fillRR(ctx, x - 70 * s, y - 8 * s, 140 * s, 14 * s, 7 * s, '#9AA5AE');
  circle(ctx, x, y + 40 * s, 46 * s, '#FFFFFF');
  circle(ctx, x, y + 40 * s, 16 * s, '#D6CFC4');
  fillRR(ctx, x - 46 * s, y + 40 * s, 40 * s, 70 * s, 4 * s, '#FFFFFF');
}
function bin(ctx, x, y, s = 1, ghost = 0) {
  if (ghost) {
    ctx.save(); ctx.setLineDash([16 * s, 12 * s]); ctx.lineWidth = 6 * s; ctx.strokeStyle = `rgba(30,30,30,${0.55 * ghost})`;
    rr(ctx, x - 48 * s, y - 130 * s, 96 * s, 130 * s, 14 * s); ctx.stroke(); ctx.restore(); return;
  }
  fillRR(ctx, x - 48 * s, y - 130 * s, 96 * s, 130 * s, 14 * s, '#B8C0C8');
  fillRR(ctx, x - 52 * s, y - 142 * s, 104 * s, 22 * s, 10 * s, '#8E99A4');
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x - 34 * s, y - 118 * s, 10 * s, 100 * s);
  fillRR(ctx, x - 24 * s, y - 10 * s, 48 * s, 14 * s, 6 * s, '#6B7680');
}

function flagChip(ctx, which, label, x, y, k, align = 'center') {
  if (k <= 0) return;
  ctx.save(); ctx.font = `800 40px ${FONT_BODY}`;
  const tw = ctx.measureText(label).width, w = tw + 120, h = 70;
  const s = E.outBack(clamp(k)); ctx.translate(x, y); ctx.scale(s, s);
  const x0 = align === 'center' ? -w / 2 : 0;
  softShadow(ctx, 16, 6, 0.3); fillRR(ctx, x0, -h / 2, w, h, 35, C.ink); noShadow(ctx);
  flag(ctx, which, x0 + 16, -h / 2 + 14, 60);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(label, x0 + 92, 2);
  ctx.restore();
}

function pill(ctx, txt, x, y, k, opt = {}) {
  if (k <= 0) return;
  ctx.save(); ctx.font = `800 ${opt.size || 40}px ${FONT_BODY}`;
  const tw = ctx.measureText(txt).width, h = (opt.size || 40) * 1.8, w = tw + h;
  ctx.translate(x, y); const s = E.outBack(clamp(k)); ctx.scale(s, s); ctx.rotate((opt.rot || 0) * Math.PI / 180);
  softShadow(ctx, 16, 6, 0.3); fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, opt.bg || '#fff'); noShadow(ctx);
  ctx.fillStyle = opt.fg || C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 3);
  ctx.restore();
}

// ====================== CENA 1 — GANCHO ======================
const S1 = {
  cam: lt => {
    const c = camMix([[0, 430, 1050, 1.32], [0.45, 430, 1030, 1.38], [1.15, 830, 930, 2.5, E.outQuint], [1.45, 830, 930, 2.6], [1.85, 540, 980, 1.08, E.outQuint], [3.5, 540, 1000, 1.14]], lt);
    const sh = shake(lt, 0, 22, 0.35); c[0] += sh[0]; c[1] += sh[1]; return c;
  },
  world(ctx, lt, D, t) {
    spanishStreet(ctx, t, { sign: 'CAFÉ' });
    person(ctx, 140, 1530, 0.78, { t, skin: C.skin[5], shirt: '#577590', hair: '#4A3426', hairStyle: 'short', beard: 1, expr: 'side', look: 1 });
    person(ctx, 830, 1540, 0.82, { t, skin: C.skin[3], shirt: '#E76F51', hair: '#3B2416', hairStyle: 'long', expr: lt > 0.5 ? 'shock' : 'surprised', look: -1, handR: [60, -560], handL: [-120, -320] });
    const bob = Math.abs(Math.sin(lt * 7)) * -10;
    const p = person(ctx, 430, 1620, 1.0, { t, skin: C.skin[1], shirt: C.brGreen, shirtStripe: C.brYellow, hair: '#1E120B', hairStyle: 'curly', expr: 'happy', bob, handR: [170, -640 + Math.sin(lt * 9) * 14], handL: [-130, -330] });
    withT(ctx, p.handR[0] + 6, p.handR[1] - 36, 1.15, 0.5, () => ICON.toothbrush(ctx, 0.9));
    circle(ctx, p.handR[0], p.handR[1], 26, C.skin[1]);
    bubble(ctx, 930, 790, 70, pop(lt, 0.7, 0.3), '?!', { bg: C.accent, rot: 0.15 });
    bubble(ctx, 230, 860, 56, pop(lt, 0.9, 0.3), '👀', { size: 56, rot: -0.1 });
  },
  ui(ctx, lt, D, t) {
    flash(ctx, 0.7 * (1 - prog(lt, 0, 0.16)));
    speedLines(ctx, W / 2, H / 2, prog(lt, 0.5, 0.7) - prog(lt, 1.15, 1.45), t);
    // escurece o fundo para o título
    const k = E.outCubic(prog(lt, 1.55, 1.9));
    if (k > 0) { ctx.fillStyle = `rgba(10,10,14,${0.55 * k})`; ctx.fillRect(0, 0, W, H); }
    pill(ctx, '6 COISAS 👀', W / 2, 560, pop(lt, 2.0, 0.3), { bg: '#fff', size: 38, rot: -3 });
    sticker(ctx, ['NO BRASIL ', { flag: 'br' }, ' NORMAL'], W / 2, 720, 100, pop(lt, 1.72, 0.32), { bg: C.brGreen, fg: '#fff', rot: -2, t, dir: -1 });
    sticker(ctx, ['NA ESPANHA ', { flag: 'es' }, ' ESTRANHO?'], W / 2, 880, 92, pop(lt, 2.15, 0.32), { bg: C.esRed, fg: C.esYellow, rot: 1.5, t });
    if (lt > 2.55) underline(ctx, 640, 960, 950, E.outCubic(prog(lt, 2.55, 2.95)), C.accent, 14);
  },
};

// ====================== CENA 2 — ESCOVA NO TRABALHO ======================
const S2 = {
  cam: lt => camMix([[0, 540, 1080, 1.12], [2.0, 520, 1060, 1.16], [2.6, 360, 1010, 2.3, E.outQuint], [3.9, 380, 1010, 2.4], [4.4, 900, 1000, 2.25, E.outQuint], [5.6, 900, 1000, 2.35], [6.2, 560, 1080, 1.06, E.outQuint], [7.5, 560, 1080, 1.1]], lt),
  world(ctx, lt, D, t) {
    tileWall(ctx, -500, -400, 2100, 1700, '#F4F6F7', '#DFE5E8', 92);
    ctx.fillStyle = '#2F6D63'; ctx.fillRect(-500, 1150, 2100, 30);
    // porta
    const dx = 770, dy = 560, dw = 300, dh = 900;
    fillRR(ctx, dx - 22, dy - 22, dw + 44, dh + 22, 8, '#CBD2D6');
    ctx.fillStyle = vgrad(ctx, dy, dy + dh, [[0, '#4B5D6B'], [1, '#2B3640']]); ctx.fillRect(dx, dy, dw, dh);
    ctx.save(); ctx.beginPath(); ctx.rect(dx, dy, dw + 400, dh); ctx.clip();
    const cx = lerp(1250, 930, E.outBack(prog(lt, 3.3, 3.9)));
    person(ctx, cx, 1560, 0.95, { t, skin: C.skin[3], shirt: '#F4A261', hair: '#3B2416', hairStyle: 'bun', glasses: 1, expr: lt > 4.45 ? 'shock' : 'side', look: -1, handR: [150, -470], handL: [-100, -500] });
    ctx.restore();
    // folha da porta aberta
    ctx.beginPath(); ctx.moveTo(dx + dw, dy); ctx.lineTo(dx + dw + 120, dy - 40); ctx.lineTo(dx + dw + 120, dy + dh + 40); ctx.lineTo(dx + dw, dy + dh); ctx.closePath(); ctx.fillStyle = '#C89F7A'; ctx.fill();
    circle(ctx, dx + dw + 96, dy + dh / 2, 10, '#8D99AE');
    // placa WC
    fillRR(ctx, dx - 170, dy + 60, 120, 90, 14, '#1F2937');
    ctx.font = `56px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('WC', dx - 110, dy + 108);
    // toalheiro de papel
    fillRR(ctx, 40, 640, 190, 230, 20, '#E5E7EB'); fillRR(ctx, 70, 840, 130, 16, 6, '#9CA3AF');
    // personagem principal
    const osc = Math.sin(lt * 26) * 16 * (lt > 0.3 ? 1 : 0);
    const p = person(ctx, 340, 1640, 1.0, { t, skin: C.skin[1], shirt: '#A8D0E6', hair: '#1E120B', hairStyle: 'short', expr: 'brushing', look: lt > 4.6 ? 1 : 0, handR: [96 + osc, -610], handL: [-140, -380] });
    // crachá
    const [hx, hy] = p.head;
    line(ctx, [[hx - 30, hy + 100], [hx, hy + 200], [hx + 30, hy + 100]], 6, C.esRed);
    fillRR(ctx, hx - 32, hy + 196, 64, 84, 8, '#fff'); fillRR(ctx, hx - 22, hy + 210, 44, 30, 4, '#CBD5E1');
    // escova na boca
    const mx = p.mouth[0], my = p.mouth[1];
    fillRR(ctx, mx - 6 + osc * 0.6, my - 9, 150, 18, 9, '#2EC4B6');
    fillRR(ctx, mx - 34 + osc * 0.6, my - 13, 42, 26, 8, '#E8F7F6');
    circle(ctx, p.handR[0], p.handR[1], 26, C.skin[1]);
    // espuma
    const r = rng(5);
    for (let i = 0; i < 9; i++) circle(ctx, mx - 30 + r() * 60, my - 6 + r() * 26, 7 + r() * 9, 'rgba(255,255,255,0.95)');
    for (let i = 0; i < 6; i++) { const ph = (lt * 0.6 + i / 6) % 1; circle(ctx, mx - 60 + i * 26 + Math.sin(ph * 8 + i) * 10, my - 30 - ph * 160, 6 + i % 3 * 3, `rgba(255,255,255,${0.8 * (1 - ph)})`); }
    // bancada e pia
    ctx.fillStyle = '#E8E2D6'; ctx.fillRect(-500, 1250, 1270, 44);
    ctx.fillStyle = vgrad(ctx, 1294, 1920, [[0, '#B08968'], [1, '#7F5539']]); ctx.fillRect(-500, 1294, 1270, 800);
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-100 + i * 220, 1330, 6, 500); }
    ellipse(ctx, 340, 1262, 170, 30, '#FFFFFF'); ellipse(ctx, 340, 1264, 140, 20, '#D9E4EA');
    fillRR(ctx, 330, 1180, 20, 80, 8, '#AAB4BE'); fillRR(ctx, 300, 1170, 80, 20, 10, '#C9D1D8');
    fillRR(ctx, 600, 1170, 60, 84, 14, '#7FB5A6'); fillRR(ctx, 618, 1146, 24, 30, 6, '#3D5A50');
    // pasta de dente na mão esquerda
    withT(ctx, p.handL[0], p.handL[1] - 10, 1, -0.3, () => { fillRR(ctx, -16, -90, 32, 110, 10, '#fff'); fillRR(ctx, -16, -60, 32, 26, 0, C.esRed); fillRR(ctx, -10, -108, 20, 22, 4, '#2563EB'); });
    circle(ctx, p.handL[0], p.handL[1], 26, C.skin[1]);
    bubble(ctx, 1000, 760, 72, pop(lt, 4.85, 0.3), '😳', { size: 70, rot: 0.1 });
    bubble(ctx, 760, 690, 52, pop(lt, 5.35, 0.3), '!!', { bg: C.accent, rot: -0.2, tail: -0.6 });
  },
  ui(ctx, lt, D, t) {
    // brilho de espelho atravessando
    const g = prog(lt, 0.15, 0.95);
    if (g > 0 && g < 1) { ctx.save(); ctx.globalAlpha = 0.35 * Math.sin(g * Math.PI); ctx.translate(lerp(-400, 1500, g), 0); ctx.rotate(0.35); ctx.fillStyle = '#fff'; ctx.fillRect(-60, -400, 120, 2800); ctx.fillRect(100, -400, 36, 2800); ctx.restore(); }
    sticker(ctx, 'ESCOVAR OS DENTES', W / 2, 330, 100, pop(lt, 0.3), { bg: '#fff', fg: C.ink, rot: -2 });
    sticker(ctx, 'NO TRABALHO 🪥', W / 2, 462, 100, pop(lt, 0.48), { bg: C.brGreen, fg: C.brYellow, rot: 1.5 });
    // selo "no Brasil: normal"
    const k = pop(lt, 0.6, 0.35) - prog(lt, 2.2, 2.4);
    if (k > 0) {
      withT(ctx, 860, 690, E.outBack(clamp(k)), -0.12, () => {
        softShadow(ctx, 18, 6, 0.3); circle(ctx, 0, 0, 92, '#fff'); noShadow(ctx);
        flagBR(ctx, -50, -60, 100, t, 0.6);
        ctx.font = `800 30px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillStyle = C.brGreen; ctx.fillText('NORMAL ✔', 0, 52);
      });
    }
    pill(ctx, 'não é proibido… só chama atenção 👀', W / 2, 1240, pop(lt, 6.1, 0.3), { size: 36, bg: C.accent });
  },
};

// ====================== CENA 3 — PAPEL NO VASO ======================
const S3 = {
  cam: lt => camMix([[0, 540, 960, 1.0], [6, 540, 960, 1.05]], lt),
  world(ctx, lt, D, t) {
    ctx.fillStyle = '#16151B'; ctx.fillRect(-200, -200, W + 400, H + 400);
    const panel = (side, X) => {
      const x = side === 'br' ? 40 : 550, y = 600, w = 490, h = 740;
      const slide = (1 - E.outQuint(pop(lt, side === 'br' ? 0.0 : 0.08, 0.45))) * (side === 'br' ? -700 : 700);
      ctx.save(); ctx.translate(slide, 0);
      rr(ctx, x, y, w, h, 34); ctx.save(); ctx.clip();
      if (side === 'br') tileWall(ctx, x, y, w, h, '#F3E9D8', '#E0D3BC', 80); else tileWall(ctx, x, y, w, h, '#EAF2F8', '#CFDDE8', 80);
      ctx.fillStyle = side === 'br' ? '#C9B79C' : '#9FB4C7'; ctx.fillRect(x, y + h - 170, w, 170);
      ctx.fillStyle = side === 'br' ? C.brGreen : C.esRed; ctx.fillRect(x, y + h - 176, w, 10);
      const tx = x + w / 2 + 30, ty = y + h - 110;
      toilet(ctx, tx, ty, 0.92);
      paperRoll(ctx, x + w - 70, y + 330, 0.8);
      if (side === 'br') {
        bin(ctx, x + 85, ty + 2, 0.95);
        if (lt > 0.7) arrow(ctx, x + w - 90, y + 410, x + 110, ty - 160, E.outCubic(prog(lt, 0.7, 1.2)), C.brGreen, 10, -120);
      } else {
        // papel voando pro vaso
        const k = prog(lt, 1.25, 2.2);
        if (k > 0 && k < 1) {
          const e = E.inOutCubic(k), px = lerp(x + w - 90, tx, e), py = lerp(y + 400, ty - 190, e) - Math.sin(e * Math.PI) * 220;
          withT(ctx, px, py, 1 - 0.5 * e, e * 6, () => { fillRR(ctx, -34, -40, 68, 80, 6, '#fff'); line(ctx, [[-34, 0], [34, 0]], 2, '#ddd'); });
        }
        const rp = prog(lt, 2.2, 3.0);
        if (rp > 0 && rp < 1) for (let i = 0; i < 3; i++) { const q = clamp(rp * 1.4 - i * 0.2); if (q <= 0) continue; ctx.beginPath(); ctx.ellipse(tx, ty - 182, 30 + q * 70, 8 + q * 16, 0, 0, Math.PI * 2); ctx.lineWidth = 5; ctx.strokeStyle = `rgba(80,160,210,${1 - q})`; ctx.stroke(); }
        const gk = pop(lt, 2.9, 0.3);
        if (gk > 0) { bin(ctx, x + 85, ty + 2, 0.95, gk); bigX(ctx, x + 85, ty - 64, 60, prog(lt, 3.3, 3.7)); }
      }
      ctx.restore();
      ctx.lineWidth = 6; ctx.strokeStyle = side === 'br' ? C.brYellow : C.esYellow; rr(ctx, x, y, w, h, 34); ctx.stroke();
      ctx.restore();
    };
    panel('br'); panel('es');
    // VS
    const v = pop(lt, 0.4, 0.3);
    if (v > 0) withT(ctx, 540, 970, E.outBack(v), 0, () => { softShadow(ctx, 20, 6, 0.4); circle(ctx, 0, 0, 62, C.accent); noShadow(ctx); ctx.font = `64px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink; ctx.fillText('VS', 0, 4); });
  },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'PAPEL NO VASO', W / 2, 330, 104, pop(lt, 0.25), { bg: C.esRed, fg: '#fff', rot: -2 });
    sticker(ctx, 'OU NO LIXO?', W / 2, 462, 104, pop(lt, 0.42), { bg: '#fff', fg: C.ink, rot: 1.5 });
    flagChip(ctx, 'br', 'BRASIL', 285, 660, pop(lt, 0.35));
    flagChip(ctx, 'es', 'ESPANHA', 795, 660, pop(lt, 0.45));
  },
};

// ====================== CENA 4 — PARCELADO ======================
function storeWall(ctx, t) {
  ctx.fillStyle = vgrad(ctx, -200, 1500, [[0, '#2A2A33'], [1, '#3B3A46']]); ctx.fillRect(-400, -400, 1900, 1900);
  const cols = ['#FF5A3C', '#2EC4B6', '#FFD166', '#118AB2', '#EF476F', '#F7F7F7', '#06D6A0', '#8338EC'];
  const r = rng(21);
  for (let row = 0; row < 4; row++) {
    const y = 300 + row * 240;
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -300 : 740;
      ctx.fillStyle = '#5B5866'; ctx.fillRect(x0, y + 60, 640, 16);
      for (let i = 0; i < 3; i++) withT(ctx, x0 + 110 + i * 210, y + 30, 0.42, 0, () => ICON.sneaker(ctx, 1, cols[Math.floor(r() * cols.length)], '#1E1E24'));
    }
  }
  // spot de luz
  const g = ctx.createRadialGradient(540, 700, 40, 540, 760, 620); g.addColorStop(0, 'rgba(255,230,180,0.55)'); g.addColorStop(1, 'rgba(255,230,180,0)');
  ctx.fillStyle = g; ctx.fillRect(-200, 0, 1500, 1500);
  ctx.fillStyle = vgrad(ctx, 1300, 1920, [[0, '#8C5A3C'], [1, '#5E3B27']]); ctx.fillRect(-400, 1300, 1900, 900);
  for (let i = 0; i < 12; i++) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-400 + i * 160, 1300, 4, 900); }
}
const S4 = {
  cam: lt => camMix([[0, 540, 960, 1.18], [0.6, 540, 960, 1.0, E.outQuint], [7.4, 540, 970, 1.06]], lt),
  world(ctx, lt, D, t) {
    storeWall(ctx, t);
    // pódio
    ellipse(ctx, 540, 1040, 330, 70, '#F6F1E7'); ctx.fillStyle = '#E6DDCB'; ctx.fillRect(210, 1040, 660, 200); ellipse(ctx, 540, 1240, 330, 70, '#D9CDB5');
    ellipse(ctx, 540, 1040, 330, 70, '#F6F1E7');
    // tênis herói
    const ein = E.outBack(prog(lt, 0.0, 0.6));
    const out = E.inCubic(prog(lt, 6.0, 6.7));
    const sx = lerp(1400, 540, ein) + out * 900, sy = 860 + Math.sin(lt * 3) * 14 - out * 300;
    const rot = lerp(-0.6, -0.08, ein) + Math.sin(lt * 2) * 0.03 - out * 0.8;
    ellipse(ctx, 540, 1040, 220 * (1 - out), 30, 'rgba(0,0,0,0.25)');
    withT(ctx, sx, sy, 1.55 * (1 - out * 0.5), rot, () => {
      ICON.sneaker(ctx, 1, '#FF5A3C', '#1E1E24');
      // etiqueta de preço pendurada
      const tk = prog(lt, 4.6, 5.3);
      if (tk > 0) {
        const sw = Math.sin(lt * 6) * 0.25 * (1 - tk) + 0.1;
        line(ctx, [[60, -40], [60 + Math.sin(sw) * 120, -40 + 120]], 3, '#ddd');
        withT(ctx, 60 + Math.sin(sw) * 120, 80, E.outBack(tk) * 0.62, sw, () => {
          ctx.beginPath(); ctx.moveTo(-90, -20); ctx.lineTo(-50, -60); ctx.lineTo(150, -60); ctx.lineTo(150, 80); ctx.lineTo(-50, 80); ctx.lineTo(-90, 40); ctx.closePath();
          ctx.fillStyle = C.esYellow; ctx.fill(); circle(ctx, -55, 10, 10, '#fff');
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink;
          ctx.font = `70px ${FONT_HEAD}`; ctx.fillText('1x', 55, -4); ctx.font = `800 22px ${FONT_BODY}`; ctx.fillText('À VISTA', 55, 52);
        });
      }
    });
  },
  ui(ctx, lt, D, t) {
    sticker(ctx, ['10X SEM JUROS? ', { flag: 'br' }], W / 2, 330, 104, pop(lt, 0.3), { bg: C.brGreen, fg: '#fff', rot: -2, t });
    sticker(ctx, ['PREÇO INTEGRAL? ', { flag: 'es' }], W / 2, 462, 96, pop(lt, 4.65), { bg: C.esRed, fg: C.esYellow, rot: 1.5, t });
    // 10 parcelas
    const fall = prog(lt, 2.7, 3.5);
    for (let i = 0; i < 10; i++) {
      const k = pop(lt, 0.8 + i * 0.13, 0.25);
      if (k <= 0) continue;
      const col = i % 5, row = Math.floor(i / 5);
      const x = 160 + col * 190, y0 = 1120 + row * 130;
      const f = clamp(fall * 1.6 - (9 - i) * 0.06);
      const y = y0 + E.inCubic(f) * 900;
      ctx.save(); ctx.globalAlpha = 1 - f;
      withT(ctx, x, y, E.outBack(k), (i % 2 ? 0.05 : -0.05) + f * (i % 2 ? 1 : -1), () => {
        softShadow(ctx, 12, 5, 0.3); fillRR(ctx, -80, -48, 160, 96, 18, i % 2 ? C.brYellow : '#fff'); noShadow(ctx);
        ctx.font = `52px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.brGreen; ctx.fillText(`${i + 1}/10`, 0, 4);
      });
      ctx.restore();
    }
    // calculadora
    const ck = E.outBack(prog(lt, 3.0, 3.4)) - E.inCubic(prog(lt, 5.9, 6.3));
    if (ck > 0) {
      withT(ctx, lerp(1300, 780, ck), 1200, 1, -0.08, () => {
        softShadow(ctx, 26, 12, 0.4); fillRR(ctx, -170, -230, 340, 460, 36, '#22222A'); noShadow(ctx);
        fillRR(ctx, -140, -200, 280, 110, 16, '#B8E0C8');
        let disp = '';
        if (lt < 4.55) { const r = rng(Math.floor(lt * 16)); for (let i = 0; i < 7; i++) disp += Math.floor(r() * 10); }
        else disp = '= 1x';
        ctx.font = `64px ${FONT_HEAD}`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#163020'; ctx.fillText(disp, 120, -142);
        const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
        const pressed = Math.floor(lt * 14) % 16;
        keys.forEach((kk, i) => {
          const kx = -120 + (i % 4) * 80, ky = -40 + Math.floor(i / 4) * 66;
          fillRR(ctx, kx - 32, ky - 26, 64, 52, 12, i === pressed && lt < 4.55 ? C.accent : (i % 4 === 3 ? C.esRed : '#3A3A46'));
          ctx.font = `800 28px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(kk, kx, ky + 2);
        });
      });
    }
    pill(ctx, 'ou paga… ou não leva 🤷', W / 2, 600, pop(lt, 5.75, 0.3) - prog(lt, 7.2, 7.4), { size: 40, bg: '#fff' });
  },
};

// ====================== CENA 5 — EMPACOTAR ======================
const PRODUCTS = [
  (ctx) => { fillRR(ctx, -36, -110, 72, 110, 6, '#fff'); fillRR(ctx, -36, -80, 72, 36, 0, '#3A86FF'); ctx.beginPath(); ctx.moveTo(-36, -110); ctx.lineTo(0, -140); ctx.lineTo(36, -110); ctx.fillStyle = '#E5E7EB'; ctx.fill(); },
  (ctx) => { circle(ctx, -24, -34, 32, '#E63946'); circle(ctx, 24, -34, 32, '#D62839'); circle(ctx, 0, -70, 30, '#F25C54'); line(ctx, [[0, -100], [6, -116]], 5, '#5B3A1E'); },
  (ctx) => { fillRR(ctx, -100, -54, 200, 54, 27, '#D9A35B'); for (let i = 0; i < 4; i++) line(ctx, [[-70 + i * 44, -46], [-50 + i * 44, -14]], 5, '#B07A3A'); },
  (ctx) => { fillRR(ctx, -22, -160, 44, 160, 14, '#2A9D8F'); fillRR(ctx, -12, -190, 24, 34, 6, '#264653'); fillRR(ctx, -22, -110, 44, 40, 0, '#fff'); },
  (ctx) => { fillRR(ctx, -50, -150, 100, 150, 6, '#FFB703'); fillRR(ctx, -40, -130, 80, 50, 6, '#FB8500'); circle(ctx, 0, -50, 22, '#fff'); },
];
const S5 = {
  cam: lt => camMix([[0, 640, 1020, 1.12], [3.3, 500, 1000, 1.12], [4.3, 300, 1030, 1.7, E.outQuint], [6.6, 300, 1030, 1.78]], lt),
  world(ctx, lt, D, t) {
    // prateleiras do mercado ao fundo
    ctx.fillStyle = '#EFE9DD'; ctx.fillRect(-400, -400, 1900, 1700);
    const r = rng(33), pal = ['#E63946', '#F4A261', '#2A9D8F', '#457B9D', '#E9C46A', '#8AB17D', '#B5838D', '#FFFFFF'];
    for (let row = 0; row < 4; row++) {
      const y = 320 + row * 190;
      ctx.fillStyle = '#C9C2B5'; ctx.fillRect(-400, y + 120, 1900, 18);
      for (let x = -380; x < 1500;) { const w = 40 + r() * 50, h = 60 + r() * 60; fillRR(ctx, x, y + 120 - h, w, h, 6, pal[Math.floor(r() * pal.length)]); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(x + 6, y + 120 - h + h * 0.35, w - 12, h * 0.2); x += w + 8; }
    }
    ctx.fillStyle = 'rgba(239,233,221,0.45)'; ctx.fillRect(-400, -400, 1900, 1700);
    // placa CAJA
    line(ctx, [[700, -100], [700, 230]], 4, '#888'); line(ctx, [[900, -100], [900, 230]], 4, '#888');
    fillRR(ctx, 650, 230, 300, 100, 16, C.esRed); ctx.font = `64px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('CAJA 3', 800, 284);
    // fila ao fundo
    person(ctx, 920, 1360, 0.62, { t, skin: C.skin[4], shirt: '#6D597A', hair: '#111', hairStyle: 'short', expr: 'neutral', handR: [90, -540], handL: [-120, -330] });
    fillRR(ctx, 920 + 30, 1360 - 0.62 * 600, 34, 56, 6, '#222');
    person(ctx, 1050, 1340, 0.58, { t, skin: C.skin[3], shirt: '#90BE6D', hair: '#8B5A2B', hairStyle: 'long', expr: 'neutral', look: -1, handL: [-140, -360], handR: [130, -330] });
    // caixa (operadora)
    const scanK = (lt * 1.4) % 1;
    person(ctx, 700, 1430, 0.8, { t, skin: C.skin[2], shirt: '#2A9D8F', hair: '#2B1B12', hairStyle: 'bun', expr: 'neutral', look: 1, handR: [150, -420 + Math.sin(lt * 9) * 10], handL: [-130, -420] });
    // cliente brasileiro empacotando
    const items = [0.3, 1.0, 1.7, 2.4, 3.1];
    let reach = 0;
    items.forEach((ti) => { const q = prog(lt, ti + 0.25, ti + 0.75); if (q > 0 && q < 1) reach = Math.sin(q * Math.PI); });
    const p = person(ctx, 200, 1560, 0.95, { t, skin: C.skin[1], shirt: C.brGreen, shirtStripe: C.brYellow, hair: '#1E120B', hairStyle: 'curly', expr: lt > 3.6 ? 'surprised' : 'neutral', look: lt > 3.6 ? 0 : 1, handL: [-110, -380], handR: [lerp(40, 260, reach), lerp(-380, -470, reach)] });
    // balcão
    ctx.fillStyle = '#3A3D4A'; ctx.fillRect(-400, 1200, 1900, 50);
    ctx.fillStyle = vgrad(ctx, 1250, 1920, [[0, '#2B2D42'], [1, '#1A1B28']]); ctx.fillRect(-400, 1250, 1900, 700);
    // esteira
    ctx.fillStyle = '#15151B'; ctx.fillRect(420, 1160, 1100, 46);
    for (let i = 0; i < 30; i++) { const x = 420 + ((i * 60 - lt * 260) % 1100 + 1100) % 1100; ctx.fillStyle = '#2A2A33'; ctx.fillRect(x, 1162, 22, 42); }
    // scanner
    fillRR(ctx, 560, 1150, 120, 30, 6, '#111'); ctx.fillStyle = `rgba(255,40,40,${0.5 + 0.5 * Math.sin(lt * 30)})`; ctx.fillRect(570, 1160, 100, 6);
    // produtos
    items.forEach((ti, i) => {
      const k = prog(lt, ti - 0.9, ti + 0.6);
      if (k <= 0) return;
      let x, y = 1160, s = 1;
      if (k < 1) { x = lerp(1200, 330, E.inOutCubic(k)); }
      else { const q = prog(lt, ti + 0.6, ti + 0.95); x = lerp(380, 330, q); y = 1160 - Math.sin(q * Math.PI) * 120 + q * 40; s = 1 - q * 0.4; if (q >= 1) return; }
      withT(ctx, x, y, 0.85 * s, 0, () => PRODUCTS[i](ctx));
      if (Math.abs(x - 620) < 30) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.fillRect(560, 1000, 120, 160); }
    });
    // sacola
    withT(ctx, 330, 1112, 0.85, 0, () => ICON.bag(ctx, 1));
    circle(ctx, p.handL[0], p.handL[1], 26, C.skin[1]);
  },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'VOCÊ EMPACOTA 🛒', W / 2, 330, 104, pop(lt, 0.45), { bg: C.accent, fg: C.ink, rot: -2 });
    sticker(ctx, 'E PAGA PELA SACOLA', W / 2, 462, 96, pop(lt, 3.6), { bg: C.esRed, fg: '#fff', rot: 1.5 });
    // etiqueta de preço da sacola (sem valor inventado: só o símbolo)
    const k = pop(lt, 3.75, 0.35);
    if (k > 0) {
      withT(ctx, 830, 760, E.outBack(k), 0.12 + Math.sin(lt * 5) * 0.04, () => {
        softShadow(ctx, 18, 8, 0.35);
        ctx.beginPath(); ctx.moveTo(-150, -40); ctx.lineTo(-100, -90); ctx.lineTo(150, -90); ctx.lineTo(150, 90); ctx.lineTo(-100, 90); ctx.lineTo(-150, 40); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); noShadow(ctx);
        circle(ctx, -108, 0, 12, '#ddd');
        circle(ctx, -20, 0, 54, C.esYellow); ctx.font = `76px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink; ctx.fillText('€', -20, 4);
        ctx.font = `800 34px ${FONT_BODY}`; ctx.fillText('+1', 90, -20); ctx.font = `800 22px ${FONT_BODY}`; ctx.fillText('SACOLA', 90, 24);
      });
      arrow(ctx, 780, 860, 640, 1060, E.outCubic(prog(lt, 4.0, 4.4)), '#fff', 10, 60);
    }
  },
};

// ====================== CENA 6 — JANTAR ======================
const S6 = {
  cam: lt => {
    if (lt < 4.6) return camMix([[0, 540, 1000, 1.1], [3.9, 560, 1000, 1.16], [4.6, 800, 700, 2.6, E.inCubic]], lt);
    return camMix([[4.6, 540, 1060, 1.35], [5.6, 540, 1000, 1.05, E.outQuint], [8.6, 540, 980, 1.1]], lt);
  },
  world(ctx, lt, D, t) {
    if (lt < 4.6) {
      // casa: parede, janela, relógio, mesa com arroz e feijão
      ctx.fillStyle = '#F3E1C7'; ctx.fillRect(-400, -400, 1900, 1800);
      for (let i = 0; i < 20; i++) { ctx.fillStyle = 'rgba(200,150,100,0.12)'; ctx.fillRect(-400 + i * 100, -400, 40, 1800); }
      fillRR(ctx, 50, 520, 360, 460, 16, '#8D6E63'); ctx.fillStyle = vgrad(ctx, 540, 960, [[0, '#7FB7E6'], [1, '#F9C784']]); ctx.fillRect(70, 540, 320, 420);
      ctx.fillStyle = '#8D6E63'; ctx.fillRect(225, 540, 10, 420); ctx.fillRect(70, 745, 320, 10);
      const hk = E.inOutCubic(prog(lt, 4.25, 4.6)); const mins = 19 * 60 + hk * 120;
      withT(ctx, 800, 700, 1.15, 0, () => ICON.clock(ctx, 1, Math.floor(mins / 60), mins % 60));
      person(ctx, 500, 1700, 1.0, { t, skin: C.skin[1], shirt: C.brGreen, shirtStripe: C.brYellow, hair: '#1E120B', hairStyle: 'curly', expr: 'happy', hideLegs: 1, handR: [150, -470], handL: [-150, -460] });
      // mesa
      ctx.fillStyle = '#fff'; ctx.fillRect(-400, 1250, 1900, 700);
      for (let i = 0; i < 24; i++) for (let j = 0; j < 9; j++) if ((i + j) % 2) { ctx.fillStyle = 'rgba(0,156,59,0.18)'; ctx.fillRect(-400 + i * 80, 1250 + j * 80, 80, 80); }
      ellipse(ctx, 500, 1330, 200, 56, '#fff'); ellipse(ctx, 500, 1330, 200, 56, 'rgba(0,0,0,0.05)'); ellipse(ctx, 500, 1326, 160, 42, '#fff');
      const r = rng(4); for (let i = 0; i < 40; i++) circle(ctx, 430 + r() * 70, 1316 + r() * 24, 7, '#FFFDF5');
      for (let i = 0; i < 30; i++) circle(ctx, 530 + r() * 70, 1316 + r() * 24, 9, '#5A2E1A');
      fillRR(ctx, 760, 1180, 70, 120, 10, 'rgba(255,170,60,0.85)');
      line(ctx, [[650, 1240], [600, 1330]], 10, '#B0B7BF');
    } else {
      const lit = prog(lt, 5.3, 6.6);
      spanishStreet(ctx, t, { dusk: 1, lit, sign: 'TAPAS' });
      // varal de luzes
      const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push([lerp(-120, 1200, f), lerp(980, 940, f) + Math.sin(f * Math.PI) * 120]); }
      line(ctx, pts, 3, '#222');
      pts.forEach(([x, y], i) => {
        const on = lt > 5.6 + i * 0.04;
        if (on) { const g = ctx.createRadialGradient(x, y + 14, 2, x, y + 14, 60); g.addColorStop(0, 'rgba(255,214,120,0.8)'); g.addColorStop(1, 'rgba(255,214,120,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, y - 46, 120, 120); }
        circle(ctx, x, y + 14, 11, on ? '#FFE9A8' : '#55505A');
      });
      // mesas com gente jantando
      const diners = [
        { x: 180, skin: C.skin[5], shirt: '#E76F51', hair: '#4A3426', hs: 'long' }, { x: 360, skin: C.skin[2], shirt: '#264653', hair: '#111', hs: 'short' },
        { x: 720, skin: C.skin[3], shirt: '#F4A261', hair: '#6B4226', hs: 'bun' }, { x: 900, skin: C.skin[0], shirt: '#8AB17D', hair: '#111', hs: 'curly' }];
      diners.forEach((d, i) => person(ctx, d.x, 1700, 0.62, { t, skin: d.skin, shirt: d.shirt, hair: d.hair, hairStyle: d.hs, expr: 'happy', hideLegs: 1, look: i % 2 ? -1 : 1, handR: [130, -470 + Math.sin(lt * 4 + i) * 10], handL: [-130, -440] }));
      for (const tx of [270, 810]) {
        ellipse(ctx, tx, 1470, 210, 40, '#F6F1E7'); ctx.fillStyle = '#2B2B33'; ctx.fillRect(tx - 10, 1470, 20, 260); ellipse(ctx, tx, 1730, 80, 16, '#2B2B33');
        fillRR(ctx, tx - 50, 1400, 24, 60, 6, 'rgba(180,30,60,0.9)'); fillRR(ctx, tx + 30, 1400, 24, 60, 6, 'rgba(180,30,60,0.9)');
        ellipse(ctx, tx, 1462, 60, 14, '#fff');
        const g = ctx.createRadialGradient(tx, 1440, 4, tx, 1440, 90); g.addColorStop(0, 'rgba(255,200,100,0.7)'); g.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = g; ctx.fillRect(tx - 90, 1350, 180, 180);
        fillRR(ctx, tx - 8, 1416, 16, 34, 4, '#FFF3D6');
      }
    }
  },
  ui(ctx, lt, D, t) {
    const fade = prog(lt, 4.45, 4.65) - prog(lt, 4.65, 5.0);
    if (fade > 0) { ctx.fillStyle = `rgba(255,236,190,${fade})`; ctx.fillRect(0, 0, W, H); }
    sticker(ctx, 'JANTAR ÀS 19H? 😳', W / 2, 330, 104, pop(lt, 0.3), { bg: C.brGreen, fg: C.brYellow, rot: -2 });
    // JANTAR? -> AINDA CEDO!
    if (lt < 4.5) {
      const swap = prog(lt, 2.05, 2.35), sy = Math.abs(Math.cos(swap * Math.PI));
      const k = pop(lt, 0.9, 0.3);
      if (k > 0) withT(ctx, W / 2, 1190, 1, 0, () => {
        ctx.scale(1, Math.max(0.02, sy));
        const sh = swap >= 0.5 ? shake(lt, 2.2, 10, 0.4) : [0, 0];
        ctx.translate(sh[0], 0);
        if (swap < 0.5) outlined(ctx, 'JANTAR?', 0, 0, 120 * E.outBack(k), { font: FONT_HEAD, weight: 400, color: '#fff', strokeW: 18 });
        else outlined(ctx, 'AINDA CEDO!', 0, 0, 120, { font: FONT_HEAD, weight: 400, color: C.esYellow, strokeColor: C.esRed, strokeW: 20 });
      });
    } else {
      sticker(ctx, 'AQUI, MAIS TARDE!', W / 2, 462, 104, pop(lt, 4.75), { bg: C.esRed, fg: C.esYellow, rot: 1.5 });
      // relógio no canto avançando 21h -> 22h
      const k = pop(lt, 4.7, 0.4);
      const mins = 21 * 60 + E.inOutCubic(prog(lt, 6.9, 7.6)) * 60;
      withT(ctx, 870, 700, 0.75 * E.outBack(k), 0, () => ICON.clock(ctx, 1, Math.floor(mins / 60), mins % 60, '#FFF6E0'));
      if (k > 0) pill(ctx, mins < 21 * 60 + 30 ? '21:00' : '22:00', 870, 830, k, { size: 36, bg: C.ink, fg: C.esYellow });
    }
  },
};

// ====================== CENA 7 — DOMINGO ======================
const SHOPS = [{ n: 'FRUTERÍA', c: '#2A9D8F' }, { n: 'PAPELERÍA', c: '#E76F51' }, { n: 'ZAPATERÍA', c: '#6D597A' }, { n: 'TIENDA', c: '#E9C46A' }];
const S7 = {
  cam: lt => camMix([[0, 540, 1080, 1.08], [3.1, 540, 1100, 1.1], [3.9, 560, 1050, 1.55, E.outQuint], [6.2, 560, 1050, 1.6]], lt),
  world(ctx, lt, D, t) {
    ctx.fillStyle = vgrad(ctx, -400, 900, [[0, '#A8DADC'], [1, '#F1FAEE']]); ctx.fillRect(-400, -400, 1900, 1400);
    ctx.fillStyle = '#F2E2C4'; ctx.fillRect(-400, 560, 1900, 900);
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(-400, 560, 1900, 30);
    for (let i = 0; i < 8; i++) { const wx = -300 + i * 200; fillRR(ctx, wx, 640, 80, 120, 6, '#5C7A99'); ctx.fillStyle = '#2F6D50'; ctx.fillRect(wx - 28, 640, 24, 120); ctx.fillRect(wx + 84, 640, 24, 120); }
    const closeAt = [1.6, 1.75, 2.3, null];
    SHOPS.forEach((s, i) => {
      const x = 30 + i * 258, y = 880, w = 240, h = 500;
      fillRR(ctx, x, y, w, 90, 10, s.c);
      ctx.font = `800 ${s.n.length > 8 ? 34 : 40}px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(s.n, x + w / 2, y + 47);
      const open = closeAt[i] === null;
      fillRR(ctx, x + 10, y + 100, w - 20, h - 100, 6, open ? '#FFE8A3' : '#9DC3DB');
      if (open || lt < (closeAt[i] || 0) + 0.4) { const r = rng(i + 3); for (let k = 0; k < 6; k++) fillRR(ctx, x + 30 + (k % 3) * 70, y + 180 + Math.floor(k / 3) * 120, 50, 60, 8, ['#E63946', '#FFB703', '#8AB17D', '#457B9D'][Math.floor(r() * 4)]); }
      if (!open) {
        const k = E.outCubic(prog(lt, closeAt[i], closeAt[i] + 0.45));
        const sh = (h - 100) * k;
        ctx.fillStyle = '#9AA0A6'; ctx.fillRect(x + 6, y + 96, w - 12, sh);
        for (let yy = 0; yy < sh; yy += 18) line(ctx, [[x + 6, y + 96 + yy], [x + w - 6, y + 96 + yy]], 3, '#7D838A', 'butt');
        if (k >= 1) fillRR(ctx, x + w / 2 - 30, y + h - 30, 60, 14, 6, '#5F656B');
      }
    });
    ctx.fillStyle = '#D8CFC0'; ctx.fillRect(-400, 1380, 1900, 700);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(-400, 1400 + i * i * 10 + i * 28, 1900, 4); }
    const fr = lt > 3.35;
    const p = person(ctx, 560, 1760, 1.0, { t, skin: C.skin[1], shirt: C.brGreen, shirtStripe: C.brYellow, hair: '#1E120B', hairStyle: 'curly', expr: fr ? 'frustrated' : (lt > 2.4 ? 'surprised' : 'neutral'), look: fr ? 0 : -1, handL: [-30, -470], handR: [150, -300] });
    // relógio de pulso
    fillRR(ctx, p.handL[0] - 34, p.handL[1] + 4, 40, 34, 8, '#1F2937'); fillRR(ctx, p.handL[0] - 30, p.handL[1] + 8, 32, 26, 6, '#E5E7EB');
    circle(ctx, p.handL[0], p.handL[1], 26, C.skin[1]);
    // sacola vazia
    withT(ctx, p.handR[0], p.handR[1] + 90, 0.8, Math.sin(lt * 3) * 0.06, () => { ctx.beginPath(); ctx.arc(0, -70, 40, Math.PI, 0); ctx.lineWidth = 10; ctx.strokeStyle = '#B9905A'; ctx.stroke(); ctx.beginPath(); ctx.moveTo(-80, -70); ctx.lineTo(80, -70); ctx.lineTo(70, 80); ctx.lineTo(-70, 80); ctx.closePath(); ctx.fillStyle = '#F4E3C3'; ctx.fill(); });
    bubble(ctx, 800, 900, 62, pop(lt, 4.7, 0.3), '😅', { size: 62, rot: 0.1 });
  },
  ui(ctx, lt, D, t) {
    // calendário SÁBADO -> DOMINGO
    const mv = E.inOutCubic(prog(lt, 3.0, 3.5));
    const cx = lerp(540, 890, mv), cy = lerp(680, 690, mv), cs = lerp(1, 0.55, mv) * E.outBack(pop(lt, 0.0, 0.35));
    if (cs > 0) withT(ctx, cx, cy, cs, -0.04, () => {
      const page = (label, col) => { softShadow(ctx, 24, 10, 0.35); fillRR(ctx, -170, -170, 340, 340, 26, '#fff'); noShadow(ctx); ctx.save(); rr(ctx, -170, -170, 340, 340, 26); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(-170, -170, 340, 100); ctx.restore(); circle(ctx, -90, -170, 14, '#333'); circle(ctx, 90, -170, 14, '#333'); ctx.font = `86px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.ink; ctx.fillText(label, 0, 50); };
      const f = prog(lt, 0.5, 0.85);
      page('DOMINGO', C.esRed);
      if (f < 1) { ctx.save(); ctx.translate(0, -170); ctx.scale(1, 1 - E.inCubic(f)); ctx.translate(0, 170); page('SÁBADO', '#457B9D'); ctx.restore(); }
    });
    sticker(ctx, 'ESQUECEU NO SÁBADO?', W / 2, 330, 100, pop(lt, 3.4), { bg: '#fff', fg: C.ink, rot: -2 });
    sticker(ctx, 'BOA SORTE NO DOMINGO 😅', W / 2, 462, 84, pop(lt, 4.6), { bg: C.esRed, fg: C.esYellow, rot: 1.5 });
    if (lt > 3.6 && lt < 4.1) { const k = prog(lt, 3.6, 4.1); ctx.save(); ctx.globalAlpha = 0.25 * (1 - k); ctx.fillStyle = C.esRed; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  },
};

// ====================== CENA 8 — CTA ======================
const S8 = {
  cam: lt => [540, 960, 1 + Math.min(lt, 9) * 0.004],
  world(ctx, lt, D, t) {
    ctx.fillStyle = C.paper; ctx.fillRect(-100, -100, W + 200, H + 200);
    ctx.fillStyle = 'rgba(17,16,20,0.05)';
    for (let y = 0; y < H; y += 36) for (let x = (y / 36 % 2) * 18; x < W; x += 36) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
    // cantos com cores
    ctx.save(); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(-100, -100); ctx.lineTo(520, -100); ctx.lineTo(-100, 520); ctx.closePath(); ctx.fillStyle = C.brGreen; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-100, -100); ctx.lineTo(360, -100); ctx.lineTo(-100, 360); ctx.closePath(); ctx.fillStyle = C.brYellow; ctx.fill();
    ctx.beginPath(); ctx.moveTo(W + 100, -100); ctx.lineTo(W - 520, -100); ctx.lineTo(W + 100, 520); ctx.closePath(); ctx.fillStyle = C.esRed; ctx.fill();
    ctx.beginPath(); ctx.moveTo(W + 100, -100); ctx.lineTo(W - 360, -100); ctx.lineTo(W + 100, 360); ctx.closePath(); ctx.fillStyle = C.esYellow; ctx.fill();
    ctx.restore();
  },
  ui(ctx, lt, D, t) {
    const fk = pop(lt, 0.0, 0.4);
    withT(ctx, 130, 215, E.outBack(fk), -0.15, () => flagBR(ctx, -70, -49, 140, t, 0.8));
    withT(ctx, W - 130, 215, E.outBack(fk), 0.15, () => flagES(ctx, -70, -49, 140, t, 0.8));
    sticker(ctx, 'QUAL TE PEGARIA', W / 2, 400, 104, pop(lt, 0.15), { bg: C.ink, fg: '#fff', rot: -2 });
    sticker(ctx, 'PRIMEIRO?', W / 2, 532, 116, pop(lt, 0.3), { bg: C.accent, fg: C.ink, rot: 1.5 });
    const icons = [
      c => withT(c, 0, 10, 0.62, 0, () => ICON.toothbrush(c, 1)),
      c => withT(c, 0, 0, 0.62, 0, () => ICON.toiletPaper(c, 1)),
      c => withT(c, 0, 10, 0.5, -0.1, () => ICON.sneaker(c, 1)),
      c => withT(c, 0, 20, 0.62, 0, () => ICON.bag(c, 1)),
      c => withT(c, 0, 0, 0.66, 0, () => ICON.clock(c, 1, 21, 0)),
      c => withT(c, 0, 10, 0.56, 0, () => ICON.shop(c, 1, 1)),
    ];
    const labels = ['ESCOVA', 'PAPEL', '10X', 'SACOLA', 'JANTAR', 'DOMINGO'];
    icons.forEach((fn, i) => {
      const k = pop(lt, 0.3 + i * 0.15, 0.35);
      if (k <= 0) return;
      const x = 205 + (i % 3) * 335, y = 750 + Math.floor(i / 3) * 262 + Math.sin(lt * 2.4 + i) * 8;
      withT(ctx, x, y, E.outBack(k) * 0.88, Math.sin(lt * 1.6 + i) * 0.04, () => {
        softShadow(ctx, 22, 10, 0.25); circle(ctx, 0, 0, 118, i % 2 ? '#FFE9E3' : '#E6F4EA'); noShadow(ctx);
        ctx.lineWidth = 6; ctx.strokeStyle = i % 2 ? C.esRed : C.brGreen; ctx.beginPath(); ctx.arc(0, 0, 118, 0, Math.PI * 2); ctx.stroke();
        fn(ctx);
        circle(ctx, -86, -86, 34, C.ink); ctx.font = `44px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.accent; ctx.fillText(String(i + 1), -86, -84);
        ctx.font = `800 26px ${FONT_BODY}`; ctx.fillStyle = C.ink; ctx.font = `800 30px ${FONT_BODY}`; ctx.fillText(labels[i], 0, 146);
      });
    });
    // caixa de comentários
    const ck = pop(lt, 3.0, 0.4);
    if (ck > 0) {
      sticker(ctx, 'CONTA AÍ NOS COMENTÁRIOS 👇', W / 2, 1240, 64, ck, { bg: C.esRed, fg: '#fff', rot: -1 });
      withT(ctx, W / 2, 1350, E.outBack(ck), 0, () => {
        softShadow(ctx, 22, 10, 0.25); fillRR(ctx, -440, -54, 880, 108, 54, '#fff'); noShadow(ctx);
        circle(ctx, -385, 0, 34, C.brGreen); circle(ctx, -385, -8, 13, '#fff'); ellipse(ctx, -385, 18, 20, 10, '#fff');
        const full = 'a do 10x sem juros 😭'; const n = Math.floor(clamp((lt - 3.4) / 1.6) * [...full].length);
        const typed = [...full].slice(0, n).join('');
        ctx.font = `600 34px ${FONT_BODY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = typed ? C.ink : '#9CA3AF'; ctx.fillText(typed || 'Adicione um comentário…', -330, 2);
        if (typed && Math.floor(lt * 2.5) % 2) { const tw = ctx.measureText(typed).width; ctx.fillStyle = C.ink; ctx.fillRect(-326 + tw, -20, 4, 42); }
        const hk = pop(lt, 5.2, 0.3); ctx.font = `44px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillText(hk > 0 ? '❤️' : '🤍', 390, 4);
      });
    }
  },
};

const SCENE_DEFS = { gancho: S1, escova: S2, papel: S3, parcelado: S4, sacola: S5, jantar: S6, domingo: S7, cta: S8 };
