import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, RouteButton, Tag, useToast } from "../../../shared/ui";
import { assistants as initial } from "../../../shared/mocks/data";

/** S10 — Assistentes: só acompanham a fila e controlam o Player. Sem acesso à carteira nem às definições. */
export default function Assistants() {
  const [list, setList] = useState(initial);
  const [contact, setContact] = useState("");
  const toast = useToast();
  const ok = /\S+@\S+\.\S+/.test(contact) || /^9\d{8}$/.test(contact.replace(/\D/g, "").replace(/^244/, ""));

  return (
    <>
      <Topbar title="Assistentes" />
      <div className="page" style={{ maxWidth: 820 }}>
        <div className="card pad-l stack" style={{ gap: 12 }}>
          <h2>Convidar</h2>
          <p className="muted" style={{ fontSize: 14 }}>Um assistente vê a fila em direto e controla o volume e o teste de som. Não aprova nem rejeita mensagens, e não vê a carteira.</p>
          <Field label="Email ou telemóvel"><input value={contact} onChange={(e) => setContact(e.target.value)} /></Field>
          <div style={{ width: 200 }}><RouteButton size="sm" disabled={!ok} onClick={() => { setList([...list, { name: contact, contact, status: "convite enviado", since: new Date().toLocaleDateString("pt-PT") }]); setContact(""); toast.show("Convite enviado · válido 48 h"); }}>Enviar convite</RouteButton></div>
        </div>
        <div className="card lines" style={{ padding: "0 20px" }}>
          {list.map((a) => (
            <div key={a.contact} className="row between" style={{ gap: 12 }}>
              <div><b style={{ fontWeight: 500 }}>{a.name}</b><br /><small className="mono muted">{a.contact} · desde {a.since}</small></div>
              <Tag tone={a.status === "ativo" ? "ok" : "pend"}>{a.status}</Tag>
              <button className="link" onClick={() => { setList(list.filter((x) => x !== a)); toast.show("Acesso removido"); }}>Remover</button>
            </div>
          ))}
        </div>
      </div>
      {toast.node}
    </>
  );
}
