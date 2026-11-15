import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CodeInput, RouteButton } from "../../../shared/ui";

/** A5 — Verificação em 2 passos ao entrar (mockup F6). Código de demonstração: 123456. */
export default function TwoFactor() {
  const nav = useNavigate();
  const [state, setState] = useState<"idle" | "checking" | "error">("idle");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  const check = (c: string) => {
    setCode(c);
    setState("checking");
    setTimeout(() => (c === "123456" ? nav("/painel") : setState("error")), 900);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1>Verificação em 2 passos</h1>
      <p className="muted">{useRecovery ? "Escreve um dos teus códigos de recuperação." : "Abre a app autenticadora e escreve o código de 6 dígitos."}</p>
      <CodeInput onComplete={check} error={state === "error"} />
      {state === "error" && <p className="hint erro" role="alert">Código inválido ou expirado.</p>}
      {state === "checking" && <p className="hint row" style={{ gap: 8 }}><span style={{ width: 14, height: 14, border: "2px solid var(--verde)", borderTopColor: "transparent", borderRadius: "50%", animation: "fl-spin 1s linear infinite" }} /> A verificar…</p>}
      {state === "idle" && <p className="hint">Para testar, usa 123456.</p>}
      <RouteButton disabled={code.length < 6 || state === "checking"} onClick={() => check(code)}>Verificar</RouteButton>
      <button className="link" style={{ alignSelf: "center" }} onClick={() => setUseRecovery(!useRecovery)}>
        {useRecovery ? "Usar a app autenticadora" : "Usar um código de recuperação"}
      </button>
    </div>
  );
}
