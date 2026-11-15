import { useState } from "react";
import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { Field, Modal, Tag, useToast } from "../../../shared/ui";

/** S14 — Conta (28): dados, segurança, destinos de levantamento e notificações. */
export default function Settings() {
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [typed, setTyped] = useState("");
  const [sessions, setSessions] = useState([
    { d: "Chrome · Windows", where: "Luanda · agora", me: true },
    { d: "Safari · iPhone", where: "Luanda · há 2 h", me: false },
  ]);
  const [notif, setNotif] = useState({ sms: true, player: true, meta: false });

  return (
    <>
      <Topbar title="Conta" sub="Dados, segurança, destinos de levantamento e notificações" />
      <div className="page">
        <div className="grid g2" style={{ gap: 16, alignItems: "stretch" }}>
          <div className="card pad-l">
            <div className="row between"><h2>Dados pessoais</h2><button className="link">Editar</button></div>
            <div className="lines kv" style={{ marginTop: 8 }}>
              <div><span>Nome</span><span>Kiami Domingos Gaspar</span></div>
              <div><span>Telemóvel</span><span className="row" style={{ gap: 8 }}><span className="mono">+244 923 481 207</span><Tag tone="ok">Verificado</Tag></span></div>
              <div><span>Email</span><span>kiami.gamer@gmail.com</span></div>
              <div><span>Identidade</span><span className="row" style={{ gap: 8 }}><span className="mono">Verificada a 02/10/2026</span><Tag>BI</Tag></span></div>
            </div>
          </div>
          <div className="card pad-l">
            <h2>Segurança</h2>
            <div className="lines kv" style={{ marginTop: 8 }}>
              <div><span>Palavra-passe</span><span className="row" style={{ gap: 8 }}>Alterada há 3 meses <button className="link">Alterar</button></span></div>
              <div><span>Verificação em 2 passos</span><span className="row" style={{ gap: 8 }}>SMS <Tag tone="ok">Ativa</Tag></span></div>
            </div>
            <div className="eyebrow" style={{ marginTop: 14 }}>Sessões ativas · {sessions.length}</div>
            <div className="lines">
              {sessions.map((s) => (
                <div key={s.d} className="row between">
                  <span><span>{s.d}</span><br /><small className="mono muted" style={{ fontSize: 11 }}>{s.where}</small></span>
                  {s.me ? <Tag>Esta sessão</Tag> : <button className="link" onClick={() => { setSessions(sessions.filter((x) => x !== s)); toast.show("Sessão terminada"); }}>Terminar</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="card pad-l">
            <div className="row between"><h2>Destinos de levantamento</h2><button className="link">Adicionar</button></div>
            <div className="lines kv" style={{ marginTop: 8 }}>
              <div><span>IBAN · BAI</span><span className="row" style={{ gap: 8 }}><span className="mono">AO06 0040 •••• 4471 2</span><Tag tone="dark">Principal</Tag></span></div>
              <div><span>Multicaixa Express</span><span className="mono">+244 923 481 207</span></div>
            </div>
            <p className="hint" style={{ marginTop: 12 }}>Taxa de levantamento: 300 Kz por pedido.</p>
          </div>
          <div className="card pad-l">
            <h2>Notificações</h2>
            <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
              {([["sms", "Resumo diário por SMS"], ["player", "Avisar quando o Player desligar"], ["meta", "Avisar quando uma meta for atingida"]] as const).map(([k, l]) => (
                <label key={k} className="row between"><span className="muted">{l}</span><input type="checkbox" className="selo" checked={notif[k]} onChange={(e) => setNotif({ ...notif, [k]: e.target.checked })} /></label>
              ))}
            </div>
            <Link to="/painel/notificacoes" style={{ display: "inline-block", marginTop: 10, fontSize: 13 }}>Mais preferências</Link>
          </div>
        </div>
        <div className="card danger-zone row between" style={{ gap: 16, flexWrap: "wrap" }}>
          <div><h2>Eliminar conta</h2><p className="muted" style={{ fontSize: 14, marginTop: 4 }}>Só é possível com saldo disponível e pendente a 0 Kz. O link fedha.live/kiami fica livre após 30 dias.</p></div>
          <button className="btn danger" onClick={() => setDel(true)}>Eliminar conta</button>
        </div>
      </div>
      {del && (
        <Modal title="Eliminar conta?" onClose={() => setDel(false)}>
          <div className="aviso erro">Ainda tens 184.320 Kz disponíveis e 46.800 Kz pendentes. Levanta o saldo antes de eliminar a conta.</div>
          <div style={{ marginTop: 12 }}><Field label='Escreve "ELIMINAR" para confirmar'><input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field></div>
          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            <button className="btn grow" onClick={() => setDel(false)}>Cancelar</button>
            <button className="btn danger grow" disabled>Eliminar conta</button>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
