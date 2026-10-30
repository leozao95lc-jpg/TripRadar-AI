"""Corta um áudio único de narração (ex.: exportado do ElevenLabs) nas frases do roteiro.
Uso: python3 tools/import_voz.py audio/fonte/elevenlabs_roger.mp3
Grava audio/narracao/<id>.wav (48 kHz mono). A narração TTS anterior vai para audio/narracao_piper/.

Os cortes abaixo foram medidos com:  ffmpeg -i ARQ -af silencedetect=n=-35dB:d=0.12 -f null -
Se trocar o arquivo de voz, meça de novo e ajuste a tabela. Frase sem trecho = fica sem narração."""
import os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'audio/fonte/elevenlabs_roger.mp3')

# id: (início, fim) em segundos no arquivo de origem
CUTS = {
    's1a': (0.00, 2.98), 's2a': (3.50, 4.59), 's2b': (5.05, 9.29),
    's3a': (9.75, 11.37), 's3b': (11.79, 13.94),
    's4a': (14.39, 16.35), 's4b': (16.70, 20.65),
    's5a': (21.01, 22.71), 's5b': (22.97, 24.75),
    's6a': (25.18, 27.91), 's6b': (28.19, 33.16),
    's7a': (33.54, 35.91), 's7b': (36.40, 38.75),
    's8a': (39.12, 42.11),
    # 's8b': ausente no arquivo enviado
}

out = os.path.join(ROOT, 'audio/narracao'); bak = os.path.join(ROOT, 'audio/narracao_piper')
if not os.path.isdir(bak):
    shutil.copytree(out, bak)
for f in os.listdir(out):
    if f.endswith('.wav'): os.remove(os.path.join(out, f))
for k, (a, b) in CUTS.items():
    d = b - a + 0.08
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0, a - 0.04):.3f}', '-t', f'{d:.3f}', '-i', SRC,
                    '-af', f'afade=t=in:d=0.02,afade=t=out:st={d - 0.04:.3f}:d=0.04', '-ar', '48000', '-ac', '1',
                    os.path.join(out, f'{k}.wav')], check=True)
    print(k, f'{b - a:.2f}s')
