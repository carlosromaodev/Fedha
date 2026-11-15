import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Field, RouteButton } from "../../../shared/ui";

/** A3 — Login (mockup F5). Demonstração: 923481207 / fedha2026. */
export default function Login() {
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [keep, setKeep] = useState(true);
  const [tries, setTries] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const locked = tries <= 0;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const okId = id.replace(/\D/g, "").endsWith("923481207") || id.trim() === "kiami@fedha.live";
    if (okId && pass === "fedha2026") { nav("/auth/2fa"); return; }
    const left = tries - 1;
    setTries(left);
    setError(left > 0 ? `Telemóvel ou palavra-passe incorretos. Restam ${left} tentativas.` : "Conta bloqueada por 15 minutos depois de 5 tentativas. Podes recuperar a palavra-passe.");
  };

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit} noValidate>
      <h1>Entrar no painel</h1>
      {error && <div className="aviso erro" role="alert">{error}</div>}
      <Field label="Telemóvel ou email" error={error ? " " : null}>
        <input className="mono-in" value={id} autoComplete="username" onChange={(e) => setId(e.target.value)} disabled={locked} />
      </Field>
      <Field label="Palavra-passe" error={error ? " " : null} aside={
        <button type="button" onClick={() => setShow(!show)} style={{ border: 0, background: "none", padding: 0, fontFamily: "var(--font)", textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--tinta-2)" }}>{show ? "Esconder" : "Mostrar"}</button>
      }>
        <input type={show ? "text" : "password"} value={pass} autoComplete="current-password" onChange={(e) => setPass(e.target.value)} disabled={locked} />
      </Field>
      <div className="row between" style={{ fontSize: 14, gap: 12 }}>
        <label className="row" style={{ gap: 10 }}><input type="checkbox" className="selo" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> Manter sessão</label>
        <Link to="/auth/recuperar">Esqueci-me da palavra-passe</Link>
      </div>
      <RouteButton type="submit" disabled={locked}>Entrar</RouteButton>
      <p className="muted" style={{ textAlign: "center", fontSize: 14 }}>Ainda não tens conta? <Link to="/auth/registo">Criar conta</Link></p>
      <p className="hint" style={{ textAlign: "center" }}>Demonstração: 923 481 207 · fedha2026</p>
    </form>
  );
}
