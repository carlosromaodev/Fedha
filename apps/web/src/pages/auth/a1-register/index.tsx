import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StepsLayout } from "../../../layouts";
import { Field, RouteButton } from "../../../shared/ui";
import { phone } from "../../../shared/lib/format";

function strength(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/\d/.test(p)) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
  return s;
}
const LABEL = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"];

/** A1 — Criar conta (02): validação por campo enquanto escreve. */
export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [t, setT] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setT((x) => ({ ...x, [k]: true }));

  const digits = tel.replace(/\D/g, "").replace(/^244/, "");
  const s = strength(pass);
  const err = {
    name: name.trim().split(/\s+/).length < 2 ? "Escreve o nome e o apelido." : null,
    tel: /^9\d{8}$/.test(digits) ? null : "Número angolano com 9 dígitos, a começar por 9.",
    email: /^\S+@\S+\.\S+$/.test(email.trim()) ? null : "Email inválido.",
    pass: pass.length >= 8 && /\d/.test(pass) ? null : "Usa pelo menos 8 caracteres, com um número.",
  };
  const valid = !err.name && !err.tel && !err.email && !err.pass && terms;

  return (
    <StepsLayout step={0} title="Cria a tua conta de streamer" text="Cinco passos curtos. Ao fim, tens um link para partilhar na live.">
      <h1>Os teus dados</h1>
      <Field label="Nome completo" error={t.name ? err.name : null} ok={!!name && !err.name}
        aside={!!name && !err.name ? <span style={{ width: 18, height: 18, borderRadius: "50%", background: "var(--verde)", display: "inline-block" }} aria-label="Válido" /> : undefined}>
        <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} />
      </Field>
      <Field label="Telemóvel" error={t.tel ? err.tel : null} ok={!err.tel} hint="Enviamos um código por SMS para confirmar.">
        <input className="mono-in" inputMode="tel" autoComplete="tel" value={tel ? phone(tel) : ""} onChange={(e) => setTel(e.target.value)} onBlur={() => touch("tel")} placeholder="+244 9__ ___ ___" />
      </Field>
      <Field label="Email" error={t.email ? err.email : null} ok={!err.email}>
        <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => touch("email")} />
      </Field>
      <div>
        <Field label="Palavra-passe" error={t.pass || pass ? err.pass : null} aside={
          <button type="button" onClick={() => setShow(!show)} style={{ border: 0, background: "none", padding: 0, fontFamily: "var(--font)", textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--tinta-2)" }}>{show ? "Esconder" : "Mostrar"}</button>
        }>
          <input type={show ? "text" : "password"} autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} onBlur={() => touch("pass")} />
        </Field>
        <div className="meter" style={{ height: 10, marginTop: 10 }} aria-label={`Força da palavra-passe: ${pass ? LABEL[s] : "—"}`}>
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ height: "100%", background: i < Math.ceil((s / 4) * 12) ? (s <= 1 ? "var(--erro)" : s === 2 ? "#d39b2a" : "var(--verde)") : undefined }} />
          ))}
        </div>
      </div>
      <label className="row" style={{ gap: 12, fontSize: 14 }}>
        <input type="checkbox" className="selo" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Li e aceito os <a href="#termos">Termos</a> e a <a href="#privacidade">Política de privacidade</a>.</span>
      </label>
      <RouteButton disabled={!valid} onClick={() => nav("/auth/verificar", { state: { tel: digits, name: name.trim() } })}>Continuar</RouteButton>
      <p className="muted" style={{ textAlign: "center", fontSize: 14 }}>Já tens conta? <Link to="/auth/entrar">Entrar</Link></p>
    </StepsLayout>
  );
}
