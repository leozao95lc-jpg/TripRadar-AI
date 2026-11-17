"""Gera js/timeline.js e legendas.srt a partir de tools/narracao.json + duração real dos áudios.
Uso: python3 tools/build_timeline.py"""
import json, wave, os, re
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, 'tools/narracao.json')))

# Janelas das cenas (s). Ajuste aqui e rode de novo: vídeo, áudio e legendas acompanham.
SCENES = [
    {"n": 1, "key": "gancho",  "start": 0.0,  "end": 3.2},
    {"n": 2, "key": "data",    "start": 3.2,  "end": 9.4},
    {"n": 3, "key": "motivo",  "start": 9.4,  "end": 16.6},
    {"n": 4, "key": "maioria", "start": 16.6, "end": 21.6},
    {"n": 5, "key": "voto",    "start": 21.6, "end": 25.6},
    {"n": 6, "key": "cta",     "start": 25.6, "end": 29.5},
]
# Início preferido de cada fala (s)
STARTS = {"s1a": 0.1, "s2a": 3.4, "s3a": 9.55, "s3b": 13.65, "s4a": 16.75, "s5a": 21.75, "s6a": 25.75}

def speech_bounds(path):
    w = wave.open(path); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    env = np.convolve(np.abs(x), np.ones(int(sr * 0.02)) / (sr * 0.02), 'same')
    idx = np.where(env > 0.02)[0]
    return idx[0] / sr, idx[-1] / sr, len(x) / sr

lines = []
prev_end = 0.0
for l in L:
    path = os.path.join(ROOT, f"audio/narracao/{l['id']}.wav")
    if not os.path.exists(path):
        print(f"AVISO: {l['id']} sem áudio — fica fora da narração e das legendas"); continue
    a, b, dur = speech_bounds(path)
    sc = next(s for s in SCENES if s['n'] == l['scene'])
    # começa no horário preferido; se não couber na cena, antecipa; nunca sobrepõe a fala anterior
    t0 = max(STARTS[l['id']], prev_end + 0.2 - a)
    if t0 + b > sc['end'] - 0.15: t0 = max(prev_end + 0.2 - a, sc['end'] - 0.15 - b)
    if t0 + b > sc['end']: print(f"AVISO: {l['id']} passa do fim da cena {sc['n']} em {t0 + b - sc['end']:.2f}s")
    prev_end = t0 + b
    lines.append({**l, "t": round(t0, 3), "speechStart": round(t0 + a, 3), "speechEnd": round(t0 + b, 3), "dur": round(dur, 3)})

def chunks(text, maxw=4):
    # quebra em blocos curtos respeitando pontuação
    words = text.split()
    out, cur = [], []
    for w in words:
        cur.append(w)
        if len(cur) >= maxw or re.search(r'[,.?!]$', w):
            out.append(' '.join(cur)); cur = []
    if cur: out.append(' '.join(cur))
    # junta blocos de 1 palavra no anterior
    res = []
    for c in out:
        if res and len(c.split()) == 1 and len(res[-1].split()) < 4 and not re.search(r'[.?!]$', res[-1]):
            res[-1] += ' ' + c
        else:
            res.append(c)
    return res

caps = []
for l in lines:
    cs = chunks(l['cap'])
    total = sum(len(c) + 4 for c in cs)
    t = l['speechStart']; span = l['speechEnd'] - l['speechStart']
    for c in cs:
        d = span * (len(c) + 4) / total
        caps.append({"t0": round(t, 3), "t1": round(t + d, 3), "text": c})
        t += d
# segura cada legenda até a próxima (máx. 0.5 s de folga)
for i in range(len(caps) - 1):
    caps[i]['t1'] = round(min(caps[i + 1]['t0'], caps[i]['t1'] + 0.5), 3)
caps[-1]['t1'] = round(caps[-1]['t1'] + 0.4, 3)

S = {s['key']: s['start'] for s in SCENES}
# Efeitos sonoros: [tempo, tipo, ganho]
SFX = [
    [0.0, 'impact', 1.0], [0.35, 'whoosh', 0.6], [0.9, 'plop', 0.8], [1.3, 'pop', 0.7], [1.5, 'pop', 0.7], [2.1, 'impact', 0.6],
    [S['data'] - 0.2, 'whoosh', 0.8], [S['data'] + 0.3, 'flip', 0.7], [S['data'] + 0.45, 'pop', 0.6], [S['data'] + 1.6, 'ticks', 0.5], [S['data'] + 3.4, 'pop', 0.6],
    [S['motivo'] - 0.2, 'whoosh', 0.8], [S['motivo'] + 0.3, 'pop', 0.6], [S['motivo'] + 1.9, 'impact', 0.7], [S['motivo'] + 2.0, 'buzz', 0.4],
    [S['motivo'] + 4.2, 'flip', 0.6], [S['motivo'] + 4.9, 'boing', 0.5],
    [S['maioria'] - 0.2, 'whoosh', 0.8], [S['maioria'] + 0.3, 'pop', 0.6], [S['maioria'] + 0.5, 'ticks', 0.5], [S['maioria'] + 2.0, 'ding', 0.6],
    [S['voto'] - 0.2, 'whoosh', 0.8], [S['voto'] + 0.3, 'pop', 0.6], [S['voto'] + 0.9, 'pop', 0.6], [S['voto'] + 1.9, 'error', 0.5],
    [S['cta'] - 0.2, 'whoosh', 0.8], [S['cta'] + 0.3, 'pop', 0.6], [S['cta'] + 1.2, 'typing', 0.4], [S['cta'] + 2.6, 'ding', 0.5],
]


TL = {"fps": 30, "width": 1080, "height": 1920, "duration": SCENES[-1]['end'],
      "scenes": SCENES, "lines": lines, "captions": caps, "sfx": SFX}
os.makedirs(os.path.join(ROOT, 'js'), exist_ok=True)
with open(os.path.join(ROOT, 'js/timeline.js'), 'w') as f:
    f.write('// GERADO por tools/build_timeline.py — não editar à mão\nwindow.TL = ' + json.dumps(TL, ensure_ascii=False, indent=1) + ';\n')

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"
with open(os.path.join(ROOT, 'legendas.srt'), 'w') as f:
    for i, c in enumerate(caps, 1):
        f.write(f"{i}\n{ts(c['t0'])} --> {ts(c['t1'])}\n{c['text']}\n\n")
for l in lines: print(l['id'], l['t'], l['speechStart'], l['speechEnd'])
print(len(caps), 'legendas')
