"""Gera js/timeline.js e legendas.srt a partir de tools/narracao.json + duração real dos áudios.
Uso: python3 tools/build_timeline.py"""
import json, wave, os, re
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
L = json.load(open(os.path.join(ROOT, 'tools/narracao.json')))

# Janelas das cenas (s). Ajuste aqui e rode de novo: vídeo, áudio e legendas acompanham.
SCENES = [
    {"n": 1, "key": "gancho",   "start": 0.0,  "end": 3.5},
    {"n": 2, "key": "escova",   "start": 3.5,  "end": 11.0},
    {"n": 3, "key": "papel",    "start": 11.0, "end": 17.0},
    {"n": 4, "key": "parcelado","start": 17.0, "end": 24.4},
    {"n": 5, "key": "sacola",   "start": 24.4, "end": 31.0},
    {"n": 6, "key": "jantar",   "start": 31.0, "end": 39.6},
    {"n": 7, "key": "domingo",  "start": 39.6, "end": 45.8},
    {"n": 8, "key": "cta",      "start": 45.8, "end": 55.0},
]
# Início de cada fala (s)
STARTS = {"s1a": 0.12, "s2a": 3.75, "s2b": 5.65, "s3a": 11.2, "s3b": 13.75, "s4a": 17.2,
          "s4b": 19.55, "s5a": 24.6, "s5b": 27.9, "s6a": 31.2, "s6b": 35.45, "s7a": 39.8,
          "s7b": 42.95, "s8a": 46.0, "s8b": 49.0}

def speech_bounds(path):
    w = wave.open(path); sr = w.getframerate()
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float) / 32768
    env = np.convolve(np.abs(x), np.ones(int(sr * 0.02)) / (sr * 0.02), 'same')
    idx = np.where(env > 0.02)[0]
    return idx[0] / sr, idx[-1] / sr, len(x) / sr

lines = []
for l in L:
    a, b, dur = speech_bounds(os.path.join(ROOT, f"audio/narracao/{l['id']}.wav"))
    t0 = STARTS[l['id']]
    lines.append({**l, "t": t0, "speechStart": round(t0 + a, 3), "speechEnd": round(t0 + b, 3), "dur": round(dur, 3)})

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
    [0.0, 'impact', 1.0], [0.55, 'zoom', 0.7], [1.6, 'whoosh', 0.6], [1.75, 'pop', 0.8], [2.2, 'pop', 0.8],
    [S['escova'] - 0.2, 'whoosh', 0.8], [S['escova'] + 0.35, 'pop', 0.7], [S['escova'] + 0.6, 'pop', 0.5], [S['escova'] + 3.4, 'swish', 0.5], [S['escova'] + 2.6, 'brush', 0.5],
    [S['escova'] + 4.4, 'zoom', 0.6], [S['escova'] + 4.9, 'boing', 0.6], [S['escova'] + 5.4, 'pop', 0.6],
    [S['papel'] - 0.2, 'whoosh', 0.8], [S['papel'] + 0.25, 'pop', 0.7], [S['papel'] + 0.4, 'pop', 0.6], [S['papel'] + 2.9, 'pop', 0.5], [S['papel'] + 1.3, 'swish', 0.6],
    [S['papel'] + 2.25, 'plop', 0.8], [S['papel'] + 3.4, 'buzz', 0.45],
    [S['parcelado'] - 0.2, 'whoosh', 0.8], [S['parcelado'] + 0.25, 'impact', 0.6], [S['parcelado'] + 4.65, 'pop', 0.5],
    [S['parcelado'] + 0.8, 'ticks', 0.5], [S['parcelado'] + 2.7, 'swish', 0.5], [S['parcelado'] + 3.0, 'calc', 0.5], [S['parcelado'] + 4.6, 'ding', 0.7], [S['parcelado'] + 6.0, 'whoosh', 0.5],
    [S['sacola'] - 0.2, 'whoosh', 0.8], [S['sacola'] + 0.45, 'pop', 0.6], [S['sacola'] + 0.3, 'beep', 0.5], [S['sacola'] + 1.0, 'beep', 0.5],
    [S['sacola'] + 1.7, 'beep', 0.5], [S['sacola'] + 2.4, 'beep', 0.5], [S['sacola'] + 3.1, 'beep', 0.5], [S['sacola'] + 3.55, 'register', 0.7], [S['sacola'] + 4.1, 'pop', 0.7],
    [S['jantar'] - 0.2, 'whoosh', 0.8], [S['jantar'] + 0.3, 'clock', 0.6], [S['jantar'] + 0.9, 'pop', 0.6], [S['jantar'] + 2.2, 'boing', 0.6],
    [S['jantar'] + 4.25, 'clockfast', 0.6], [S['jantar'] + 4.75, 'pop', 0.6], [S['jantar'] + 5.6, 'shimmer', 0.6], [S['jantar'] + 6.9, 'clockfast', 0.4],
    [S['domingo'] - 0.2, 'whoosh', 0.8], [S['domingo'] + 0.5, 'flip', 0.7], [S['domingo'] + 3.4, 'pop', 0.6], [S['domingo'] + 4.6, 'pop', 0.6], [S['domingo'] + 1.6, 'shutter', 0.7],
    [S['domingo'] + 2.3, 'shutter', 0.6], [S['domingo'] + 3.6, 'error', 0.6],
    [S['cta'] - 0.2, 'whoosh', 0.8], [S['cta'] + 0.3, 'pop', 0.6], [S['cta'] + 0.45, 'pop', 0.6],
    [S['cta'] + 0.6, 'pop', 0.6], [S['cta'] + 0.75, 'pop', 0.6], [S['cta'] + 0.9, 'pop', 0.6],
    [S['cta'] + 1.05, 'pop', 0.6], [S['cta'] + 3.0, 'impact', 0.5], [S['cta'] + 3.4, 'typing', 0.5], [S['cta'] + 5.2, 'ding', 0.6],
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
