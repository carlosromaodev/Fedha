import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Field, RouteButton, Volume, copy, useToast } from "../../../shared/ui";
import { goal, pastGoals } from "../../../shared/mocks/data";
import { cx, kz } from "../../../shared/lib/format";
import { AlertCard } from "../../../features/overlay-setup/Previews";
import { publicWidgetLink, widgetUrl, type WidgetTheme } from "../../../features/overlay-setup/widgets";
import { useWidgets } from "../../../features/overlay-setup/api";

const ACCENTS = ["#C9F25C", "#F5A243", "#7CC8F2", "#F28AB2"];
const SOUNDS = ["Moeda Fedha", "Batida de kuduro", "Aplausos", "Sem som"];
const VOICES = ["Ana · padrão", "Nzinga", "Kandimba", "Ngola · premium"];

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg sm" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => <button key={v} role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function Row({ label, sub, children }: { label: string; sub?: string; children: ReactNode }) {
  return <div className="set-row"><span>{label}{sub && <small>{sub}</small>}</span>{children}</div>;
}

/** S6-W1 — Personalizar um widget (12): aspeto, som, níveis e tempos, com validação. */
export default function Customize() {
  const { id = "w1" } = useParams();
  if (id !== "w1") return <OtherWidgets focus={id} />;
  return <AlertSettings />;
}

