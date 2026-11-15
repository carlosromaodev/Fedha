import { copy, useToast } from "../../shared/ui";
import { streamer } from "../../shared/mocks/data";

/** Link público do streamer com botão Copiar, no topo do painel. */
export function LinkBox({ mobile = false }: { mobile?: boolean }) {
  const toast = useToast();
  return (
    <div className={mobile ? "linkbox" : "linkbox hide-m"}>
      <span>fedha.live/{streamer.handle}</span>
      <button className="btn dark sm" onClick={() => { copy(`https://fedha.live/${streamer.handle}`); toast.show("Link copiado"); }}>Copiar link</button>
      {toast.node}
    </div>
  );
}
