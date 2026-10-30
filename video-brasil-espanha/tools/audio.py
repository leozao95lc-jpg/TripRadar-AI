"""Trilha original + efeitos sonoros sintetizados + mixagem com a narração.
Tudo gerado por código (sem samples de terceiros) -> sem risco de direitos autorais.
Uso: python3 tools/audio.py   (lê js/timeline.js; grava audio/mix.wav e os stems)"""
import json, os, wave
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.loads(open(os.path.join(ROOT, 'js/timeline.js')).read().split('=', 1)[1].strip().rstrip(';'))
DUR = TL['duration']
N = int(DUR * SR)
R = np.random.default_rng(7)


def t_(d): return np.arange(int(d * SR)) / SR
def env(n, a=0.003, tau=0.2):
    t = np.arange(n) / SR
    return np.minimum(1, t / a) * np.exp(-t / tau)
def noise(d): return R.uniform(-1, 1, int(d * SR))
def fft_filter(x, lo=None, hi=None):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); m = np.ones_like(f)
    if lo: m *= 1 / (1 + (lo / np.maximum(f, 1)) ** 4)
    if hi: m *= 1 / (1 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))
def place(buf, x, t, g=1.0):
    i = int(t * SR)
    if i >= len(buf) or i + len(x) <= 0: return
    if i < 0: x = x[-i:]; i = 0
    x = x[:len(buf) - i]; buf[i:i + len(x)] += x * g
def midi(n): return 440 * 2 ** ((n - 69) / 12)
def sweep(f0, f1, d, shape='sin'):
    t = t_(d); f = f0 * (f1 / f0) ** (t / d); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) if shape == 'sin' else np.sign(np.sin(ph))


# ------------------------- MÚSICA -------------------------
BPM = 112; BEAT = 60 / BPM; BAR = BEAT * 4
def marimba(f, d=0.6, tau=0.22):
    t = t_(d); return (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / 0.05)) * env(len(t), 0.002, tau)
def pluck(f, d=0.25):
    t = t_(d); x = sum(np.sin(2 * np.pi * f * k * t) / k ** 1.3 for k in range(1, 6)); return x * env(len(t), 0.002, 0.07)
def bass(f, d=0.45):
    t = t_(d); x = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t); return np.tanh(1.6 * x) * env(len(t), 0.004, 0.25)
def kick():
    t = t_(0.35); f = 45 + 90 * np.exp(-t / 0.04); return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.14)
CLAP = fft_filter(noise(0.2), 900, 6000)
def clap():
    x = np.zeros(int(0.2 * SR))
    for k, o in enumerate([0, 0.011, 0.022]): place(x, CLAP[:int(0.2 * SR)] * env(int(0.2 * SR), 0.001, 0.012 if k < 2 else 0.07), o)
    return x
SHAKER = fft_filter(noise(0.06), 6000) * env(int(0.06 * SR), 0.004, 0.018)

PROG = [(48, [60, 64, 67]), (45, [57, 60, 64]), (41, [57, 60, 65]), (43, [55, 59, 62])]  # C Am F G
MEL = [72, 74, 76, 79, 81, 79, 76, 74]
drums = np.zeros(N); harm = np.zeros(N); bas = np.zeros(N); lead = np.zeros(N)
nbars = int(np.ceil(DUR / BAR)) + 1
mr = np.random.default_rng(3)
for b in range(nbars):
    t0 = b * BAR; root, chord = PROG[b % 4]
    for beat in range(4):
        tb = t0 + beat * BEAT
        if beat in (0, 2): place(drums, kick(), tb, 0.9)
        if beat == 2 and b % 2: place(drums, kick(), tb + BEAT * 0.75, 0.5)
        if beat in (1, 3): place(drums, clap(), tb, 0.45)
        for s16 in range(4): place(drums, SHAKER, tb + s16 * BEAT / 4, 0.16 if s16 % 2 else 0.08)
        for n in chord: place(harm, pluck(midi(n)), tb + BEAT / 2, 0.11)  # contratempo
    for off, nn in [(0, root), (1.5, root), (2, root + 7), (3, root + 12), (3.5, root + 7)]:
        place(bas, bass(midi(nn)), t0 + off * BEAT, 0.42)
    if b % 4 in (1, 3):  # frase de marimba
        for k in range(8):
            if mr.random() < 0.75: place(lead, marimba(midi(MEL[(k + b) % 8] - (0 if b % 8 < 4 else 2))), t0 + k * BEAT / 2, 0.14)
