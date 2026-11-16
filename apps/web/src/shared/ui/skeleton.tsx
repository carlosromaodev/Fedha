import type { CSSProperties } from "react";

/** Bloco de esqueleto com brilho a passar (RNF de perceção de velocidade). */
export function Skeleton({ w = "100%", h = 14, r, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skel" aria-hidden style={{ display: "block", width: w, height: h, borderRadius: r, ...style }} />;
}

/** Esqueleto de página enquanto o bloco de código da rota carrega. */
export function PageSkeleton({ variant = "page" }: { variant?: "page" | "pub" }) {
  if (variant === "pub") {
    return (
      <div className="pub" role="status" aria-label="A carregar">
        <div className="sk-head" />
        <main className="pub-main">
          <Skeleton w="60%" h={28} r={8} />
          <Skeleton w="85%" />
          <Skeleton h={150} r={24} />
          <Skeleton h={64} r={12} />
          <Skeleton h={64} r={12} />
        </main>
      </div>
    );
  }
  return (
    <div className="page sk-page" role="status" aria-label="A carregar">
      <div className="sk-top"><Skeleton w={180} h={24} r={8} /><Skeleton w={260} h={12} /></div>
      <div className="grid g4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card stack" style={{ gap: 12 }}><Skeleton w="45%" h={10} /><Skeleton w="70%" h={24} r={6} /></div>)}
      </div>
      <div className="split">
        <div className="card stack" style={{ gap: 12 }}><Skeleton w="35%" h={14} /><Skeleton h={180} r={12} /></div>
        <div className="card stack" style={{ gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={44} r={12} />)}</div>
      </div>
    </div>
  );
}
