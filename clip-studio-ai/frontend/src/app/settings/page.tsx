"use client";
import { useEffect, useState } from "react";
import { API, api, Brand, SubtitleSettings, SubtitleStyle } from "@/lib/api";
import Shell from "@/components/Shell";
import { Button, Card, ErrorNote, Field, useLoad } from "@/components/ui";

const FONT_CSS: Record<string, string> = { "Bricolage Grotesque": "var(--font-bricolage)", "Space Mono": "var(--font-space-mono)", Montserrat: "Montserrat, Arial Black, sans-serif", Inter: "Inter, system-ui, sans-serif" };
const SAMPLE = ["Eu", "cheguei", "no", "aeroporto", "e", "descobri", "que", "o", "passaporte", "tinha", "vencido"];

/** Prévia aproximada (CSS). O resultado final é gerado pelo FFmpeg/libass na renderização. */
function Preview({ s }: { s: SubtitleStyle }) {
  const scale = 0.2, H = 1920 * scale, W = 1080 * scale, picH = W * 9 / 16, picY = (H - picH) / 2;
  const below = H - (picY + picH);
  const y = s.position === "auto" ? picY + picH + Math.min(below / 2, Math.max(s.size * 2, 140) * scale)
    : s.position === "top" ? s.margin_v * scale : s.position === "middle" ? H / 2 : H - s.margin_v * scale;
  const words = SAMPLE.slice(0, s.max_words), o = s.outline_width * scale;
  const shadow = s.background === "box" || !o ? "none" : Array.from({ length: 12 }, (_, i) => `${(Math.cos(i * Math.PI / 6) * o).toFixed(2)}px ${(Math.sin(i * Math.PI / 6) * o).toFixed(2)}px 0 ${s.outline_color}`).join(",");
  const alpha = Math.round(s.background_opacity * 255).toString(16).padStart(2, "0");
  return (
    <div className="relative mx-auto overflow-hidden rounded-lg border border-line bg-[#0b0c0d]" style={{ width: W, height: H }}>
      <div className="absolute inset-x-0 grid place-items-center bg-gradient-to-br from-green to-green-soft font-mono text-[10px] uppercase text-cream/60" style={{ top: picY, height: picH }}>vídeo original</div>
      <div className="absolute inset-x-0 -translate-y-1/2 px-2 text-center" style={{ top: y }}>
        <span style={{ fontFamily: FONT_CSS[s.font], fontSize: s.size * scale, fontWeight: 800, color: s.color, textShadow: shadow, textTransform: s.uppercase ? "uppercase" : "none", background: s.background === "box" ? `${s.background_color}${alpha}` : "transparent", padding: s.background === "box" ? "2px 6px" : 0, lineHeight: 1.25 }}>
          {words.map((w, i) => <span key={i} style={{ color: s.highlight_words && i === 1 ? s.highlight_color : undefined }}>{w} </span>)}
        </span>
      </div>
    </div>
  );
}

