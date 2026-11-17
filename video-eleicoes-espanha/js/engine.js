// Motor gráfico: utilitários de animação, tipografia, bandeiras, personagens e efeitos.
// Tudo é determinístico: cada frame depende só do tempo t, o que permite renderizar frame a frame.
'use strict';

const W = 1080, H = 1920;

const C = {
  ink: '#111014',
  paper: '#F6F1E7',
  white: '#FFFFFF',
  brGreen: '#009C3B',
  brYellow: '#FFDF00',
  brBlue: '#002776',
  esRed: '#C60B1E',
  esYellow: '#FFC400',
  accent: '#FFD400',
  pink: '#FF5A7A',
  sky: '#7FC8F8',
  skin: ['#8D5524', '#C68642', '#E0AC69', '#F1C27D', '#6B3E26', '#FFDBAC'],
};

// ---------- matemática / easing ----------
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outCubic: k => 1 - Math.pow(1 - k, 3),
  inCubic: k => k * k * k,
  inOutCubic: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outBack: k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  outElastic: k => (k === 0 || k === 1 ? k : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  outQuint: k => 1 - Math.pow(1 - k, 5),
};
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const wobble = (t, f = 1, a = 1, ph = 0) => Math.sin(t * f * Math.PI * 2 + ph) * a;

