import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, useToast } from "../../../shared/ui";
import { blockedSenders, blockedWords } from "../../../shared/mocks/data";
import { maskPhone } from "../../../shared/lib/format";
import { checkMessage, FILTER_MSG } from "../../../shared/lib/rules";

/**
 * S9 — Filtros antes do pagamento (mockup B6, coluna Filtros).
 * Links, emails, telefones e QR ficam sempre ligados: a mensagem aparece escrita no ecrã da live.
 */
export default function Filters() {
  const [words, setWords] = useState(blockedWords);
  const [senders, setSenders] = useState(blockedSenders);
  const [word, setWord] = useState("");
  const [test, setTest] = useState("");
  const toast = useToast();
  const w = word.trim().toLowerCase();
  const err = w && words.includes(w) ? `"${w}" já está na lista.` : w && w.length < 2 ? "Pelo menos 2 letras." : null;
  const hit = test ? checkMessage(test, words) : null;

  const add = () => { if (!w || err) return; setWords([...words, w]); setWord(""); };

  return (
    <>
      <Topbar title="Filtros" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div className="card pad-l">
            <p className="muted">Correm antes do pagamento. Uma mensagem bloqueada nunca é cobrada nem chega à live.</p>
            <div className="eyebrow" style={{ marginTop: 20, paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>Sempre ativos</div>
            <div className="lines" style={{ fontSize: 14 }}>
              {["Links e endereços de sites", "Emails e números de telefone", "QR codes em áudio ou imagem", "Insultos e discurso de ódio (lista da plataforma)"].map((t) => (
                <div key={t} className="row between" style={{ gap: 12 }}>
                  <span>{t}</span>
                  <input type="checkbox" className="toggle" checked disabled aria-label={`${t}: sempre ligado`} />
                </div>
              ))}
            </div>
            <p className="hint">Não podem ser desligados. As plataformas de live penalizam links e contactos no ecrã, e a responsabilidade é do streamer.</p>

            <div className="eyebrow" style={{ marginTop: 24, paddingBottom: 8, borderBottom: "1px solid var(--tinta)" }}>As tuas palavras proibidas · {words.length}</div>
            <div className="chips" style={{ marginTop: 12 }}>
              {words.map((x) => (
                <span key={x} className="chip word">{x}<button aria-label={`Remover ${x}`} onClick={() => setWords(words.filter((y) => y !== x))}>×</button></span>
              ))}
            </div>
            <form style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); add(); }}>
              <Field label="Nova palavra" error={err} hint="Carrega Enter para adicionar.">
                <input value={word} onChange={(e) => setWord(e.target.value)} />
              </Field>
            </form>
          </div>

          <div className="stack" style={{ gap: 16 }}>
            <div className="card pad-l">
              <h2>Remetentes bloqueados · {senders.length}</h2>
              <div className="lines" style={{ marginTop: 8 }}>
                {senders.map((s) => (
                  <div key={s} className="row between">
                    <span className="mono">{maskPhone(s)}</span>
                    <button className="link" onClick={() => { setSenders(senders.filter((x) => x !== s)); toast.show("Remetente desbloqueado"); }}>Desbloquear</button>
                  </div>
                ))}
                {senders.length === 0 && <p className="muted">Ninguém bloqueado.</p>}
              </div>
            </div>
            <div className="card pad-l stack" style={{ gap: 12 }}>
              <h2>Testar uma mensagem</h2>
              <Field label="Mensagem de teste" error={hit ? FILTER_MSG[hit.kind] : null} ok={!!test && !hit}>
                <textarea value={test} onChange={(e) => setTest(e.target.value)} placeholder="Ex.: segue-me em insta.com/kiami" />
              </Field>
              {test && !hit && <p className="hint ok">Esta mensagem passa nos filtros.</p>}
            </div>
          </div>
        </div>
      </div>
      {toast.node}
    </>
  );
}