export default function Settings() {
  const brand = useLoad(() => api<Brand>("/settings/brand"));
  const subs = useLoad(() => api<SubtitleSettings>("/settings/subtitles"));
  const [b, setB] = useState<Brand | null>(null);
  const [base, setBase] = useState("de_mala_y_cuia");
  const [style, setStyle] = useState<SubtitleStyle | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoV, setLogoV] = useState(0);
  useEffect(() => { if (brand.data) setB(brand.data); }, [brand.data]);
  const all = subs.data ? { ...subs.data.builtin, ...subs.data.custom } : {};
  useEffect(() => { if (subs.data && !style) setStyle(subs.data.builtin.de_mala_y_cuia); }, [subs.data, style]);

  const guard = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setError(null); setMsg(ok); } catch (e) { setMsg(null); setError((e as Error).message); } };
  const st = <K extends keyof SubtitleStyle>(k: K, v: SubtitleStyle[K]) => setStyle((s) => s && { ...s, [k]: v });
  const isCustom = !!subs.data?.custom[base];

  return (
    <Shell title="Canal e legendas" subtitle="Identidade do canal (separada da identidade do CLIP STUDIO AI) e estilos de legenda">
      {msg && <p className="mb-4 rounded-lg border border-green-soft bg-green px-3 py-2 text-sm">{msg}</p>}
      <div className="mb-4"><ErrorNote error={error || brand.error || subs.error} /></div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Identidade do canal">
          {b && (
            <div className="space-y-4">
              <Field label="Nome do canal"><input value={b.channel_name} onChange={(e) => setB({ ...b, channel_name: e.target.value })} /></Field>
              <Field label="Sobre o canal" hint="Usado como contexto na análise editorial da IA.">
                <textarea rows={3} value={b.channel_description} onChange={(e) => setB({ ...b, channel_description: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cor principal"><input type="color" value={b.primary_color} onChange={(e) => setB({ ...b, primary_color: e.target.value })} /></Field>
                <Field label="Cor de destaque"><input type="color" value={b.accent_color} onChange={(e) => setB({ ...b, accent_color: e.target.value })} /></Field>
              </div>
              <Field label="Legenda padrão">
                <select value={b.default_subtitle_preset} onChange={(e) => setB({ ...b, default_subtitle_preset: e.target.value })}>
                  {Object.keys(all).map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}
                </select>
              </Field>
              <Button variant="primary" onClick={() => guard(() => api("/settings/brand", { method: "PUT", json: b }).then(brand.reload), "Identidade do canal salva.")}>Salvar identidade</Button>
              <div className="border-t border-line pt-4">
                <p className="mb-2 font-mono text-[11px] uppercase text-muted">Logo (PNG, opcional — aplicado no canto superior do vídeo)</p>
                <div className="flex items-center gap-3">
                  {b.has_logo && <img alt="Logo do canal" src={`${API}/api/settings/brand/logo?v=${logoV}`} className="h-14 rounded border border-line bg-raised p-1" />}
                  <input type="file" accept="image/png" onChange={(e) => { const f = e.target.files?.[0]; if (f) guard(() => api("/settings/brand/logo", { method: "POST", body: f, headers: { "content-type": "image/png" } }).then(() => { setLogoV((x) => x + 1); return brand.reload(); }), "Logo atualizado."); e.target.value = ""; }} />
                  {b.has_logo && <Button small variant="danger" onClick={() => guard(() => api("/settings/brand/logo", { method: "DELETE" }).then(brand.reload), "Logo removido.")}>Remover</Button>}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card title="Editor de legendas">
          {style && subs.data && (
            <div className="grid gap-4 md:grid-cols-[1fr_216px]">
              <div className="space-y-3">
                <Field label="Partir do preset">
                  <select value={base} onChange={(e) => { setBase(e.target.value); setStyle(all[e.target.value]); setName(subs.data!.custom[e.target.value] ? e.target.value : ""); }}>
                    {Object.keys(all).map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}{subs.data!.custom[k] ? " (personalizado)" : ""}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Fonte"><select value={style.font} onChange={(e) => st("font", e.target.value)}>{subs.data.fonts.map((f) => <option key={f}>{f}</option>)}</select></Field>
                  <Field label={`Tamanho: ${style.size}px`}><input type="range" min={24} max={160} value={style.size} onChange={(e) => st("size", +e.target.value)} /></Field>
                  <Field label="Cor do texto"><input type="color" value={style.color} onChange={(e) => st("color", e.target.value)} /></Field>
                  <Field label="Cor do destaque"><input type="color" value={style.highlight_color} onChange={(e) => st("highlight_color", e.target.value)} /></Field>
                  <Field label="Cor do contorno"><input type="color" value={style.outline_color} onChange={(e) => st("outline_color", e.target.value)} /></Field>
                  <Field label={`Contorno: ${style.outline_width}`}><input type="range" min={0} max={12} value={style.outline_width} onChange={(e) => st("outline_width", +e.target.value)} /></Field>
                  <Field label="Fundo"><select value={style.background} onChange={(e) => st("background", e.target.value as SubtitleStyle["background"])}><option value="none">Sem fundo</option><option value="box">Caixa</option></select></Field>
                  <Field label="Cor do fundo"><input type="color" value={style.background_color} onChange={(e) => st("background_color", e.target.value)} /></Field>
                  <Field label="Posição" hint={style.position === "auto" ? "Fora da imagem sempre que houver faixa livre." : "Posição manual: confira se não cobre rostos."}>
                    <select value={style.position} onChange={(e) => st("position", e.target.value as SubtitleStyle["position"])}>
                      <option value="auto">Automática (fora da imagem)</option><option value="top">Topo</option><option value="middle">Centro</option><option value="bottom">Base</option>
                    </select>
                  </Field>
                  <Field label="Animação"><select value={style.animation} onChange={(e) => st("animation", e.target.value as SubtitleStyle["animation"])}><option value="none">Nenhuma</option><option value="fade">Fade</option><option value="pop">Pop</option></select></Field>
                  <Field label={`Palavras por linha: ${style.max_words}`}><input type="range" min={1} max={10} value={style.max_words} onChange={(e) => st("max_words", +e.target.value)} /></Field>
                  <Field label={`Margem vertical: ${style.margin_v}px`}><input type="range" min={0} max={900} step={10} value={style.margin_v} onChange={(e) => st("margin_v", +e.target.value)} /></Field>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.highlight_words} onChange={(e) => st("highlight_words", e.target.checked)} /> Destacar palavra falada</label>
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.uppercase} onChange={(e) => st("uppercase", e.target.checked)} /> Maiúsculas</label>
                </div>
                <div className="flex items-end gap-2 border-t border-line pt-3">
                  <Field label="Salvar como (nome do preset)"><input placeholder="ex.: entrevistas" value={name} onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))} /></Field>
                  <Button variant="primary" disabled={!name} onClick={() => guard(() => api(`/settings/subtitles/${name}`, { method: "PUT", json: style }).then(() => { setBase(name); return subs.reload(); }), `Preset "${name}" salvo.`)}>Salvar</Button>
                  {isCustom && <Button variant="danger" onClick={() => guard(() => api(`/settings/subtitles/${base}`, { method: "DELETE" }).then(() => { setBase("clean"); setStyle(subs.data!.builtin.clean); setName(""); return subs.reload(); }), "Preset excluído.")}>Excluir</Button>}
                </div>
              </div>
              <div>
                <Preview s={style} />
                <p className="mt-2 text-center text-[11px] text-muted">Prévia aproximada em 9:16</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