// ---------- primitivas ----------
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fillRR(ctx, x, y, w, h, r, fill) { rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }
function line(ctx, pts, w, color, cap = 'round') {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = cap; ctx.lineJoin = 'round'; ctx.stroke();
}
function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
function softShadow(ctx, blur = 30, y = 14, a = 0.28) {
  ctx.shadowColor = `rgba(0,0,0,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; ctx.shadowOffsetX = 0;
}
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowOffsetX = 0; }
function withT(ctx, x, y, s, rot, fn) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (s !== 1) ctx.scale(s, s); fn(); ctx.restore();
}
// Câmera virtual: centraliza (cx,cy) na tela com zoom z
function camera(ctx, cx, cy, z, rot = 0) {
  ctx.translate(W / 2, H / 2); if (rot) ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-cx, -cy);
}

// Traço progressivo (rabiscos, sublinhados, círculos desenhados à mão)
function strokeProgress(ctx, pts, k, w, color) {
  if (k <= 0) return;
  let total = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
  let rem = total * clamp(k);
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length && rem > 0; i++) {
    const d = seg[i - 1];
    if (rem >= d) ctx.lineTo(pts[i][0], pts[i][1]);
    else { const f = rem / d; ctx.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); }
    rem -= d;
  }
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}
function scribbleCircle(ctx, x, y, rx, ry, k, color = C.accent, w = 10, seed = 3) {
  const r = rng(seed), pts = [];
  for (let i = 0; i <= 80; i++) {
    const a = -Math.PI / 2 + (i / 80) * Math.PI * 2.15;
    const j = 1 + (r() - 0.5) * 0.06;
    pts.push([x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j]);
  }
  strokeProgress(ctx, pts, k, w, color);
}
function underline(ctx, x0, x1, y, k, color = C.accent, w = 12) {
  const pts = []; for (let i = 0; i <= 20; i++) { const f = i / 20; pts.push([lerp(x0, x1, f), y + Math.sin(f * Math.PI * 3) * 6]); }
  strokeProgress(ctx, pts, k, w, color);
}
function arrow(ctx, x0, y0, x1, y1, k, color = C.white, w = 12, bend = 80) {
  const mx = (x0 + x1) / 2 - (y1 - y0) * bend / 400, my = (y0 + y1) / 2 + (x1 - x0) * bend / 400;
  const pts = []; for (let i = 0; i <= 30; i++) { const f = i / 30; pts.push([(1 - f) * (1 - f) * x0 + 2 * (1 - f) * f * mx + f * f * x1, (1 - f) * (1 - f) * y0 + 2 * (1 - f) * f * my + f * f * y1]); }
  strokeProgress(ctx, pts, k, w, color);
  if (k > 0.95) {
    const a = Math.atan2(y1 - pts[27][1], x1 - pts[27][0]);
    line(ctx, [[x1 - Math.cos(a - 0.5) * 40, y1 - Math.sin(a - 0.5) * 40], [x1, y1], [x1 - Math.cos(a + 0.5) * 40, y1 - Math.sin(a + 0.5) * 40]], w, color);
  }
}
function bigX(ctx, x, y, s, k, color = C.esRed, w = 22) {
  strokeProgress(ctx, [[x - s, y - s], [x + s, y + s]], prog(k, 0, 0.5), w, color);
  strokeProgress(ctx, [[x + s, y - s], [x - s, y + s]], prog(k, 0.5, 1), w, color);
}

// ---------- bandeiras ----------
function flagBR(ctx, x, y, w, t = 0, wave = 0) {
  const h = w * 0.7;
  ctx.save(); rr(ctx, x, y, w, h, w * 0.07); ctx.clip();
  ctx.fillStyle = C.brGreen; ctx.fillRect(x, y, w, h);
  ctx.beginPath(); ctx.moveTo(x + w * 0.085, y + h / 2); ctx.lineTo(x + w / 2, y + h * 0.12); ctx.lineTo(x + w * 0.915, y + h / 2); ctx.lineTo(x + w / 2, y + h * 0.88); ctx.closePath();
  ctx.fillStyle = C.brYellow; ctx.fill();
  circle(ctx, x + w / 2, y + h / 2, h * 0.25, C.brBlue);
  ctx.beginPath(); ctx.arc(x + w * 0.43, y + h * 0.76, h * 0.33, -Math.PI * 0.58, -Math.PI * 0.2);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = h * 0.045; ctx.stroke();
  const r = rng(7); for (let i = 0; i < 9; i++) circle(ctx, x + w / 2 + (r() - 0.5) * h * 0.34, y + h / 2 + h * 0.03 + r() * h * 0.15, h * 0.012, '#fff');
  if (wave) shade(ctx, x, y, w, h, t, wave);
  ctx.restore();
}
function flagES(ctx, x, y, w, t = 0, wave = 0) {
  const h = w * 0.7;
  ctx.save(); rr(ctx, x, y, w, h, w * 0.07); ctx.clip();
  ctx.fillStyle = C.esRed; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.esYellow; ctx.fillRect(x, y + h * 0.25, w, h * 0.5);
  // brasão simplificado
  fillRR(ctx, x + w * 0.22, y + h * 0.36, w * 0.1, h * 0.28, w * 0.02, '#AD1519');
  fillRR(ctx, x + w * 0.205, y + h * 0.33, w * 0.13, h * 0.05, w * 0.01, '#C8A400');
  if (wave) shade(ctx, x, y, w, h, t, wave);
  ctx.restore();
}
function shade(ctx, x, y, w, h, t, a) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  for (let i = 0; i <= 6; i++) { const v = Math.sin(i * 1.3 + t * 5) * a; g.addColorStop(i / 6, v > 0 ? `rgba(255,255,255,${v * 0.25})` : `rgba(0,0,0,${-v * 0.3})`); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}
function flag(ctx, which, x, y, w, t, wave) { (which === 'br' ? flagBR : flagES)(ctx, x, y, w, t, wave); }

// ---------- tipografia ----------
const FONT_HEAD = "'Anton', 'Impact', 'Noto Color Emoji', sans-serif";
const FONT_BODY = "'Montserrat', 'Arial Black', 'Noto Color Emoji', sans-serif";

// Mede/desenha uma linha composta de pedaços: strings e {flag:'br'|'es'}
function richMeasure(ctx, parts, size) {
  let w = 0;
  for (const p of parts) w += typeof p === 'string' ? ctx.measureText(p).width : size * 1.05 + size * 0.18;
  return w;
}
function richDraw(ctx, parts, x, y, size, color, t) {
  let cx = x;
  for (const p of parts) {
    if (typeof p === 'string') { ctx.fillStyle = color; ctx.fillText(p, cx, y); cx += ctx.measureText(p).width; }
    else { const fw = size * 1.05; flag(ctx, p.flag, cx + size * 0.09, y - size * 0.8, fw, t, 0.5); cx += fw + size * 0.18; }
  }
}

// "Sticker" editorial: faixa colorida inclinada com texto grande. pop = progresso 0..1 de entrada.
function sticker(ctx, parts, x, y, size, pop, opt = {}) {
  if (pop <= 0) return;
  if (typeof parts === 'string') parts = [parts];
  const bg = opt.bg || C.ink, fg = opt.fg || C.white, rot = (opt.rot || 0) * Math.PI / 180;
  ctx.save();
  ctx.font = `${size}px ${opt.font || FONT_HEAD}`; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const tw = richMeasure(ctx, parts, size), padX = size * 0.32, padY = size * 0.2;
  const bw = tw + padX * 2, bh = size * 1.12 + padY;
  const s = pop < 1 ? E.outBack(pop) : 1;
  const extraRot = (1 - E.outCubic(pop)) * 0.25 * (opt.dir || 1);
  ctx.translate(x, y); ctx.rotate(rot + extraRot); ctx.scale(s, s);
  ctx.globalAlpha = clamp(pop * 3);
  softShadow(ctx, 26, 12, 0.35);
  fillRR(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.14, bg);
  noShadow(ctx);
  if (opt.border) { rr(ctx, -bw / 2, -bh / 2, bw, bh, size * 0.14); ctx.lineWidth = 6; ctx.strokeStyle = opt.border; ctx.stroke(); }
  richDraw(ctx, parts, -tw / 2, size * 0.4, size, fg, opt.t || 0);
  ctx.restore();
}

// Texto simples com contorno
function outlined(ctx, str, x, y, size, opt = {}) {
  ctx.save();
  ctx.font = `${opt.weight || 800} ${size}px ${opt.font || FONT_BODY}`;
  ctx.textAlign = opt.align || 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.miterLimit = 2;
  if (opt.stroke !== false) { ctx.lineWidth = opt.strokeW || size * 0.2; ctx.strokeStyle = opt.strokeColor || C.ink; ctx.strokeText(str, x, y); }
  ctx.fillStyle = opt.color || C.white; ctx.fillText(str, x, y);
  ctx.restore();
}

// ---------- personagens (ilustração flat editorial) ----------
// Origem (x,y) = ponto entre os pés. s = escala (altura ≈ 720*s).
function ik(sx, sy, hx, hy, l1, l2, bend) {
  const dx = hx - sx, dy = hy - sy; let d = Math.hypot(dx, dy);
  d = Math.min(d, l1 + l2 - 0.01);
  const a = Math.atan2(dy, dx);
  const cosB = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const b = Math.acos(cosB) * bend;
  return [sx + Math.cos(a - b) * l1, sy + Math.sin(a - b) * l1];
}
function person(ctx, x, y, s, o = {}) {
  const skin = o.skin || C.skin[2], shirt = o.shirt || '#2F80ED', pants = o.pants || '#2B2D42';
  const hair = o.hair || '#2A1B12', style = o.hairStyle || 'short', expr = o.expr || 'neutral';
  const look = o.look || 0, t = o.t || 0, bob = o.bob || 0;
  const P = (px, py) => [x + px * s, y + py * s + bob * s];
  ctx.save();
  // sombra no chão
  ellipse(ctx, x, y + 6 * s, 150 * s, 24 * s, 'rgba(0,0,0,0.18)');
  if (!o.hideLegs) {
    const leg = (dx) => { const [a, b] = P(dx, -300); fillRR(ctx, a - 34 * s, b, 68 * s, 300 * s + (-bob * s), 30 * s, pants); };
    leg(-44); leg(44);
    const shoe = o.shoe || '#F2F2F2';
    ellipse(ctx, x - 52 * s, y - 8 * s, 52 * s, 22 * s, shoe); ellipse(ctx, x + 52 * s, y - 8 * s, 52 * s, 22 * s, shoe);
  }
  // cabelo longo atrás
  const [hx, hy] = P(0, -650);
  if (style === 'long') fillRR(ctx, hx - 92 * s, hy - 60 * s, 184 * s, 230 * s, 80 * s, hair);
  // tronco
  const [tx, ty] = P(-108, -570);
  fillRR(ctx, tx, ty, 216 * s, 300 * s, 70 * s, shirt);
  if (o.shirtStripe) { ctx.save(); rr(ctx, tx, ty, 216 * s, 300 * s, 70 * s); ctx.clip(); ctx.fillStyle = o.shirtStripe; ctx.fillRect(tx, ty + 120 * s, 216 * s, 38 * s); ctx.restore(); }
  if (o.apron) { fillRR(ctx, tx + 40 * s, ty + 60 * s, 136 * s, 250 * s, 24 * s, o.apron); }
  // pescoço
  fillRR(ctx, hx - 26 * s, hy + 50 * s, 52 * s, 50 * s, 16 * s, skin);
  // braços (atrás das mãos com objetos)
  const arm = (side, hand) => {
    const [sx, sy] = P(side * 92, -530);
    const [hx2, hy2] = hand ? P(hand[0], hand[1]) : P(side * 120, -310);
    const [ex, ey] = ik(sx, sy, hx2, hy2, 150 * s, 150 * s, side * (o.bend || 1));
    line(ctx, [[sx, sy], [ex, ey]], 58 * s, shirt);
    line(ctx, [[ex, ey], [hx2, hy2]], 44 * s, skin);
    circle(ctx, hx2, hy2, 28 * s, skin);
    return [hx2, hy2];
  };
  const hl = arm(-1, o.handL), hr = arm(1, o.handR);
  // cabeça
  circle(ctx, hx, hy, 82 * s, skin);
  ellipse(ctx, hx - 80 * s, hy + 6 * s, 14 * s, 22 * s, skin); ellipse(ctx, hx + 80 * s, hy + 6 * s, 14 * s, 22 * s, skin);
  // cabelo frente
  ctx.fillStyle = hair;
  if (style === 'short' || style === 'long') {
    ctx.beginPath(); ctx.arc(hx, hy - 4 * s, 86 * s, Math.PI * 1.02, Math.PI * 1.98); ctx.quadraticCurveTo(hx + 30 * s, hy - 70 * s, hx - 40 * s, hy - 40 * s); ctx.quadraticCurveTo(hx - 70 * s, hy - 30 * s, hx - 86 * s, hy - 6 * s); ctx.fill();
  } else if (style === 'curly') {
    const r = rng(11); for (let i = 0; i < 14; i++) { const a = Math.PI * (1.0 + i / 13); circle(ctx, hx + Math.cos(a) * 78 * s, hy - 10 * s + Math.sin(a) * 74 * s, (26 + r() * 10) * s, hair); }
    circle(ctx, hx, hy - 60 * s, 50 * s, hair);
  } else if (style === 'bun') {
    circle(ctx, hx, hy - 100 * s, 40 * s, hair);
    ctx.beginPath(); ctx.arc(hx, hy - 4 * s, 86 * s, Math.PI * 1.0, Math.PI * 2.0); ctx.quadraticCurveTo(hx, hy - 50 * s, hx - 86 * s, hy - 4 * s); ctx.fill();
  } else if (style === 'cap') {
    ctx.beginPath(); ctx.arc(hx, hy - 10 * s, 86 * s, Math.PI, Math.PI * 2); ctx.fillStyle = o.capColor || C.esRed; ctx.fill();
    fillRR(ctx, hx - 10 * s, hy - 24 * s, 130 * s, 22 * s, 10 * s, o.capColor || C.esRed);
  }
  if (o.beard) { ctx.beginPath(); ctx.arc(hx, hy + 10 * s, 80 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.lineTo(hx - 40 * s, hy + 30 * s); ctx.quadraticCurveTo(hx, hy + 60 * s, hx + 40 * s, hy + 30 * s); ctx.fillStyle = hair; ctx.fill(); }
  if (o.glasses) {
    ctx.lineWidth = 6 * s; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.arc(hx - 32 * s, hy - 2 * s, 24 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx + 32 * s, hy - 2 * s, 24 * s, 0, Math.PI * 2); ctx.stroke();
    line(ctx, [[hx - 8 * s, hy - 2 * s], [hx + 8 * s, hy - 2 * s]], 6 * s, C.ink);
  }
  face(ctx, hx, hy, s, expr, look, t);
  ctx.restore();
  return { handL: hl, handR: hr, head: [hx, hy], mouth: [hx, hy + 40 * s] };
}
function face(ctx, hx, hy, s, expr, look, t) {
  const ex = 32 * s, ey = hy - 4 * s, ink = '#1B1B1F';
  const blink = (Math.floor(t * 10) % 37 === 0) ? 0.15 : 1;
  ellipse(ctx, hx - 52 * s, hy + 28 * s, 16 * s, 10 * s, 'rgba(255,90,90,0.28)');
  ellipse(ctx, hx + 52 * s, hy + 28 * s, 16 * s, 10 * s, 'rgba(255,90,90,0.28)');
  ctx.lineCap = 'round';
  if (expr === 'surprised' || expr === 'shock') {
    const big = expr === 'shock' ? 1.35 : 1;
    for (const d of [-1, 1]) {
      ellipse(ctx, hx + d * ex, ey, 18 * s * big, 22 * s * big, '#fff');
      circle(ctx, hx + d * ex + look * 8 * s, ey + 2 * s, 9 * s * big, ink);
      circle(ctx, hx + d * ex + look * 8 * s + 3 * s, ey - 2 * s, 3 * s, '#fff');
      line(ctx, [[hx + d * ex - 18 * s, ey - 42 * s * big], [hx + d * ex + 14 * s, ey - 48 * s * big + d * 2 * s]], 8 * s, ink);
    }
    ellipse(ctx, hx, hy + 44 * s, 15 * s * big, 20 * s * big, '#5A1F1F');
  } else if (expr === 'happy') {
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + d * ex, ey + 6 * s, 14 * s, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = 8 * s; ctx.strokeStyle = ink; ctx.stroke(); }
    ctx.beginPath(); ctx.arc(hx, hy + 26 * s, 34 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); ctx.fillStyle = '#5A1F1F'; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy + 26 * s, 34 * s, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); ctx.clip(); fillRR(ctx, hx - 30 * s, hy + 26 * s, 60 * s, 12 * s, 4 * s, '#fff'); ctx.restore();
  } else if (expr === 'frustrated') {
    for (const d of [-1, 1]) {
      circle(ctx, hx + d * ex, ey + 4 * s, 9 * s, ink);
      line(ctx, [[hx + d * ex + d * 20 * s, ey - 34 * s], [hx + d * ex - d * 14 * s, ey - 24 * s]], 8 * s, ink);
    }
    const pts = []; for (let i = 0; i <= 10; i++) pts.push([hx - 26 * s + i * 5.2 * s, hy + 46 * s + Math.sin(i * 1.4) * 4 * s]);
    line(ctx, pts, 7 * s, ink);
    // gota de suor
    ctx.beginPath(); const gx = hx + 76 * s, gy = hy - 46 * s + ((t * 30) % 20) * s;
    ctx.moveTo(gx, gy - 22 * s); ctx.quadraticCurveTo(gx + 16 * s, gy, gx, gy + 10 * s); ctx.quadraticCurveTo(gx - 16 * s, gy, gx, gy - 22 * s); ctx.fillStyle = '#7FD3FF'; ctx.fill();
  } else if (expr === 'brushing') {
    for (const d of [-1, 1]) ellipse(ctx, hx + d * ex + look * 6 * s, ey + 4 * s, 9 * s, 9 * s * blink, ink);
    ellipse(ctx, hx, hy + 40 * s, 24 * s, 14 * s, '#5A1F1F');
  } else if (expr === 'side') {
    for (const d of [-1, 1]) {
      ellipse(ctx, hx + d * ex, ey, 16 * s, 12 * s, '#fff');
      circle(ctx, hx + d * ex + look * 9 * s, ey, 8 * s, ink);
      line(ctx, [[hx + d * ex - 16 * s, ey - 26 * s], [hx + d * ex + 16 * s, ey - 30 * s]], 7 * s, ink);
    }
    line(ctx, [[hx - 14 * s, hy + 44 * s], [hx + 18 * s, hy + 40 * s]], 7 * s, ink);
  } else {
    for (const d of [-1, 1]) ellipse(ctx, hx + d * ex + look * 6 * s, ey + 4 * s, 9 * s, 10 * s * blink, ink);
    ctx.beginPath(); ctx.arc(hx, hy + 26 * s, 22 * s, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = 7 * s; ctx.strokeStyle = ink; ctx.stroke();
  }
}

// Balão de reação
function bubble(ctx, x, y, r, pop, content, opt = {}) {
  if (pop <= 0) return;
  const s = E.outBack(clamp(pop));
  withT(ctx, x, y, s, opt.rot || 0, () => {
    softShadow(ctx, 18, 8, 0.25);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.moveTo(-r * 0.3, r * 0.85); ctx.lineTo(-r * 0.75 * (opt.tail || 1), r * 1.35); ctx.lineTo(r * 0.15, r * 0.95);
    ctx.fillStyle = opt.bg || '#fff'; ctx.fill(); noShadow(ctx);
    ctx.font = `${opt.size || r * 0.95}px ${opt.font || FONT_HEAD}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = opt.fg || C.ink; ctx.fillText(content, 0, r * 0.06);
  });
}

