import { useState } from "react";
import { Topbar } from "../../../layouts";
import { Field, Tag } from "../../../shared/ui";

/** B8 — Moderação global: lista base de palavras proibidas e denúncias. */
export default function Moderation() {
  const [words, setWords] = useState(["burla", "xinguilamento", "insulto-1", "insulto-2", "ódio-1"]);
  const [w, setW] = useState("");
  return (
    <>
      <Topbar title="Moderação global" />
      <div className="page">
        <div className="split" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
          <div className="card pad-l stack" style={{ gap: 12 }}>
            <h2>Lista base · {words.length}</h2>
            <p className="muted" style={{ fontSize: 14 }}>Aplica-se a todos os streamers, por cima das listas deles. Links, emails, telefones e QR são bloqueados por regra, não por lista.</p>
            <div className="chips">{words.map((x) => <span key={x} className="chip word">{x}<button aria-label={`Remover ${x}`} onClick={() => setWords(words.filter((y) => y !== x))}>×</button></span>)}</div>
            <form onSubmit={(e) => { e.preventDefault(); if (w.trim()) { setWords([...words, w.trim().toLowerCase()]); setW(""); } }}>
              <Field label="Nova palavra"><input value={w} onChange={(e) => setW(e.target.value)} /></Field>
            </form>
          </div>
          <div className="card pad-l">
            <h2>Denúncias</h2>
            <div className="lines" style={{ marginTop: 8, fontSize: 14 }}>
              <div className="row between"><span>Perfil de Benguela Gaming · imagem imprópria</span><Tag tone="pend">Nova</Tag></div>
              <div className="row between"><span>Mensagem FL-7B9A · ofensa que passou o filtro</span><Tag tone="ok">Analisada</Tag></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
