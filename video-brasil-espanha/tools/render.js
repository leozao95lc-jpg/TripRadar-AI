// Renderiza o vídeo frame a frame no Chromium (Playwright) e codifica com ffmpeg.
// Uso:
//   node tools/render.js                 -> output/brasil-espanha.mp4 (1080x1920, 30 fps, com áudio)
//   node tools/render.js --stills 1,5.2  -> output/stills/*.jpg (quadros de revisão)
//   node tools/render.js --workers 3     -> paralelo (padrão: 3)
'use strict';
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'output');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.jpg': 'image/jpeg', '.png': 'image/png' };
function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
      rsp.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(rsp);
    }).listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(browser, port) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}

function ffmpeg(argv) {
  const p = spawn('ffmpeg', argv, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', d => { err += d; if (err.length > 20000) err = err.slice(-10000); });
  p.done = new Promise((res, rej) => p.on('close', c => (c === 0 ? res() : rej(new Error(err.slice(-2000))))));
  return p;
}

async function renderSegment(browser, port, fps, f0, f1, file, label) {
  const page = await openPage(browser, port);
  const enc = ffmpeg(['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps), file]);
  for (let f = f0; f < f1; f++) {
    const url = await page.evaluate(([t]) => window.__frame(t, 0.94), [f / fps]);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!enc.stdin.write(buf)) await new Promise(r => enc.stdin.once('drain', r));
    if ((f - f0) % 60 === 0) console.log(`[${label}] frame ${f}/${f1}`);
  }
  enc.stdin.end(); await enc.done; await page.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve(), port = srv.address().port;
  const browser = await chromium.launch();
  try {
    const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'js/timeline.js'), 'utf8').replace(/^[^=]*=\s*/s, '').replace(/;\s*$/, ''));
    const stills = opt('--stills');
    if (stills) {
      const dir = path.join(OUT, 'stills'); fs.mkdirSync(dir, { recursive: true });
      const page = await openPage(browser, port);
      for (const s of stills.split(',')) {
        const url = await page.evaluate(([t]) => window.__frame(t, 0.9), [+s]);
        fs.writeFileSync(path.join(dir, `t${(+s).toFixed(2).padStart(5, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
      }
      console.log('stills em', dir); return;
    }
    const fps = TL.fps, total = Math.round(TL.duration * fps), workers = +opt('--workers', 3);
    const per = Math.ceil(total / workers), parts = [];
    const t0 = Date.now();
    await Promise.all(Array.from({ length: workers }, (_, w) => {
      const f0 = w * per, f1 = Math.min(total, f0 + per), file = path.join(OUT, `_part${w}.mp4`);
      parts.push(file); return renderSegment(browser, port, fps, f0, f1, file, `w${w}`);
    }));
    fs.writeFileSync(path.join(OUT, '_parts.txt'), parts.map(p => `file '${p}'`).join('\n'));
    const audio = path.join(ROOT, 'audio/mix.wav');
    const final = path.join(OUT, 'brasil-espanha.mp4');
    const a = ['-y', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, '_parts.txt')];
    if (fs.existsSync(audio)) a.push('-i', audio, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest');
    a.push('-c:v', 'copy', '-movflags', '+faststart', final);
    await ffmpeg(a).done;
    parts.forEach(p => fs.unlinkSync(p)); fs.unlinkSync(path.join(OUT, '_parts.txt'));
    console.log(`OK: ${final} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  } finally { await browser.close(); srv.close(); }
})().catch(e => { console.error(e); process.exit(1); });
