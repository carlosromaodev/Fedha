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
    return (
      <StepsLayout step={4} title="Está quase" text="Partilha fedha.live/kiami na tua próxima live. As mensagens aparecem no ecrã e tocam assim que forem pagas.">
        <h1>Primeiros passos</h1>
        <div className="card lines" style={{ padding: "4px 20px" }}>
          {[
            ["Perfil e link", true, null],
            ["Plataformas", true, null],
            ["Preços", true, "Valores sugeridos · podes mudar"],
            ["Widget de alerta na live", false, "Copia o link do W1 para o OBS, LIVE Studio ou CameraFi"],
            ["Verificação de identidade", false, "Só é preciso para levantar"],
          ].map(([t, ok, sub]) => (
            <div key={t as string} className="row" style={{ gap: 12 }}>
              <span style={{ width: 22, height: 22, borderRadius: "50%", flex: "none", ...(ok ? { background: "var(--verde)" } : { border: "1.5px dashed var(--tinta-3)" }) }} />
              <span className="grow"><b style={{ fontWeight: 500 }}>{t as string}</b>{sub && <><br /><small className="muted">{sub as string}</small></>}</span>
            </div>
          ))}
        </div>
        <RouteButton onClick={() => nav("/verificacao")}>Verificar identidade agora</RouteButton>
        <button className="btn block" onClick={() => nav("/painel/widgets")}>Ligar o widget primeiro</button>
        <button className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => nav("/painel")}>Ir para o painel</button>
      </StepsLayout>
    );
  }

  return (
    <StepsLayout step={3} title="Onde fazes as tuas lives?" text="Usamos isto para mostrar AO VIVO na tua página e para escolher os widgets certos.">
      <h1>Plataformas</h1>
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
      <RouteButton disabled={!any} onClick={() => setDone(true)}>Continuar</RouteButton>
      <button className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => nav("/painel")}>Saltar por agora</button>
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
