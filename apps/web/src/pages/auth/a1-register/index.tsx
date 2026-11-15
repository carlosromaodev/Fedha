import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

/** A1 — Registo de streamer (mockups F2 e F4: validação por campo, reserva do link). */
export default function Register() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [tel, setTel] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [terms, setTerms] = useState(false);
  const [t, setT] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setT((x) => ({ ...x, [k]: true }));

  const digits = tel.replace(/\D/g, "").replace(/^244/, "");
  const slug = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const taken = ["kiami", "djnelo", "luanaplays", "admin", "fedha"].includes(slug);
  const s = strength(pass);
  const err = {
    name: name.trim().split(/\s+/).length < 2 ? "Escreve o nome e o apelido." : null,
    handle: slug.length < 3 ? "Pelo menos 3 letras ou números." : taken ? `fedha.live/${slug} já está ocupado.` : null,
    tel: /^9\d{8}$/.test(digits) ? null : "Número angolano com 9 dígitos, a começar por 9.",
    pass: pass.length >= 8 && /\d/.test(pass) ? null : "Usa pelo menos 8 caracteres, com um número.",
  };
  const valid = !err.name && !err.handle && !err.tel && !err.pass && terms;

  return (
    <>
      <div className="steps" aria-label="Passo 1 de 3"><i className="on" /><i /><i /></div>
      <div className="row between"><h1>Cria a tua conta</h1></div>
      <p className="muted">Recebe mensagens pagas em Kz em qualquer app de live.</p>

      <Field label="Nome completo" error={t.name ? err.name : null} ok={!!name && !err.name}>
        <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} onBlur={() => touch("name")} />
      </Field>
      <Field label="O teu link" error={t.handle || slug ? err.handle : null} ok={!!slug && !err.handle}
        hint={!err.handle && slug ? <span className="ok" style={{ color: "var(--verde)" }}>fedha.live/{slug} está livre</span> : "É o link que partilhas na bio."}>
        <span className="row mono" style={{ paddingTop: 4, fontSize: 16 }}>
          <span className="muted">fedha.live/</span>
          <input className="mono-in" style={{ padding: 0 }} value={handle} onChange={(e) => setHandle(e.target.value)} onBlur={() => touch("handle")} autoCapitalize="off" />
        </span>
      </Field>
      <Field label="Telemóvel" error={t.tel ? err.tel : null} ok={!err.tel} hint="Enviamos um código por SMS para confirmar.">
        <input className="mono-in" inputMode="tel" autoComplete="tel" value={tel ? phone(tel) : ""} onChange={(e) => setTel(e.target.value)} onBlur={() => touch("tel")} placeholder="+244 9__ ___ ___" />
      </Field>
      <div>
        <Field label="Palavra-passe" error={t.pass ? err.pass : null} aside={
          <button type="button" onClick={() => setShow(!show)} style={{ border: 0, background: "none", padding: 0, fontFamily: "var(--font)", textTransform: "none", letterSpacing: 0, fontSize: 13, color: "var(--tinta-2)" }}>{show ? "Esconder" : "Mostrar"}</button>
        }>
          <input type={show ? "text" : "password"} autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} onBlur={() => touch("pass")} />
        </Field>
        <div className="meter" style={{ height: 10, marginTop: 10 }} aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ height: "100%", background: i < Math.ceil((s / 4) * 12) ? (s <= 1 ? "var(--erro)" : s === 2 ? "#d39b2a" : "var(--verde)") : undefined }} />
          ))}
        </div>
        <div className="row between eyebrow" style={{ marginTop: 6 }}><span>Força · {pass ? LABEL[s] : "—"}</span><span>8+ caracteres · 1 número</span></div>
      </div>
      <label className="row" style={{ gap: 12, fontSize: 14 }}>
        <input type="checkbox" className="selo" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>Li e aceito os <a href="#termos">Termos</a> e a <a href="#privacidade">Política de privacidade</a>.</span>
      </label>
      <RouteButton disabled={!valid} onClick={() => nav("/auth/verificar", { state: { tel: digits, handle: slug } })}>Continuar</RouteButton>
      <p className="muted" style={{ textAlign: "center", fontSize: 14 }}>Já tens conta? <Link to="/auth/entrar">Entrar</Link></p>
    </>
  );
}