// ---------- efeitos de acabamento ----------
let _grain = null;
function grain(ctx, t, a = 0.07) {
  if (!_grain) {
    _grain = document.createElement('canvas'); _grain.width = _grain.height = 256;
    const g = _grain.getContext('2d'), d = g.createImageData(256, 256), r = rng(42);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }
  ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'overlay';
  const f = Math.floor(t * 24), ox = (f * 73) % 256, oy = (f * 151) % 256;
  ctx.translate(-ox, -oy); ctx.fillStyle = ctx.createPattern(_grain, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
function vignette(ctx, a = 0.45) {
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function flash(ctx, k, color = '#fff') { if (k <= 0) return; ctx.save(); ctx.globalAlpha = clamp(k); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
// Linhas de velocidade (para zooms)
function speedLines(ctx, cx, cy, k, t, color = 'rgba(255,255,255,0.75)') {
  if (k <= 0) return;
  const r = rng(Math.floor(t * 20) + 5);
  ctx.save(); ctx.globalAlpha = clamp(k);
  for (let i = 0; i < 48; i++) {
    const a = r() * Math.PI * 2, r0 = 420 + r() * 220, r1 = r0 + 300 + r() * 600;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineWidth = 3 + r() * 8; ctx.strokeStyle = color; ctx.stroke();
  }
  ctx.restore();
}
// Transição: faixas diagonais nas cores BR/ES varrendo a tela. k: 0..1 (0.5 = tela coberta)
function bandWipe(ctx, k, dir = 1) {
  if (k <= 0 || k >= 1) return;
  const cols = [C.brGreen, C.brYellow, C.ink, C.esYellow, C.esRed];
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.35 * dir);
  const span = 2600, bw = 520;
  cols.forEach((c, i) => {
    const d = i * 0.07;
    const p = E.inOutCubic(clamp((k - d) / (1 - 0.28)));
    const x = lerp(-span, span, p) - (i - 2) * 60;
    ctx.fillStyle = c; ctx.fillRect(x - bw * 1.6, -1800, bw * 3.2, 3600);
  });
  ctx.restore();
}

// Ícones simples reutilizados (escova, papel, tênis, sacola, relógio, loja)
const ICON = {
  toothbrush(ctx, s = 1) {
    ctx.save(); ctx.rotate(-0.6);
    fillRR(ctx, -14 * s, -10 * s, 28 * s, 220 * s, 14 * s, '#2EC4B6');
    fillRR(ctx, -16 * s, -60 * s, 32 * s, 60 * s, 8 * s, '#E8F7F6');
    for (let i = 0; i < 5; i++) fillRR(ctx, 16 * s, (-56 + i * 11) * s, 18 * s, 7 * s, 3 * s, '#fff');
    ctx.restore();
  },
  toiletPaper(ctx, s = 1) {
    rr(ctx, -72 * s, -62 * s, 144 * s, 124 * s, 22 * s); ctx.fillStyle = '#C9C2B5'; ctx.fill();
    fillRR(ctx, -70 * s, -60 * s, 140 * s, 120 * s, 20 * s, '#FFFFFF');
    fillRR(ctx, -70 * s, -20 * s, 140 * s, 14 * s, 0, '#E8E1D5');
    ellipse(ctx, 70 * s, 0, 22 * s, 60 * s, '#F0F0F0');
    ellipse(ctx, 70 * s, 0, 9 * s, 22 * s, '#CFC8BC');
    fillRR(ctx, -70 * s, 50 * s, 60 * s, 70 * s, 6 * s, '#FFFFFF');
    line(ctx, [[-70 * s, 90 * s], [-10 * s, 90 * s]], 2 * s, '#ddd');
  },
  sneaker(ctx, s = 1, col = '#FF5A3C', accent = '#1E1E24') {
    ctx.save();
    // sola
    fillRR(ctx, -170 * s, 20 * s, 340 * s, 46 * s, 22 * s, '#F7F7F7');
    line(ctx, [[-160 * s, 54 * s], [160 * s, 54 * s]], 6 * s, '#D9D9D9');
    // cabedal
    ctx.beginPath();
    ctx.moveTo(-160 * s, 24 * s);
    ctx.quadraticCurveTo(-176 * s, -60 * s, -110 * s, -96 * s);
    ctx.lineTo(-40 * s, -100 * s);
    ctx.quadraticCurveTo(10 * s, -40 * s, 90 * s, -30 * s);
    ctx.quadraticCurveTo(170 * s, -20 * s, 168 * s, 24 * s);
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    // detalhe lateral
    ctx.beginPath(); ctx.moveTo(-120 * s, 10 * s); ctx.quadraticCurveTo(-20 * s, -40 * s, 120 * s, -8 * s); ctx.quadraticCurveTo(-10 * s, -10 * s, -120 * s, 10 * s);
    ctx.fillStyle = accent; ctx.fill();
    // biqueira e calcanhar
    ctx.beginPath(); ctx.moveTo(100 * s, -28 * s); ctx.quadraticCurveTo(170 * s, -18 * s, 168 * s, 24 * s); ctx.lineTo(110 * s, 24 * s); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
    fillRR(ctx, -170 * s, -70 * s, 30 * s, 70 * s, 12 * s, accent);
    // cadarços
    for (let i = 0; i < 4; i++) line(ctx, [[(-30 + i * 26) * s, (-80 + i * 14) * s], [(-6 + i * 26) * s, (-64 + i * 14) * s]], 8 * s, '#fff');
    // brilho
    ctx.beginPath(); ctx.moveTo(-130 * s, -70 * s); ctx.quadraticCurveTo(-100 * s, -90 * s, -60 * s, -88 * s); ctx.lineWidth = 8 * s; ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.stroke();
    ctx.restore();
  },
  bag(ctx, s = 1, col = '#F4E3C3') {
    ctx.beginPath(); ctx.arc(0, -70 * s, 42 * s, Math.PI, 0); ctx.lineWidth = 12 * s; ctx.strokeStyle = '#B9905A'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-80 * s, -70 * s); ctx.lineTo(80 * s, -70 * s); ctx.lineTo(96 * s, 90 * s); ctx.lineTo(-96 * s, 90 * s); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(-80 * s, -70 * s, 160 * s, 16 * s);
    // produtos saindo
    fillRR(ctx, -60 * s, -130 * s, 40 * s, 70 * s, 6 * s, '#fff'); fillRR(ctx, -60 * s, -112 * s, 40 * s, 20 * s, 0, '#3A86FF');
    circle(ctx, 20 * s, -84 * s, 26 * s, '#E63946'); line(ctx, [[20 * s, -110 * s], [26 * s, -122 * s]], 5 * s, '#5B3A1E');
    fillRR(ctx, 44 * s, -150 * s, 20 * s, 90 * s, 10 * s, '#D9A35B');
  },
  clock(ctx, s = 1, hh = 7, mm = 0, face = '#fff') {
    softShadow(ctx, 20, 8, 0.3); circle(ctx, 0, 0, 120 * s, C.ink); noShadow(ctx);
    circle(ctx, 0, 0, 104 * s, face);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; line(ctx, [[Math.sin(a) * 84 * s, -Math.cos(a) * 84 * s], [Math.sin(a) * 96 * s, -Math.cos(a) * 96 * s]], (i % 3 ? 4 : 9) * s, C.ink); }
    const am = (mm / 60) * Math.PI * 2, ah = ((hh % 12) + mm / 60) / 12 * Math.PI * 2;
    line(ctx, [[0, 0], [Math.sin(ah) * 52 * s, -Math.cos(ah) * 52 * s]], 14 * s, C.ink);
    line(ctx, [[0, 0], [Math.sin(am) * 80 * s, -Math.cos(am) * 80 * s]], 8 * s, C.esRed);
    circle(ctx, 0, 0, 12 * s, C.ink);
  },
  shop(ctx, s = 1, shutter = 1) {
    fillRR(ctx, -110 * s, -130 * s, 220 * s, 250 * s, 10 * s, '#E9C46A');
    ctx.fillStyle = C.esRed; ctx.fillRect(-120 * s, -130 * s, 240 * s, 40 * s);
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff' : C.esRed; ctx.beginPath(); ctx.arc((-100 + i * 40) * s, -90 * s, 20 * s, 0, Math.PI); ctx.fill(); }
    fillRR(ctx, -80 * s, -50 * s, 160 * s, 170 * s, 4 * s, '#8ECAE6');
    const h = 170 * s * shutter; ctx.fillStyle = '#9AA0A6'; ctx.fillRect(-82 * s, -50 * s, 164 * s, h);
    for (let y = 0; y < h; y += 14 * s) line(ctx, [[-82 * s, -50 * s + y], [82 * s, -50 * s + y]], 2 * s, '#7D838A', 'butt');
  },
};