function AlertSettings() {
  const nav = useNavigate();
  const toast = useToast();
  const { list, save, regenerate, sendTest, destination } = useWidgets();
  const w = list[0]!;
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<WidgetTheme>("claro");
  const [accent, setAccent] = useState(ACCENTS[0]!);
  const [size, setSize] = useState<"p" | "m" | "g">("m");
  const [show, setShow] = useState({ name: true, value: true, karaoke: true });
  const [sound, setSound] = useState(SOUNDS[0]!);
  const [superSound, setSuperSound] = useState(SOUNDS[1]!);
  const [voice, setVoice] = useState(VOICES[0]!);
  const [vol, setVol] = useState(80);
  const [hl, setHl] = useState(1000);
  const [sup, setSup] = useState(5000);
  const [enter, setEnter] = useState(500);
  const [exit, setExit] = useState(400);
  const [reduce, setReduce] = useState(false);
  const [level, setLevel] = useState<"normal" | "destaque" | "super">("destaque");

  // Quando a configuração chega da API, preenche o formulário.
  useEffect(() => {
    const c = w.config;
    setTheme(c.theme); setAccent(c.accent); setSize(c.size); setShow({ name: c.showName, value: c.showValue, karaoke: c.karaoke });
    setVol(Math.round(c.volume * 100)); setHl(c.highlightFrom); setSup(c.superFrom); setEnter(c.enterMs); setExit(c.exitMs); setReduce(c.reduceMotion);
    if (c.entrySound) setSound(c.entrySound); if (c.superSound) setSuperSound(c.superSound); if (c.voiceId) setVoice(c.voiceId);
  }, [w.config]);

  const onSave = async () => {
    setBusy(true);
    try {
      await save("w1", { ...w.config, theme, accent, size, showName: show.name, showValue: show.value, karaoke: show.karaoke, reduceMotion: reduce,
        highlightFrom: hl, superFrom: sup, enterMs: enter, exitMs: exit, volume: vol / 100, entrySound: sound, superSound, voiceId: voice });
      toast.show("Guardado. O W1 atualiza na live em segundos.");
    } catch (e) { toast.show(`Não foi possível guardar: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const err = {
    sup: sup <= hl ? "Tem de ser maior que o destaque." : null,
    hl: hl < 100 ? "O mínimo é 100 Kz." : null,
    enter: enter < 400 || enter > 700 ? "Entre 400 e 700 ms." : null,
    exit: exit < 300 || exit > 500 ? "Entre 300 e 500 ms." : null,
  };
  const ok = !Object.values(err).some(Boolean);
  const sample = level === "super" ? 10000 : level === "destaque" ? 3000 : 500;

  return (
    <>
      <Topbar title="W1 · Alerta de mensagem" sub="Personalizar · as alterações aparecem na pré-visualização e na live ao guardar">
        <button className="btn" onClick={() => nav("/painel/widgets")}>Voltar</button>
        <div style={{ width: 140 }}><RouteButton size="sm" disabled={!ok || busy} onClick={onSave}>{busy ? "A guardar…" : "Guardar"}</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card">
              <span className="eyebrow">Aspeto</span>
              <Row label="Tema"><Seg label="Tema" value={theme} onChange={setTheme} options={[["claro", "Claro"], ["noite", "Noite"], ["sinal", "Sinal"]]} /></Row>
              <Row label="Cor de destaque" sub="Cor do valor e da barra">
                <div className="row" style={{ gap: 8 }}>{ACCENTS.map((c) => <button key={c} aria-label={`Cor ${c}`} className={cx("swatch", accent === c && "on")} style={{ background: c }} onClick={() => setAccent(c)} />)}</div>
              </Row>
              <Row label="Tamanho do texto"><Seg label="Tamanho" value={size} onChange={setSize} options={[["p", "P"], ["m", "M"], ["g", "G"]]} /></Row>
              <Row label="Mostrar">
                <div className="row" style={{ gap: 14, fontSize: 14 }}>
                  {(["name", "value", "karaoke"] as const).map((k) => (
                    <label key={k} className="row" style={{ gap: 6 }}>
                      <input type="checkbox" className="selo" checked={show[k]} onChange={(e) => setShow({ ...show, [k]: e.target.checked })} />
                      {k === "name" ? "Nome" : k === "value" ? "Valor" : "Karaoke"}
                    </label>
                  ))}
                </div>
              </Row>
            </div>
            <div className="card">
              <span className="eyebrow">Som</span>
              <Row label="Som de entrada" sub="Toca durante a entrada">
                <div className="row" style={{ gap: 8 }}><select value={sound} onChange={(e) => setSound(e.target.value)} aria-label="Som de entrada">{SOUNDS.map((s) => <option key={s}>{s}</option>)}</select><button className="play-mini" aria-label="Ouvir">▶</button></div>
              </Row>
              <Row label="Som do nível super">
                <div className="row" style={{ gap: 8 }}><select value={superSound} onChange={(e) => setSuperSound(e.target.value)} aria-label="Som do nível super">{SOUNDS.map((s) => <option key={s}>{s}</option>)}</select><button className="play-mini" aria-label="Ouvir">▶</button></div>
              </Row>
              <Row label="Voz padrão">
                <div className="row" style={{ gap: 8 }}><select value={voice} onChange={(e) => setVoice(e.target.value)} aria-label="Voz padrão">{VOICES.map((s) => <option key={s}>{s}</option>)}</select><button className="play-mini" aria-label="Ouvir">▶</button></div>
              </Row>
              <Row label="Volume do alerta"><div style={{ width: 260 }}><Volume value={vol} onChange={setVol} /></div></Row>
            </div>
            <div className="card">
              <span className="eyebrow">Níveis e tempos</span>
              <div className="grid g2" style={{ marginTop: 12 }}>
                <Field label="Destaque a partir de" aside="Kz" error={err.hl}><input className="mono-in" inputMode="numeric" value={kz(hl, false)} onChange={(e) => setHl(Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
                <Field label="Super a partir de" aside="Kz" error={err.sup}><input className="mono-in" inputMode="numeric" value={kz(sup, false)} onChange={(e) => setSup(Number(e.target.value.replace(/\D/g, "")) || 0)} /></Field>
              </div>
              <Row label="Entrada · 400 a 700"><div><span className={cx("mini-num", err.enter && "erro")}><input inputMode="numeric" value={enter} onChange={(e) => setEnter(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Entrada em ms" /><span>ms</span></span>{err.enter && <p className="hint erro">{err.enter}</p>}</div></Row>
              <Row label="Saída · 300 a 500"><div><span className={cx("mini-num", err.exit && "erro")}><input inputMode="numeric" value={exit} onChange={(e) => setExit(Number(e.target.value.replace(/\D/g, "")) || 0)} aria-label="Saída em ms" /><span>ms</span></span>{err.exit && <p className="hint erro">{err.exit}</p>}</div></Row>
              <Row label="Reduzir movimento" sub="Só aparecer e desaparecer"><input type="checkbox" className="selo" checked={reduce} onChange={(e) => setReduce(e.target.checked)} /></Row>
            </div>
          </div>

          <div className="stack" style={{ gap: 16, position: "sticky", top: 90 }}>
            <div className="card stack" style={{ gap: 12 }}>
              <div className="row between"><span className="eyebrow">Pré-visualização</span><span className="muted" style={{ fontSize: 12 }}>Fundo transparente</span></div>
              <div className="pv-stage" style={{ minHeight: 280, padding: 30 }}>
                <AlertCard theme={theme} accent={accent} size={size} level={level} value={sample} showName={show.name} showValue={show.value} karaoke={show.karaoke} />
              </div>
              <div className="seg">{(["normal", "destaque", "super"] as const).map((l) => <button key={l} className={level === l ? "on" : ""} onClick={() => setLevel(l)}>{l[0]!.toUpperCase() + l.slice(1)}</button>)}</div>
              <div className="row" style={{ gap: 10 }}>
                <a className="btn" style={{ height: 52 }} href={`${widgetUrl(w, { dest: destination, theme, preview: true })}&reduce=${reduce ? 1 : 0}&in=${enter}&out=${exit}&hl=${hl}&sup=${sup}&accent=${accent.slice(1)}&size=${size}`} target="_blank" rel="noreferrer">Ouvir</a>
                <RouteButton onClick={() => sendTest().then(() => toast.show("Teste enviado para a live"), (e) => toast.show(`Falhou: ${(e as Error).message}`))}>Enviar teste para a live</RouteButton>
              </div>
            </div>
            <div className="card">
              <span className="eyebrow">Link do widget</span>
              <div className="row between" style={{ marginTop: 8, gap: 12, flexWrap: "wrap" }}>
                <span className="mono ellipsis" style={{ minWidth: 0 }}>{publicWidgetLink(w)}</span>
                <span className="row" style={{ gap: 12 }}><button className="link" onClick={() => { copy(widgetUrl(w, { dest: destination })); toast.show("Link copiado"); }}>Copiar</button><button className="link" onClick={() => regenerate("w1").then(() => toast.show("Link antigo revogado. Cola o novo no programa."), (e) => toast.show(`Falhou: ${(e as Error).message}`))}>Gerar novo</button></span>
              </div>
              <p className="hint">Posição e tamanho: ajusta a camada no programa de transmissão. Recomendado: 1080×1920 no TikTok LIVE Studio, 1920×1080 no OBS.</p>
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}

/** S6-O — Configurar W2 a W6 e o modo só-áudio. */
function OtherWidgets({ focus }: { focus: string }) {
  const nav = useNavigate();
  const toast = useToast();
  const [theme2, setTheme2] = useState<"talao" | "verde" | "contorno">("talao");
  const [barPos, setBarPos] = useState<"cima" | "baixo">("baixo");
  const [period, setPeriod] = useState<"live" | "dia" | "mes">("live");
  const [speed, setSpeed] = useState<"lenta" | "normal">("normal");
  const [call, setCall] = useState("Manda a tua mensagem!");
  const [fmt, setFmt] = useState<"c2" | "c3">("c3");
  const callErr = call.trim().length < 3 ? "Escreve uma chamada com pelo menos 3 caracteres." : null;
  const box = (id: string) => cx("card", focus === id && "focus");
  const T = ({ c }: { c: boolean }) => <input type="checkbox" className="selo" defaultChecked={c} />;

  return (
    <>
      <Topbar title="Outros widgets">
        <button className="btn" onClick={() => nav("/painel/widgets")}>Voltar</button>
        <div style={{ width: 140 }}><RouteButton size="sm" disabled={!!callErr} onClick={() => toast.show("Guardado")}>Guardar</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="wg-grid">
          <div className={box("w2")}>
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>W2</span>Meta de doação</h2>
            <label className="field" style={{ marginTop: 12 }}><span className="lbl">Meta ativa</span><select defaultValue={goal.title}><option>{goal.title}</option>{pastGoals.map((g) => <option key={g.title} disabled>{g.title} · terminada</option>)}</select></label>
            <Row label="Tema"><Seg label="Tema" value={theme2} onChange={setTheme2} options={[["talao", "Talão"], ["verde", "Verde"], ["contorno", "Contorno"]]} /></Row>
            <Row label="C1: posição da barra"><Seg label="Posição" value={barPos} onChange={setBarPos} options={[["cima", "Cima"], ["baixo", "Baixo"]]} /></Row>
            <Row label="Celebrar ao chegar a 100%"><T c /></Row>
            <Row label={`Mostrar "+ valor" a flutuar`}><T c /></Row>
            <Link to="/painel/metas" style={{ fontSize: 13 }}>Gerir metas</Link>
          </div>
          <div className={box("w4")}>
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>W4</span>Top doadores</h2>
            <Row label="Período"><Seg label="Período" value={period} onChange={setPeriod} options={[["live", "Live"], ["dia", "Dia"], ["mes", "Mês"]]} /></Row>
            <Row label="Mostrar totais"><T c /></Row>
            <Row label="C1"><span>Top 5</span></Row>
            <Row label="C2 e C3"><span>Top 3</span></Row>
            <Row label={`Incluir "Anónimo"`}><T c={false} /></Row>
          </div>
          <div className={box("w3")}>
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>W3</span>Últimas mensagens</h2>
            <Row label="C1"><span>Lista de 5</span></Row>
            <Row label="C2 e C3"><span>Ticker</span></Row>
            <Row label="Velocidade do ticker"><Seg label="Velocidade" value={speed} onChange={setSpeed} options={[["lenta", "Lenta"], ["normal", "Normal"]]} /></Row>
            <Row label="Mostrar valores"><T c /></Row>
          </div>
          <div className={box("w5")}>
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>W5</span>QR code</h2>
            <div style={{ marginTop: 12 }}><Field label="Chamada" aside={`${call.length}/40`} error={callErr}><input maxLength={40} value={call} onChange={(e) => setCall(e.target.value)} /></Field></div>
            <span className="eyebrow" style={{ display: "block", marginTop: 14 }}>Aparece em</span>
            <div className="chips" style={{ marginTop: 8 }}>{["YouTube", "Twitch", "Kick", "Facebook"].map((p) => <span key={p} className="tag ok">{p}</span>)}<span className="tag">TikTok · nunca</span><span className="tag">Instagram · nunca</span></div>
          </div>
          <div className={box("w6")}>
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>W6</span>Combinado</h2>
            <Row label="Alerta"><span>Igual ao W1</span></Row>
            <Row label="Meta em baixo"><T c /></Row>
            <Row label="Formato"><Seg label="Formato" value={fmt} onChange={setFmt} options={[["c2", "C2"], ["c3", "C3"]]} /></Row>
            <p className="hint">Uma só camada web. Útil no PRISM (até 4 camadas) e no CameraFi.</p>
          </div>
          <div className="card">
            <h2><span className="mono muted" style={{ fontSize: 12, marginRight: 8 }}>C5</span>Só áudio · Player</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>Live pela app nativa: nenhum widget é visível. O Player toca o som noutro aparelho ou numa coluna.</p>
            <Link className="btn block" style={{ marginTop: 14 }} to="/painel/player">Abrir Player</Link>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
