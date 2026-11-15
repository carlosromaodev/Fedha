import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CodeInput, RouteButton, useCountdown } from "../../../shared/ui";
import { mmss, phone } from "../../../shared/lib/format";

/** A2 — Código SMS (mockups F3 e F4). Código de demonstração: 481207. */
export default function Verify() {
  const nav = useNavigate();
  const state = (useLocation().state ?? {}) as { tel?: string; handle?: string };
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const [key, setKey] = useState(0);
  const left = useCountdown(60);

  const check = (c: string) => {
    setCode(c);
    if (c === "481207") { setError(false); setDone(true); } else setError(true);
  };

  if (done) {
    return (
      <div className="stack" style={{ gap: 16 }}>
        <div className="steps"><i className="on" /><i className="on" /><i /></div>
        <span className="tag ok" style={{ alignSelf: "flex-start" }}>Conta criada</span>
        <h1>O teu link está reservado</h1>
        <div className="talao verde" style={{ minHeight: 72 }}>
          <div className="corpo"><span className="eyebrow" style={{ color: "rgba(255,255,255,.7)" }}>O teu link</span><div className="mono" style={{ fontSize: 18, marginTop: 4 }}>fedha.live/{state.handle || "kiami"}</div></div>
          <div className="canhoto" style={{ minWidth: 72 }}><span className="tag sinal">Teu</span></div>
        </div>
        <p className="muted">Falta pouco: diz-nos onde fazes live para te mostrarmos como ligar o overlay.</p>
        <RouteButton onClick={() => nav("/boas-vindas")}>Configurar a minha live</RouteButton>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="steps"><i className="on" /><i className="on" /><i /></div>
      <h1>Confirma o teu número</h1>
      <p className="muted">Enviámos um código de 6 dígitos para {phone(state.tel || "923481207")}.</p>
      <CodeInput key={key} onComplete={check} error={error} />
      {error ? <p className="hint erro" role="alert">Código errado. Confirma a mensagem e tenta de novo.</p> : <p className="hint">Para testar, usa 481207.</p>}
      <div className="row between" style={{ fontSize: 14 }}>
        {left > 0 ? <span className="muted">Reenviar em <span className="mono">{mmss(left)}</span></span> : <button className="link" onClick={() => setKey((k) => k + 1)}>Reenviar código</button>}
        <button className="link" onClick={() => nav("/auth/registo")}>Mudar número</button>
      </div>
      <RouteButton disabled={code.length < 6} onClick={() => check(code)}>Confirmar</RouteButton>
    </div>
  );
}
