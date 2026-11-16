import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Field, RouteButton } from "../../../shared/ui";
import { StepsLayout } from "../../../layouts";
import { cx } from "../../../shared/lib/format";

type Doc = { key: string; title: string; sub: string; progress: number | null; size?: string };

/** A7 — Verificação de identidade (mockup F8). */
export default function Kyc() {
  const nav = useNavigate();
  const [kind, setKind] = useState<"bi" | "passaporte">("bi");
  const [nif, setNif] = useState("");
  const [iban, setIban] = useState("");
  const [sent, setSent] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([
    { key: "frente", title: "BI · frente", sub: "Foto nítida, sem reflexos", progress: null },
    { key: "verso", title: "BI · verso", sub: "Foto nítida, sem reflexos", progress: null },
    { key: "selfie", title: "Selfie a segurar o BI", sub: "Rosto e documento visíveis", progress: null },
    { key: "banco", title: "Comprovativo do IBAN", sub: "Em nome do titular", progress: null },
  ]);
  const nifOk = /^\d{9}[A-Z]{2}\d{3}$/i.test(nif.trim());
  const ibanOk = /^AO06\d{21}$/i.test(iban.replace(/\s/g, ""));
  const allDocs = docs.every((d) => d.progress === 100);

  const upload = (key: string, file?: File) => {
    if (!file) return;
    const size = `${(file.size / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + 18);
      setDocs((ds) => ds.map((d) => (d.key === key ? { ...d, progress: p, size } : d)));
      if (p === 100) clearInterval(t);
    }, 180);
  };

  if (sent) {
    return (
      <div className="pub verde">
        <main className="pub-main" style={{ justifyContent: "center", gap: 16 }}>
          <span className="tag pend" style={{ alignSelf: "flex-start" }}>Em análise</span>
          <h1>Documentos enviados</h1>
          <p style={{ fontWeight: 300, lineHeight: 1.55 }}>Respondemos em até 24 h por SMS. Entretanto podes fazer lives e receber mensagens. Os levantamentos ficam disponíveis depois da verificação.</p>
        </main>
        <footer className="pub-foot"><RouteButton tone="sinal" onClick={() => nav("/painel")}>Ir para o painel</RouteButton></footer>
      </div>
    );
  }

  return (
    <StepsLayout step={4} title="Verifica a tua identidade" text="Obrigatório para levantar dinheiro. Só a equipa de Compliance vê os documentos."
      foot={<>
        <RouteButton disabled={!(allDocs || (kind === "passaporte" && docs.filter((d) => d.key !== "verso").every((d) => d.progress === 100))) || !nifOk || (!!iban && !ibanOk)} onClick={() => setSent(true)}>
          Enviar para análise
        </RouteButton>
        <button className="link" style={{ alignSelf: "center", fontSize: 14 }} onClick={() => nav("/painel")}>Fazer depois</button>
      </>}>
        <h1>Documentos</h1>
        <div className="seg">
          <button className={kind === "bi" ? "on" : ""} onClick={() => setKind("bi")}>BI</button>
          <button className={kind === "passaporte" ? "on" : ""} onClick={() => setKind("passaporte")}>Passaporte</button>
        </div>
        {docs.filter((d) => kind === "bi" || d.key !== "verso").map((d) => (
          <div key={d.key} className="talao">
            <div className="corpo">
              <span className="nome">{kind === "passaporte" ? d.title.replace("BI · frente", "Passaporte").replace("o BI", "o passaporte") : d.title}</span>
              {d.progress === null ? <div className="texto">{d.sub}</div>
                : d.progress < 100 ? <div className="meter" style={{ height: 12, marginTop: 8, maxWidth: 240 }}>{Array.from({ length: 20 }, (_, i) => <i key={i} className={cx(i < d.progress! / 5 && "on")} style={{ height: `${50 + ((i * 31) % 50)}%` }} />)}</div>
                : <div className="texto">Carregado · {d.size}</div>}
            </div>
            <div className="canhoto" style={{ minWidth: 96 }}>
              {d.progress === 100 ? <span style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--verde)" }} aria-label="Carregado" />
                : d.progress !== null ? <span className="mono" style={{ fontSize: 13 }}>{d.progress}%</span>
                : (
                  <label className="link" style={{ fontSize: 13, cursor: "pointer" }}>
                    {d.key === "selfie" ? "Tirar foto" : "Carregar"}
                    <input type="file" accept="image/*,application/pdf" capture={d.key === "selfie" ? "user" : undefined} className="sr-only" onChange={(e) => upload(d.key, e.target.files?.[0])} />
                  </label>
                )}
            </div>
          </div>
        ))}
        <Field label="NIF" error={nif && !nifOk ? "O NIF tem 14 caracteres (ex.: 004812337LA041)." : null} ok={nifOk}>
          <input className="mono-in" value={nif} maxLength={14} onChange={(e) => setNif(e.target.value.toUpperCase())} />
        </Field>
        <Field label="IBAN (opcional)" error={iban && !ibanOk ? "IBAN angolano: AO06 seguido de 21 dígitos." : null} ok={ibanOk} hint="Em teu nome. Podes adicionar depois na Carteira.">
          <input className="mono-in" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="AO06 …" />
        </Field>
    </StepsLayout>
  );
}
