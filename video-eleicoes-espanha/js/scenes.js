// Cenas do vídeo "Eleições antecipadas na Espanha" (≤ 30 s).
// Cada cena = { cam(lt) -> [cx, cy, zoom], world(ctx, lt, D, t), ui(ctx, lt, D, t) }
// Visual propositalmente neutro: sem cores, siglas ou rostos de partidos.
'use strict';

const pop = (lt, a, d = 0.35) => prog(lt, a, a + d);
const camMix = (keys, lt) => {
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

function pill(ctx, txt, x, y, k, opt = {}) {
  if (k <= 0) return;
  ctx.save(); ctx.font = `800 ${opt.size || 40}px ${FONT_BODY}`;
  const tw = ctx.measureText(txt).width, h = (opt.size || 40) * 1.8, w = tw + h;
  ctx.translate(x, y); const s = E.outBack(clamp(k)); ctx.scale(s, s); ctx.rotate((opt.rot || 0) * Math.PI / 180);
  softShadow(ctx, 16, 6, 0.3); fillRR(ctx, -w / 2, -h / 2, w, h, h / 2, opt.bg || '#fff'); noShadow(ctx);
  ctx.fillStyle = opt.fg || C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 3);
  ctx.restore();
}

// ---------- fundo editorial ----------
function newsBg(ctx, t, tint = '#0F1530') {
  ctx.fillStyle = vgrad(ctx, -300, 2200, [[0, tint], [1, '#06080F']]); ctx.fillRect(-400, -400, 1900, 2800);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
  for (let x = -400; x < 1500; x += 90) { ctx.beginPath(); ctx.moveTo(x, -400); ctx.lineTo(x, 2400); ctx.stroke(); }
  for (let y = -400; y < 2400; y += 90) { ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(1500, y); ctx.stroke(); }
  // faixas diagonais vermelho/amarelo sutis
  ctx.save(); ctx.globalAlpha = 0.16; ctx.translate(540, 960); ctx.rotate(-0.5);
  ctx.fillStyle = C.esRed; ctx.fillRect(-1400, 520 + Math.sin(t) * 20, 2800, 160);
  ctx.fillStyle = C.esYellow; ctx.fillRect(-1400, 680 + Math.sin(t) * 20, 2800, 60);
  ctx.restore();
}

