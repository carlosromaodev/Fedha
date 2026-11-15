import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, Modal, Tag, useToast } from "../../../shared/ui";

/** S14 — Conta (mockup E7). */
export default function Settings() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState("");
  const toast = useToast();
  const sessions = [
    { d: "Chrome · Windows", where: "Luanda · este computador", now: true },
    { d: "Safari · iPhone", where: "Luanda · há 2 h", now: false },
    { d: "OBS (overlay)", where: "Link do overlay · ativo", now: false },
  ];
  return (
    <>
      <Topbar title="Conta" />
      <div className="page" style={{ maxWidth: 860 }}>
        <div className="card pad-l stack" style={{ gap: 12 }}>
          <h2>Dados pessoais</h2>
          <div className="grid g2">
            <Field label="Nome completo"><input defaultValue="Kiami Domingos Gaspar" /></Field>
            <Field label="Email" hint="Alterar pede confirmação por código."><input defaultValue="kiami@fedha.live" /></Field>
            <Field label="Telemóvel" hint="Alterar pede confirmação por SMS."><input className="mono-in" defaultValue="+244 923 481 207" /></Field>
            <Field label="Verificação"><span className="row" style={{ paddingTop: 6 }}><Tag tone="ok">Conta verificada</Tag></span></Field>
          </div>
        </div>
        <div className="card pad-l stack" style={{ gap: 4 }}>
          <h2>Segurança</h2>
          <div className="lines" style={{ fontSize: 14 }}>
            <div className="row between"><span>Palavra-passe · alterada há 3 meses</span><button className="btn sm">Alterar</button></div>
            <div className="row between"><span>Verificação em 2 passos · app autenticadora</span><Tag tone="ok">Ativa</Tag></div>
            <div className="row between"><span>Códigos de recuperação · 8 por usar</span><button className="btn sm">Ver</button></div>
          </div>
        </div>
        <div className="card pad-l">
          <div className="row between"><h2>Sessões ativas</h2><button className="btn sm" onClick={() => toast.show("Outras sessões terminadas")}>Terminar as outras</button></div>
          <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
            {sessions.map((s) => <div key={s.d} className="row between"><span><b style={{ fontWeight: 500 }}>{s.d}</b><br /><small className="muted">{s.where}</small></span>{s.now && <Tag tone="ok">Esta sessão</Tag>}</div>)}
          </div>
        </div>
        <div className="card pad-l row between" style={{ gap: 16 }}>
          <div><h2>Eliminar conta</h2><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Só é possível com a carteira a zero. Os registos financeiros ficam guardados pelo prazo legal.</p></div>
          <button className="btn danger" onClick={() => setConfirmDelete(true)}>Eliminar</button>
        </div>
      </div>
      {confirmDelete && (
        <Modal title="Eliminar conta?" onClose={() => setConfirmDelete(false)}>
          <div className="aviso erro">Ainda tens 184.320 Kz disponíveis. Levanta o saldo antes de eliminar a conta.</div>
          <div style={{ marginTop: 12 }}><Field label='Escreve "ELIMINAR" para confirmar'><input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field></div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setConfirmDelete(false)}>Cancelar</button>
            <button className="btn danger grow" disabled>Eliminar conta</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
