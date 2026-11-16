import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { cx, kz } from "../lib/format";
import { ArrowRight, CheckCircle2, Inbox, MoreHorizontal, X, type LucideIcon } from "./icons";

export * from "./icons";
export { Skeleton, PageSkeleton } from "./skeleton";

/** Vibração curta (Android/Chrome); no resto é ignorada sem erro. */
export function haptic(ms: number | number[] = 8) {
  try { if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms); } catch { /* sem suporte */ }
}

export function Logo({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="logo" aria-label="Fedha LIVE">
      <b>Fedha</b><span>LIVE</span>
    </Link>
  );
}

type RouteBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { value?: number; tone?: "verde" | "sinal"; size?: "sm" };
/** Botão de rota: cápsula com o símbolo na ponta; o valor viaja dentro do botão. */
export function RouteButton({ children, value, tone = "verde", size, className, onClick, ...rest }: RouteBtnProps) {
  return (
    <button className={cx("btn-route", tone === "sinal" && "sinal", size, className)} onClick={(e) => { haptic(12); onClick?.(e); }} {...rest}>
      <span className="label">{children}</span>
      {value !== undefined && <span className="val">{kz(value)}</span>}
      <span className="dot" aria-hidden><ArrowRight strokeWidth={2.4} /></span>
    </button>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone?: "ok" | "pend" | "erro" | "dark" | "sinal" }) {
  return <span className={cx("tag", tone)}>{children}</span>;
}

export function LiveBadge({ children = "Ao vivo" }: { children?: ReactNode }) {
  return <span className="live">{children}</span>;
}

/** Talão: texto à esquerda, valor no canhoto, picotado entre os dois. */
export function Talao({ name, text, value, meta, tone, onMenu, children }: {
  name: ReactNode; text?: ReactNode; value: number | ReactNode; meta?: ReactNode; tone?: "verde" | "sinal"; onMenu?: () => void; children?: ReactNode;
}) {
  return (
    <div className={cx("talao", tone)}>
      <div className="corpo">
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {meta}
          <span className="nome">{name}</span>
          {children}
        </div>
        {text && <div className="texto" style={{ marginTop: 4 }}>{text}</div>}
      </div>
      <div className="canhoto" style={{ flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 2 }}>
        <span>{typeof value === "number" ? kz(value) : value}</span>
        {onMenu && (
          <button className="icon-btn" aria-label="Mais ações" onClick={onMenu}><MoreHorizontal size={18} /></button>
        )}
      </div>
    </div>
  );
}

