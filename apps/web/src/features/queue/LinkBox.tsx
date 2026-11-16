import { useEffect, useState } from "react";
import { Check, Copy, copy, useToast } from "../../shared/ui";
import { streamer } from "../../shared/mocks/data";

/** Link público do streamer com botão Copiar, no topo do painel. O botão confirma com um visto. */
export function LinkBox({ mobile = false }: { mobile?: boolean }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(false), 1800); return () => clearTimeout(t); }, [done]);
  return (
    <div className={mobile ? "linkbox" : "linkbox hide-m"}>
      <span>fedha.live/{streamer.handle}</span>
      <button className={done ? "btn dark sm copied" : "btn dark sm"} onClick={() => { copy(`https://fedha.live/${streamer.handle}`); setDone(true); toast.show("Link copiado"); }}>
        {done ? <Check aria-hidden /> : <Copy aria-hidden />}{done ? "Copiado" : "Copiar link"}
      </button>
      {toast.node}
    </div>
  );
}