# pump de sidechain no harmônico e baixo
pump = np.ones(N); tt = np.arange(N) / SR; ph = (tt % (BEAT * 2)) / BEAT
pump = 0.55 + 0.45 * np.minimum(1, (tt % BEAT) / 0.18)
music = drums + (harm + bas) * pump + lead
# primeira cena: entra com tudo; último segundo: fade
music *= np.clip((DUR - tt) / 1.2, 0, 1)

# ------------------------- EFEITOS -------------------------
def sfx(kind):
    if kind == 'impact':
        t = t_(0.7); f = 40 + 80 * np.exp(-t / 0.05)
        return 0.9 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.001, 0.25) + 0.5 * fft_filter(noise(0.7), 200, 3000) * env(len(t), 0.001, 0.05)
    if kind in ('whoosh', 'swish'):
        d = 0.45 if kind == 'whoosh' else 0.25; n = noise(d); t = t_(d)
        out = np.zeros_like(n); seg = int(0.03 * SR)
        for i in range(0, len(n), seg):
            c = 400 + 4500 * np.sin(np.pi * i / len(n)); out[i:i + seg] = fft_filter(n[i:i + seg], c * 0.6, c * 1.6)
        return out * np.sin(np.pi * t / d) ** 2 * 1.6
    if kind == 'zoom': return 0.35 * sweep(300, 1400, 0.28) * np.sin(np.pi * t_(0.28) / 0.28)
    if kind == 'pop':
        t = t_(0.09); return 0.6 * sweep(500, 1100, 0.09) * env(len(t), 0.001, 0.03)
    if kind == 'brush':
        d = 1.4; t = t_(d); return 0.5 * fft_filter(noise(d), 2500, 9000) * (0.5 + 0.5 * np.sin(2 * np.pi * 4.2 * t)) ** 2 * np.minimum(1, (d - t) / 0.2)
    if kind == 'boing':
        t = t_(0.5); f = 220 * (1 + 0.5 * np.sin(2 * np.pi * 12 * t) * np.exp(-t / 0.15)) * (1 + t)
        return 0.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(t), 0.002, 0.2)
    if kind == 'plop':
        t = t_(0.25); return 0.6 * sweep(900, 180, 0.25) * env(len(t), 0.001, 0.07)
    if kind == 'buzz':
        t = t_(0.35); return 0.25 * fft_filter(sweep(150, 140, 0.35, 'sq'), None, 2500) * np.minimum(1, (0.35 - t) / 0.05)
    if kind == 'ticks':
        x = np.zeros(int(1.5 * SR))
        for i in range(10): place(x, sweep(1800 + i * 90, 1500, 0.03) * env(int(0.03 * SR), 0.001, 0.008), i * 0.13)
        return x * 0.7
    if kind == 'calc':
        x = np.zeros(int(1.6 * SR))
        for i in range(14): place(x, np.sin(2 * np.pi * 2300 * t_(0.04)) * env(int(0.04 * SR), 0.001, 0.015), i * 0.1 + R.uniform(0, 0.02))
        return x * 0.45
    if kind == 'ding':
        t = t_(1.4); return 0.4 * sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / tau) for f, a, tau in [(1320, 1, 0.6), (2640, 0.4, 0.3), (3960, 0.2, 0.15), (1980, 0.25, 0.4)])
    if kind == 'beep':
        t = t_(0.13); return 0.35 * np.sin(2 * np.pi * 2650 * t) * np.minimum(1, (0.13 - t) / 0.01)
    if kind == 'register':
        x = np.zeros(int(1.2 * SR)); place(x, fft_filter(noise(0.12), 2000, 9000) * env(int(0.12 * SR), 0.001, 0.03), 0, 0.6); place(x, sfx('ding'), 0.08, 0.9); return x
    if kind in ('clock', 'clockfast'):
        n, gap = (4, 0.5) if kind == 'clock' else (12, 0.09)
        x = np.zeros(int((n * gap + 0.1) * SR))
        for i in range(n): place(x, fft_filter(noise(0.03), 2000 if i % 2 else 3000, 8000) * env(int(0.03 * SR), 0.001, 0.006), i * gap)
        return x * 1.2
    if kind == 'shimmer':
        x = np.zeros(int(1.6 * SR))
        for i, n in enumerate([84, 88, 91, 96, 100]): place(x, marimba(midi(n), 0.8, 0.3), i * 0.08, 0.25)
        return x
    if kind == 'flip': return 0.8 * fft_filter(noise(0.18), 1500, 7000) * env(int(0.18 * SR), 0.01, 0.05)
    if kind == 'shutter':
        d = 0.55; t = t_(d); rat = (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 28 * t)))
        x = fft_filter(noise(d), 150, 2500) * rat * 0.5 * np.minimum(1, t / 0.05)
        clunk = np.sin(2 * np.pi * 70 * t_(0.25)) * env(int(0.25 * SR), 0.001, 0.06) + 0.4 * fft_filter(noise(0.25), 300, 3000) * env(int(0.25 * SR), 0.001, 0.02)
        out = np.zeros(int((d + 0.3) * SR)); place(out, x, 0); place(out, clunk, d - 0.02, 0.9); return out
    if kind == 'error':
        out = np.zeros(int(0.6 * SR))
        for i, f in enumerate([330, 247]): place(out, fft_filter(sweep(f, f, 0.18, 'sq'), None, 3000) * env(int(0.18 * SR), 0.003, 0.09), i * 0.2, 0.3)
        return out
    if kind == 'typing':
        x = np.zeros(int(1.7 * SR))
        for i in range(16): place(x, fft_filter(noise(0.025), 1500, 7000) * env(int(0.025 * SR), 0.001, 0.005), i * 0.1 + R.uniform(0, 0.03), 0.6)
        return x
    raise ValueError(kind)

