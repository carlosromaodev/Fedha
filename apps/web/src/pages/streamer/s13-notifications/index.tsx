import { useState } from "react";
import { Topbar } from "../../../layouts";

const EVENTS = ["Nova mensagem", "Meta atingida", "Levantamento pago", "Verificação de identidade", "Denúncia analisada"];
const CHANNELS = ["Email", "Push", "WhatsApp", "SMS"];

/** S13 — Notificações: preferências por canal e por evento. */
export default function Notifications() {
  const [on, setOn] = useState<Record<string, boolean>>({ "Levantamento pago|SMS": true, "Levantamento pago|Email": true, "Verificação de identidade|SMS": true, "Meta atingida|Push": true });
  return (
    <>
      <Topbar title="Notificações" />
      <div className="page" style={{ maxWidth: 820 }}>
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead><tr><th>Evento</th>{CHANNELS.map((c) => <th key={c} className="num">{c}</th>)}</tr></thead>
            <tbody>
              {EVENTS.map((e) => (
                <tr key={e}>
                  <td>{e}</td>
                  {CHANNELS.map((c) => (
                    <td key={c} className="num">
                      <input type="checkbox" className="selo" aria-label={`${e} por ${c}`} checked={!!on[`${e}|${c}`]} onChange={(x) => setOn({ ...on, [`${e}|${c}`]: x.target.checked })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">Durante a live, "Nova mensagem" por SMS ou WhatsApp pode ser demasiado. A fila já mostra tudo em tempo real.</p>
      </div>
    </>
  );
}
