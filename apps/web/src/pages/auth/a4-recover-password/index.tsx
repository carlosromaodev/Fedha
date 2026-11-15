import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CodeInput, Field, RouteButton } from "../../../shared/ui";

/** A4 — Recuperação de palavra-passe por SMS ou email. */
export default function Recover() {
  const nav = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="steps"><i className="on" /><i className={step >= 2 ? "on" : ""} /><i className={step >= 3 ? "on" : ""} /></div>
      <h1>Recuperar acesso</h1>
      {step === 1 && (
        <>
          <p className="muted">Enviamos um código para o telemóvel ou email da conta.</p>
          <Field label="Telemóvel ou email"><input className="mono-in" value={id} onChange={(e) => setId(e.target.value)} /></Field>
          <RouteButton disabled={id.trim().length < 6} onClick={() => setStep(2)}>Enviar código</RouteButton>
        </>
      )}
      {step === 2 && (
        <>
          <p className="muted">Escreve o código de 6 dígitos que recebeste.</p>
          <CodeInput onComplete={setCode} />
          <RouteButton disabled={code.length < 6} onClick={() => setStep(3)}>Confirmar</RouteButton>
        </>
      )}
      {step === 3 && (
        <>
          <Field label="Nova palavra-passe" error={pass && (pass.length < 8 || !/\d/.test(pass)) ? "Usa pelo menos 8 caracteres, com um número." : null}>
            <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
          </Field>
          <p className="hint">Por segurança, as outras sessões abertas são terminadas.</p>
          <RouteButton disabled={pass.length < 8 || !/\d/.test(pass)} onClick={() => nav("/auth/entrar")}>Guardar e entrar</RouteButton>
        </>
      )}
      <Link to="/auth/entrar" style={{ textAlign: "center", fontSize: 14 }}>Voltar ao login</Link>
    </div>
  );
}