fx = np.zeros(N)
for t, kind, g in TL['sfx']: place(fx, sfx(kind), t, g)

# ------------------------- NARRAÇÃO -------------------------
def read_wav(p):
    w = wave.open(p); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
    if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) / SR, np.arange(len(x)) / sr, x)
    return x
voice = np.zeros(N)
for l in TL['lines']:
    x = read_wav(os.path.join(ROOT, f"audio/narracao/{l['id']}.wav"))
    x = fft_filter(x, 80)  # corta ronco abaixo de 80 Hz sem afinar a voz
    x = np.tanh(1.4 * x / (np.max(np.abs(x)) + 1e-9)) / np.tanh(1.4)  # compressão suave
    place(voice, x, l['t'], 0.85)

# ducking: música abaixa quando há voz
venv = np.convolve(np.abs(voice), np.ones(int(0.15 * SR)) / (0.15 * SR), 'same')
duck = 1 - 0.55 * np.clip(venv / 0.12, 0, 1)
music_d = music * duck

def norm(x, peak=0.9): return x / (np.max(np.abs(x)) + 1e-9) * peak
music_d = norm(music_d, 0.32); fx = norm(fx, 0.55)
mix = voice + music_d + fx
mix = np.tanh(1.3 * mix) / np.tanh(1.3)
mix = norm(mix, 0.95)

def write(p, x):
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    w = wave.open(p, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()

# leve abertura estéreo para música/efeitos (voz no centro)
d = int(0.012 * SR)
side = np.zeros(N); side[d:] = (music_d + fx)[:-d] * 0.25
st = np.stack([mix + side, mix - side], 1); st = st / np.max(np.abs(st)) * 0.95
write(os.path.join(ROOT, 'audio/mix.wav'), st)
write(os.path.join(ROOT, 'audio/stem_musica.wav'), norm(music, 0.8))
write(os.path.join(ROOT, 'audio/stem_efeitos.wav'), norm(fx, 0.8))
write(os.path.join(ROOT, 'audio/stem_narracao.wav'), norm(voice, 0.9))
print('ok', DUR, 's')