// ---------- elementos ----------
function ballotBox(ctx, x, y, s, fill = 0) {
  // urna transparente de acrílico (como as usadas na Espanha)
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ellipse(ctx, 0, 250, 300, 36, 'rgba(0,0,0,0.35)');
  // envelopes dentro
  const r = rng(12);
  for (let i = 0; i < Math.floor(fill * 26); i++) withT(ctx, -200 + r() * 400, 210 - r() * 160 * fill, 1, (r() - 0.5) * 0.9, () => { fillRR(ctx, -46, -30, 92, 60, 6, i % 4 ? '#F5F1E8' : '#E8DCC2'); });
  ctx.fillStyle = 'rgba(190,225,255,0.18)'; ctx.fillRect(-260, -150, 520, 400);
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(220,240,255,0.85)'; ctx.strokeRect(-260, -150, 520, 400);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-230, -130, 40, 360);
  // tampa
  fillRR(ctx, -290, -200, 580, 60, 14, '#1E3A8A');
  fillRR(ctx, -110, -182, 220, 22, 10, '#0B1430');
  ctx.font = `800 30px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('CONGRESO', 0, 60);
  ctx.restore();
}
function envelope(ctx, x, y, s, rot = 0) {
  withT(ctx, x, y, s, rot, () => {
    softShadow(ctx, 14, 6, 0.3); fillRR(ctx, -110, -70, 220, 140, 10, '#F5F1E8'); noShadow(ctx);
    ctx.beginPath(); ctx.moveTo(-110, -70); ctx.lineTo(0, 10); ctx.lineTo(110, -70); ctx.lineWidth = 4; ctx.strokeStyle = '#D6CDBA'; ctx.stroke();
  });
}
function calendarCard(ctx, x, y, s, top, big, sub, col = C.esRed) {
  withT(ctx, x, y, s, -0.04, () => {
    softShadow(ctx, 26, 12, 0.4); fillRR(ctx, -170, -190, 340, 380, 28, '#fff'); noShadow(ctx);
    ctx.save(); rr(ctx, -170, -190, 340, 380, 28); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(-170, -190, 340, 100); ctx.restore();
    circle(ctx, -90, -190, 14, '#333'); circle(ctx, 90, -190, 14, '#333');
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `56px ${FONT_HEAD}`; ctx.fillStyle = '#fff'; ctx.fillText(top, 0, -138);
    ctx.font = `170px ${FONT_HEAD}`; ctx.fillStyle = C.ink; ctx.fillText(big, 0, 20);
    ctx.font = `800 34px ${FONT_BODY}`; ctx.fillStyle = '#555'; ctx.fillText(sub, 0, 140);
  });
}
// Hemiciclo de 350 cadeiras, ordenadas da esquerda para a direita
let _seats = null;
function seats() {
  if (_seats) return _seats;
  const rows = 9, r0 = 170, r1 = 420, list = [];
  const radii = Array.from({ length: rows }, (_, i) => r0 + (r1 - r0) * i / (rows - 1));
  const sum = radii.reduce((a, b) => a + b, 0);
  let counts = radii.map(r => Math.round(350 * r / sum));
  counts[rows - 1] += 350 - counts.reduce((a, b) => a + b, 0);
  radii.forEach((r, i) => { for (let k = 0; k < counts[i]; k++) { const a = Math.PI - Math.PI * (k + 0.5) / counts[i]; list.push({ a, r }); } });
  list.sort((p, q) => q.a - p.a);
  return (_seats = list);
}
function hemicycle(ctx, cx, cy, s, shown, filled, opt = {}) {
  const L = seats();
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
  for (let i = 0; i < L.length; i++) {
    if (i >= shown) break;
    const { a, r } = L[i];
    const on = i < filled;
    circle(ctx, Math.cos(a) * r, -Math.sin(a) * r, 11, on ? (opt.fillCol || C.accent) : (opt.offCol || 'rgba(255,255,255,0.55)'));
  }
  ctx.restore();
}

// ====================== CENA 1 — GANCHO ======================
const S1 = {
  cam: lt => { const c = camMix([[0, 540, 1000, 1.25], [0.6, 540, 1020, 1.0, E.outQuint], [3.2, 540, 1020, 1.06]], lt); const sh = shake(lt, 0, 20, 0.3); const sh2 = shake(lt, 2.1, 14, 0.3); return [c[0] + sh[0] + sh2[0], c[1] + sh[1] + sh2[1], c[2]]; },
  world(ctx, lt, D, t) {
    newsBg(ctx, t);
    ballotBox(ctx, 540, 1060, 1.0, 0.25 + 0.15 * prog(lt, 0.9, 1.2));
    const k = prog(lt, 0.35, 0.95);
    if (k < 1) envelope(ctx, 540, lerp(420, 840, E.inCubic(k)), 0.9, lerp(-0.4, 0, k));
  },
  ui(ctx, lt, D, t) {
    flash(ctx, 0.7 * (1 - prog(lt, 0, 0.16)));
    sticker(ctx, 'ELEIÇÕES ANTECIPADAS', W / 2, 330, 98, pop(lt, 1.25), { bg: C.esRed, fg: C.esYellow, rot: -2 });
    sticker(ctx, ['NA ESPANHA ', { flag: 'es' }], W / 2, 462, 104, pop(lt, 1.45), { bg: '#fff', fg: C.ink, rot: 1.5, t });
    // carimbo da data
    const k = pop(lt, 2.1, 0.25);
    if (k > 0) withT(ctx, 800, 700, lerp(2.2, 1, E.outCubic(k)), -0.2, () => {
      ctx.globalAlpha = clamp(k * 2);
      ctx.lineWidth = 10; ctx.strokeStyle = C.accent; rr(ctx, -150, -62, 300, 124, 16); ctx.stroke();
      ctx.font = `92px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.accent; ctx.fillText('29/11', 0, 6);
    });
  },
};