/** Barras a tocar (marca: "a tocar, barras em Sinal"). */
export function Wave({ n = 9, tone, still }: { n?: number; tone?: "verde"; still?: boolean }) {
  return (
    <span className={cx("wave", tone, still && "still")} aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 137) % 900}ms`, height: `${40 + ((i * 53) % 60)}%` }} />
      ))}
    </span>
  );
}

/** Medidor de voz: tamanho da mensagem como nível de som. */
export function VoiceMeter({ ratio, bars = 40 }: { ratio: number; bars?: number }) {
  const on = Math.round(Math.min(1, Math.max(0, ratio)) * bars);
  return (
    <div className="meter" aria-hidden>
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} className={i < on ? "on" : ""} style={{ height: `${30 + ((i * 37) % 70)}%` }} />
      ))}
    </div>
  );
}

export function Volume({ value, onChange, dark }: { value: number; onChange?: (v: number) => void; dark?: boolean }) {
  const n = 20;
  const on = Math.round((value / 100) * n);
  return (
    <div className="vol">
      <span className="eyebrow" style={dark ? { color: "rgba(255,255,255,.7)" } : undefined}>Vol</span>
      <div className="bars" role="slider" aria-label="Volume" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} tabIndex={0}
        onKeyDown={(e) => {
          if (!onChange) return;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(100, value + 5));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0, value - 5));
        }}>
        {Array.from({ length: n }, (_, i) => (
          <i key={i} className={i < on ? "on" : ""} onClick={() => onChange?.(Math.round(((i + 1) / n) * 100))}
            style={{ height: `${45 + (i / n) * 55}%`, cursor: onChange ? "pointer" : undefined, ...(dark && i < on ? { background: "var(--sinal)" } : dark ? { background: "rgba(255,255,255,.15)" } : {}) }} />
        ))}
      </div>
      <span className="mono" style={{ fontSize: 12 }}>{value}%</span>
    </div>
  );
}

export function Field({ label, aside, error, ok, hint, children }: {
  label: string; aside?: ReactNode; error?: string | null; ok?: boolean; hint?: ReactNode; children: ReactNode;
}) {
  return (
    <div>
      <label className={cx("field", error && "erro", ok && "ok")}>
        <span className="lbl"><span>{label}</span>{aside && <span>{aside}</span>}</span>
        {children}
      </label>
      {error ? <p className="hint erro" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

/** Código de 6 casas num só talão. */
export function CodeInput({ length = 6, onComplete, error }: { length?: number; onComplete?: (code: string) => void; error?: boolean }) {
  const [vals, setVals] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => { refs.current[0]?.focus(); }, []);
  const set = (i: number, v: string) => {
    const d = v.replace(/\D/g, "");
    if (d.length > 1) {
      const next = [...vals];
      d.slice(0, length - i).split("").forEach((c, k) => { next[i + k] = c; });
      setVals(next);
      refs.current[Math.min(length - 1, i + d.length)]?.focus();
      if (next.every(Boolean)) onComplete?.(next.join(""));
      return;
    }
    const next = [...vals]; next[i] = d; setVals(next);
    if (d && i < length - 1) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) onComplete?.(next.join(""));
  };
  return (
    <div className={cx("code", error && "erro")}>
      {vals.map((v, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={v} inputMode="numeric" aria-label={`Dígito ${i + 1}`}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => { if (e.key === "Backspace" && !vals[i] && i > 0) refs.current[i - 1]?.focus(); }} />
      ))}
    </div>
  );
}

export function Modal({ title, onClose, closable, children }: { title: string; onClose: () => void; closable?: boolean; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ alignItems: "baseline", gap: 12 }}>
          <h2>{title}</h2>
          {closable && <button className="icon-btn round" aria-label="Fechar" onClick={onClose}><X size={18} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2400);
    return () => clearTimeout(t);
  }, [msg]);
  const show = (m: string) => { setMsg(null); requestAnimationFrame(() => setMsg(m)); haptic(10); };
  const node = msg && typeof document !== "undefined"
    ? createPortal(<div className="toast" role="status"><CheckCircle2 size={18} className="toast-i" />{msg}</div>, document.body)
    : null;
  return { show, node };
}

export function Stat({ label, value, sub, tone, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "verde"; children?: ReactNode }) {
  return (
    <div className={cx("card stat", tone)}>
      <div className="eyebrow">{label}</div>
      <div className="big">{typeof value === "number" ? kz(value) : value}</div>
      {sub && <div className="sub">{sub}</div>}
      {children}
    </div>
  );
}

export function Empty({ title, icon: Icon = Inbox, children }: { title: string; icon?: LucideIcon; children?: ReactNode }) {
  return (
    <div className="vazio">
      <span className="simb" aria-hidden><Icon size={20} /></span>
      <b style={{ color: "var(--tinta)" }}>{title}</b>
      {children && <p style={{ maxWidth: 360, fontSize: 14 }}>{children}</p>}
    </div>
  );
}

export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return left;
}

export function copy(text: string) {
  haptic(10);
  const fallback = () => {
    // Sem API de clipboard (http, WebView antiga, permissão negada): copia por um campo escondido.
    try {
      const t = document.createElement("textarea");
      t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    } catch { /* nada a fazer */ }
  };
  try {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(fallback);
    else fallback();
  } catch { fallback(); }
}
