import { useState } from "react";
import { Link } from "react-router-dom";
import { Topbar } from "../../../layouts";
import { CodeInput, Modal, RouteButton, Stat, Tag, useToast } from "../../../shared/ui";
import { ledger, wallet } from "../../../shared/mocks/data";
import { kz } from "../../../shared/lib/format";

const MIN = 5000;

/** S11 + S12 — Carteira, extrato e levantamento (mockup B5). */
export default function Wallet() {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<"iban" | "mcx">("iban");
  const [value, setValue] = useState("150000");
  const [code, setCode] = useState("");
  const toast = useToast();
  const amount = Number(value.replace(/\D/g, "")) || 0;
  const err = amount < MIN ? `O mínimo é ${kz(MIN)}.` : amount > wallet.available ? `Só tens ${kz(wallet.available)} disponíveis.` : null;
  const receive = Math.max(0, amount - wallet.withdrawFee);

  return (
    <>
      <Topbar title="Carteira" sub="Pendente 48 h, depois disponível para levantar">
        <div style={{ width: 150 }}><RouteButton size="sm" onClick={() => setOpen(true)}>Levantar</RouteButton></div>
      </Topbar>
      <div className="page">
        <div className="grid g3">
          <Stat label="Disponível" value={wallet.available} sub="Pronto para levantamento" tone="verde" />
          <Stat label="Pendente · 48 h" value={wallet.pending} sub={`Próxima libertação: ${wallet.releaseAt}`} />
          <Stat label="Novembro · líquido" value={wallet.monthNet} sub={`Bruto ${kz(wallet.monthGross)} · taxa ${kz(wallet.monthFee)}`} />
        </div>
        <div className="card table-wrap" style={{ padding: "18px 20px 8px" }}>
          <div className="row between"><h2>Movimentos</h2><Link to="/painel/historico">Ver histórico completo</Link></div>
          <table className="table" style={{ marginTop: 8 }}>
            <thead><tr><th>Data</th><th>Origem</th><th className="num">Bruto</th><th className="num">Taxa 10%</th><th className="num">Líquido</th><th className="num">Estado</th></tr></thead>
            <tbody>
              {ledger.map((r) => (
                <tr key={r.at + r.origin}>
                  <td className="mono muted" style={{ fontSize: 12.5 }}>{r.at}</td>
                  <td>{r.origin}</td>
                  <td className="num kz">{kz(r.gross)}</td>
                  <td className="num mono muted">{r.fee ? `−${kz(r.fee, false)}` : "0"}</td>
                  <td className="num kz">{kz(r.net)}</td>
                  <td className="num">
                    {r.status === "pendente" ? <Tag tone="pend">Pendente · {r.until}</Tag> : r.status === "disponivel" ? <Tag tone="ok">Disponível</Tag> : <Tag tone="erro">Reembolsado · falha</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {open && (
        <Modal title="Confirmar levantamento" onClose={() => setOpen(false)} closable>
          <div className="stack" style={{ gap: 12 }}>
            <span className="eyebrow">Destino</span>
            <div className="grid g2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <button className={dest === "iban" ? "opcao on" : "opcao"} onClick={() => setDest("iban")}>
                <span className="radio" /><span><b>IBAN</b><br /><small className="mono muted">BAI · AO06 •••• 4471</small></span>
              </button>
              <button className={dest === "mcx" ? "opcao on" : "opcao"} onClick={() => setDest("mcx")}>
                <span className="radio" /><span><b>Multicaixa Express</b><br /><small className="mono muted">+244 923 ••• 207</small></span>
              </button>
            </div>
            <label className={err ? "field erro" : "field"}>
              <span className="lbl"><span>Valor</span><span style={{ textTransform: "none" }}>máx. {kz(wallet.available, false)}</span></span>
              <input className="mono-in" inputMode="numeric" value={amount ? kz(amount) : ""} onChange={(e) => setValue(e.target.value)} />
            </label>
            {err && <p className="hint erro">{err}</p>}
            <div className="card stack" style={{ background: "var(--papel)", gap: 8, padding: 16 }}>
              <div className="row between mono" style={{ fontSize: 13 }}><span className="muted">Valor a levantar</span><span>{kz(amount)}</span></div>
              <div className="row between mono" style={{ fontSize: 13 }}><span className="muted">Taxa</span><span>{kz(wallet.withdrawFee)}</span></div>
              <div className="row between mono" style={{ borderTop: "1px dashed var(--linha-forte)", paddingTop: 8 }}><span>Vais receber</span><b>{kz(receive)}</b></div>
            </div>
            <div className="row between" style={{ fontSize: 12.5 }}><span className="muted">Prazo: até 2 dias úteis</span><span className="muted">Fica disponível: {kz(Math.max(0, wallet.available - amount))}</span></div>
            <span className="eyebrow">Código enviado por SMS para +244 923 ••• 207</span>
            <CodeInput onComplete={setCode} />
            <div className="row" style={{ gap: 10 }}>
              <button className="btn" style={{ height: 52, flex: "0 0 40%" }} onClick={() => setOpen(false)}>Cancelar</button>
              <RouteButton value={amount} disabled={!!err || code.length < 6} onClick={() => { setOpen(false); toast.show("Levantamento pedido. Recebes uma notificação quando for pago."); }}>Levantar</RouteButton>
            </div>
          </div>
        </Modal>
      )}
      {toast.node}
    </>
  );
}