// ====================== CENA 2 — DATA E 350 DEPUTADOS ======================
const S2 = {
  cam: lt => [540, 960, 1 + lt * 0.006],
  world(ctx, lt, D, t) { newsBg(ctx, t, '#131B3D'); },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'DOMINGO, 29/11', W / 2, 330, 104, pop(lt, 0.3), { bg: C.accent, fg: C.ink, rot: -2 });
    sticker(ctx, '350 DEPUTADOS', W / 2, 462, 100, pop(lt, 3.4), { bg: '#fff', fg: C.ink, rot: 1.5 });
    // calendário: entra grande, vira para 29 NOV e encolhe para o canto
    const mv = E.inOutCubic(prog(lt, 1.5, 2.0));
    const cs = lerp(1.15, 0.5, mv) * E.outBack(pop(lt, 0.05, 0.35));
    if (cs > 0) {
      const flip = prog(lt, 0.3, 0.6);
      withT(ctx, lerp(540, 900, mv), lerp(940, 650, mv), cs, 0, () => {
        if (flip < 0.5) { ctx.scale(1, 1 - flip * 2); calendarCard(ctx, 0, 0, 1, 'HOJE', '?', 'quando?', '#457B9D'); }
        else { ctx.scale(1, (flip - 0.5) * 2); calendarCard(ctx, 0, 0, 1, 'NOV', '29', 'DOMINGO'); }
      });
    }
    // hemiciclo enchendo
    const shown = Math.floor(350 * E.inOutCubic(prog(lt, 1.6, 3.3)));
    if (shown > 0) {
      hemicycle(ctx, 540, 1320, 1.0, shown, 0);
      const n = shown;
      outlined(ctx, String(n), 540, 1250, 150, { font: FONT_HEAD, weight: 400, color: '#fff', strokeColor: '#0F1530', strokeW: 10 });
      ctx.font = `800 30px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('CONGRESSO DOS DEPUTADOS', 540, 1360);
    }
  },
};

// ====================== CENA 3 — POR QUÊ ======================
function decree(ctx, x, y, s, rot, n) {
  withT(ctx, x, y, s, rot, () => {
    softShadow(ctx, 22, 10, 0.4); fillRR(ctx, -170, -230, 340, 460, 14, '#FBF8F1'); noShadow(ctx);
    ctx.font = `800 26px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#444'; ctx.fillText(`DECRETO ${n}`, 0, -180);
    // casinha
    ctx.beginPath(); ctx.moveTo(-80, -40); ctx.lineTo(0, -120); ctx.lineTo(80, -40); ctx.closePath(); ctx.fillStyle = C.esRed; ctx.fill();
    fillRR(ctx, -62, -42, 124, 100, 6, '#E9C46A'); fillRR(ctx, -16, 0, 32, 58, 4, '#7F5539');
    ctx.font = `800 30px ${FONT_BODY}`; ctx.fillStyle = C.ink; ctx.fillText('MORADIA', 0, 100);
    for (let i = 0; i < 4; i++) fillRR(ctx, -120, 140 + i * 22, i === 3 ? 140 : 240, 8, 4, '#D9D2C3');
  });
}
const S3 = {
  cam: lt => [540, 960, 1 + lt * 0.006],
  world(ctx, lt, D, t) { newsBg(ctx, t, '#1A1430'); },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'POR QUÊ?', W / 2, 330, 110, pop(lt, 0.25), { bg: '#fff', fg: C.ink, rot: -2 });
    const phaseB = E.inOutCubic(prog(lt, 4.0, 4.4));
    // fase A: dois decretos derrubados
    if (phaseB < 1) {
      ctx.save(); ctx.globalAlpha = 1 - phaseB; ctx.translate(0, -phaseB * 200);
      const a = E.outBack(pop(lt, 0.3, 0.45)), b = E.outBack(pop(lt, 0.5, 0.45));
      if (a > 0) decree(ctx, 370, 900, 0.95 * a, -0.08, 1);
      if (b > 0) decree(ctx, 710, 920, 0.95 * b, 0.07, 2);
      const st = pop(lt, 1.9, 0.22);
      if (st > 0) withT(ctx, 540, 930, lerp(2.4, 1, E.outCubic(st)), -0.18, () => {
        ctx.globalAlpha *= clamp(st * 2);
        ctx.lineWidth = 14; ctx.strokeStyle = C.esRed; rr(ctx, -330, -80, 660, 160, 18); ctx.stroke();
        ctx.font = `120px ${FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.esRed; ctx.fillText('DERRUBADOS', 0, 8);
      });
      pill(ctx, 'votaram contra: Junts, PP e Vox', W / 2, 1260, pop(lt, 2.5, 0.3), { size: 36, bg: '#fff' });
      ctx.restore();
    }
    // fase B: 2027 -> 2026
    if (phaseB > 0) {
      ctx.save(); ctx.globalAlpha = phaseB;
      const yk = E.outBack(pop(lt, 4.2, 0.4));
      withT(ctx, 540, 820, yk, 0, () => {
        outlined(ctx, '2027', 0, 0, 230, { font: FONT_HEAD, weight: 400, color: 'rgba(255,255,255,0.9)', strokeColor: '#1A1430', strokeW: 8 });
        const sk = prog(lt, 4.6, 4.9);
        if (sk > 0) strokeProgress(ctx, [[-230, 30], [230, -30]], sk, 22, C.esRed);
      });
      const nk = pop(lt, 4.9, 0.4);
      if (nk > 0) {
        withT(ctx, 540, 1110, E.outBack(nk), -0.05, () => outlined(ctx, '2026', 0, 0, 230, { font: FONT_HEAD, weight: 400, color: C.accent, strokeColor: '#1A1430', strokeW: 8 }));
        pill(ctx, 'ANTECIPADA ⏩', W / 2, 1290, pop(lt, 5.2, 0.3), { size: 38, bg: C.esRed, fg: '#fff' });
      }
      ctx.restore();
    }
    if (phaseB <= 0) return;
  },
};

// ====================== CENA 4 — MAIORIA 176 ======================
const S4 = {
  cam: lt => [540, 960, 1 + lt * 0.008],
  world(ctx, lt, D, t) { newsBg(ctx, t, '#131B3D'); },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'PRA GOVERNAR:', W / 2, 330, 100, pop(lt, 0.25), { bg: '#fff', fg: C.ink, rot: -2 });
    sticker(ctx, '176 CADEIRAS', W / 2, 462, 110, pop(lt, 0.45), { bg: C.accent, fg: C.ink, rot: 1.5 });
    const filled = Math.floor(176 * E.inOutCubic(prog(lt, 0.5, 2.0)));
    hemicycle(ctx, 540, 1180, 1.12, 350, filled, { offCol: 'rgba(255,255,255,0.28)' });
    // linha da maioria (meio do hemiciclo)
    const mk = prog(lt, 1.9, 2.2);
    if (mk > 0) {
      ctx.save(); ctx.setLineDash([18, 12]);
      strokeProgress(ctx, [[540, 1200], [540, 1180 - 520]], mk, 6, '#fff');
      ctx.restore();
      pill(ctx, 'MAIORIA: 176', 540, 610, pop(lt, 2.0, 0.3), { size: 40, bg: '#fff' });
    }
    outlined(ctx, String(filled), 540, 1120, 140, { font: FONT_HEAD, weight: 400, color: C.accent, strokeColor: '#0F1530', strokeW: 10 });
    // "ou alianças"
    const ak = pop(lt, 3.0, 0.35);
    if (ak > 0) {
      bubble(ctx, 200, 760, 70, ak, '🤝', { size: 80, rot: -0.15 });
      pill(ctx, 'ou alianças', 540, 1290, ak, { size: 40, bg: C.esRed, fg: '#fff' });
    }
  },
};

// ====================== CENA 5 — QUEM VOTA ======================
function passport(ctx, x, y, s, rot, col, title, sub) {
  withT(ctx, x, y, s, rot, () => {
    softShadow(ctx, 24, 12, 0.45); fillRR(ctx, -150, -210, 300, 420, 22, col); noShadow(ctx);
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,215,120,0.6)'; rr(ctx, -132, -192, 264, 384, 16); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#E9C46A';
    ctx.font = `800 30px ${FONT_BODY}`; ctx.fillText(title, 0, -130);
    ctx.beginPath(); ctx.arc(0, -10, 62, 0, Math.PI * 2); ctx.lineWidth = 6; ctx.strokeStyle = '#E9C46A'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -10, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.font = `800 22px ${FONT_BODY}`; ctx.fillText(sub, 0, 120);
    fillRR(ctx, -40, 150, 80, 50, 8, 'rgba(233,196,106,0.3)');
  });
}
const S5 = {
  cam: lt => [540, 960, 1 + lt * 0.008],
  world(ctx, lt, D, t) { newsBg(ctx, t, '#102A22'); },
  ui(ctx, lt, D, t) {
    sticker(ctx, ['E OS BRASILEIROS? ', { flag: 'br' }], W / 2, 330, 96, pop(lt, 0.25), { bg: C.brGreen, fg: C.brYellow, rot: -2, t });
    const a = pop(lt, 0.3, 0.4), b = pop(lt, 0.85, 0.4);
    if (a > 0) passport(ctx, 320, 880, 0.95 * E.outBack(a), -0.08, '#7A1F2B', 'ESPAÑA', 'PASAPORTE');
    if (b > 0) passport(ctx, 760, 900, 0.95 * E.outBack(b), 0.07, '#1B2A55', 'BRASIL', 'PASSAPORTE');
    const ok = pop(lt, 1.0, 0.3);
    if (ok > 0) { withT(ctx, 320, 1160, E.outBack(ok), 0, () => { circle(ctx, 0, 0, 52, C.brGreen); line(ctx, [[-22, 2], [-6, 20], [24, -16]], 12, '#fff'); }); pill(ctx, 'VOTA', 320, 1250, ok, { size: 34, bg: '#fff' }); }
    const no = pop(lt, 1.9, 0.3);
    if (no > 0) {
      bigX(ctx, 760, 900, 150, prog(lt, 1.9, 2.2), C.esRed, 26);
      pill(ctx, 'NÃO VOTA*', 760, 1250, no, { size: 34, bg: C.esRed, fg: '#fff' });
    }
    pill(ctx, '*com nacionalidade espanhola, vota ✔', W / 2, 1360, pop(lt, 2.6, 0.3), { size: 32, bg: C.accent });
  },
};

// ====================== CENA 6 — CTA ======================
const S6 = {
  cam: lt => [540, 960, 1 + lt * 0.006],
  world(ctx, lt, D, t) {
    newsBg(ctx, t);
    ballotBox(ctx, 540, 840, 0.62, 0.9);
  },
  ui(ctx, lt, D, t) {
    sticker(ctx, 'MUDA ALGUMA COISA?', W / 2, 330, 100, pop(lt, 0.2), { bg: '#fff', fg: C.ink, rot: -2 });
    sticker(ctx, 'COMENTA AÍ 👇', W / 2, 462, 110, pop(lt, 0.4), { bg: C.esRed, fg: C.esYellow, rot: 1.5 });
    const ck = pop(lt, 0.9, 0.35);
    if (ck > 0) withT(ctx, W / 2, 1150, E.outBack(ck), 0, () => {
      softShadow(ctx, 22, 10, 0.3); fillRR(ctx, -440, -54, 880, 108, 54, '#fff'); noShadow(ctx);
      circle(ctx, -385, 0, 34, C.esRed); circle(ctx, -385, -8, 13, '#fff'); ellipse(ctx, -385, 18, 20, 10, '#fff');
      const full = 'vou acompanhar a apuração 👀'; const n = Math.floor(clamp((lt - 1.2) / 1.5) * [...full].length);
      const typed = [...full].slice(0, n).join('');
      ctx.font = `600 34px ${FONT_BODY}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = typed ? C.ink : '#9CA3AF'; ctx.fillText(typed || 'Adicione um comentário…', -330, 2);
      if (typed && Math.floor(lt * 2.5) % 2) { const tw = ctx.measureText(typed).width; ctx.fillStyle = C.ink; ctx.fillRect(-326 + tw, -20, 4, 42); }
      ctx.font = `44px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillText(lt > 2.6 ? '❤️' : '🤍', 390, 4);
    });
    ctx.save(); ctx.globalAlpha = clamp((lt - 1.0) * 2) * 0.75;
    ctx.font = `600 24px ${FONT_BODY}`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText('Fontes: Al Jazeera (05/10/2026), BOE (06/10/2026)', W / 2, 1280);
    ctx.restore();
  },
};

const SCENE_DEFS = { gancho: S1, data: S2, motivo: S3, maioria: S4, voto: S5, cta: S6 };
