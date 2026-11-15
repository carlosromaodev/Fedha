import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StepsLayout } from "../../../layouts";
import { Modal, RouteButton } from "../../../shared/ui";

type P = { key: string; name: string; handle: string; on: boolean };

/** A6 — Primeiros passos (05): onde fazes as lives, e lista do que falta. */
export default function Onboarding() {
  const nav = useNavigate();
  const [list, setList] = useState<P[]>([
    { key: "tiktok", name: "TikTok", handle: "@kiamigamer", on: true },
    { key: "youtube", name: "YouTube", handle: "@KiamiGamerAO", on: true },
    { key: "instagram", name: "Instagram", handle: "", on: false },
    { key: "outras", name: "Kick, Twitch ou Facebook", handle: "", on: false },
  ]);
  const [edit, setEdit] = useState<P | null>(null);
  const [handle, setHandle] = useState("");
  const [done, setDone] = useState(false);
  const any = list.some((p) => p.on);

  if (done) {
    // Design 05 (tudo pronto): ecrã verde com o que está feito e o que falta.
    return (
      <div className="done-screen">
        <main>
          <span className="land-sym" style={{ width: 52, height: 52 }} aria-hidden />
          <h1>Está tudo pronto</h1>
          <p>Partilha fedha.live/kiami na tua próxima live. As mensagens tocam assim que forem pagas.</p>
          <div className="track">
            {["Perfil e link", "Plataformas", "Preços", "Widget de alerta"].map((t) => (
              <div key={t}><span className="b done" /><b className="grow" style={{ fontWeight: 500 }}>{t}</b></div>
            ))}
            <div><span className="b next" /><b className="grow" style={{ fontWeight: 500 }}>Verificação de identidade</b><span className="tag pend">Para levantar</span></div>
          </div>
        </main>
        <footer>
          <RouteButton tone="sinal" onClick={() => nav("/verificacao")}>Enviar documentos agora</RouteButton>
          <button className="btn ghost-light block" style={{ height: 52 }} onClick={() => nav("/painel")}>Ir para o painel</button>
        </footer>
      </div>
    );
  }

  return (
    <StepsLayout step={3} title="Onde fazes as tuas lives?" text="Usamos isto para mostrar AO VIVO na tua página e para escolher os widgets certos."
      foot={<>
        <RouteButton disabled={!any} onClick={() => setDone(true)}>Continuar</RouteButton>
        <button className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => nav("/painel")}>Saltar por agora</button>
      </>}>
      <h1 className="d-only">Plataformas</h1>
      <h1 className="m-only">Onde fazes as tuas lives?</h1>
      <p className="muted m-only" style={{ marginTop: -6 }}>Usamos isto para mostrar AO VIVO na tua página quando estiveres em directo.</p>
      {list.map((p) => (
        <div key={p.key} className="talao" style={p.on ? { boxShadow: "0 0 0 1.5px var(--verde) inset" } : undefined}>
          <div className="corpo"><span className="nome">{p.name}</span><div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{p.handle || "@o_teu_canal"}</div></div>
          <div className="canhoto" style={{ minWidth: 84, justifyContent: "center" }}>
            {p.on
              ? <button aria-label={`Desligar ${p.name}`} onClick={() => setList(list.map((x) => (x === p ? { ...x, on: false } : x)))} style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--verde)", border: 0 }} />
              : <button className="link" style={{ fontSize: 13 }} onClick={() => { setEdit(p); setHandle(""); }}>Ligar</button>}
          </div>
        </div>
      ))}
      <p className="muted m-only" style={{ fontSize: 13 }}>A seguir: preços das mensagens e ligação do widget.</p>
      {edit && (
        <Modal title={`Ligar ${edit.name}`} onClose={() => setEdit(null)}>
          <label className="field"><span className="lbl">O teu canal</span>
            <input className="mono-in" autoFocus value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@o_teu_canal" />
          </label>
          <p className="hint">Só usamos o nome do canal para mostrar onde estás em direto.</p>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setEdit(null)}>Cancelar</button>
            <button className="btn dark grow" disabled={handle.trim().length < 2} onClick={() => { setList(list.map((x) => (x === edit ? { ...x, on: true, handle: handle.startsWith("@") ? handle : `@${handle}` } : x))); setEdit(null); }}>Ligar</button>
          </div>
        </Modal>
      )}
    </StepsLayout>
  );
}
