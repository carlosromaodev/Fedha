import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { StepsLayout } from "../../../layouts";
import { CodeInput, RouteButton, useCountdown } from "../../../shared/ui";
import { mmss, phone } from "../../../shared/lib/format";

/** A2 — Confirmar telemóvel (03). Código de demonstração: 481207. */
export default function Verify() {
  const nav = useNavigate();
  const state = (useLocation().state ?? {}) as { tel?: string; name?: string };
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const [key, setKey] = useState(0);
  const left = useCountdown(60);

  const check = (c: string) => {
    setCode(c);
    setChecking(true);
    setTimeout(() => {
      setChecking(false);
      if (c === "481207") nav("/auth/link", { state });
      else setError(true);
    }, 600);
  };

  return (
    <StepsLayout step={1} title="Confirma o teu telemóvel" text="É por aqui que recebes os códigos de segurança e os avisos de levantamento."
      foot={<RouteButton disabled={code.length < 6 || checking} onClick={() => check(code)}>Confirmar</RouteButton>}>
      <h1>Código SMS</h1>
      <p className="muted">Enviámos um código de 6 dígitos para <span className="mono">{phone(state.tel || "923481207")}</span>.</p>
      <CodeInput key={key} onComplete={check} error={error} />
      {error ? <p className="hint erro" role="alert">Código errado. Confirma a mensagem e tenta de novo.</p>
        : checking ? <p className="hint">A verificar…</p>
        : <p className="hint">Para testar, usa 481207.</p>}
      <div className="row between" style={{ fontSize: 14 }}>
        {left > 0 ? <span className="muted">Reenviar em <span className="mono">{mmss(left)}</span></span> : <button className="link" onClick={() => { setKey((k) => k + 1); setError(false); }}>Reenviar código</button>}
        <button className="link" onClick={() => nav("/auth/registo")}>Mudar número</button>
      </div>
    </StepsLayout>
  );
}
