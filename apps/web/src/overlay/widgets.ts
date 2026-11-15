import qrcode from "qrcode-generator";
import { levelOf, type OverlayConfig } from "./config";
import type { Alert, OverlayState } from "./runtime";

const kz = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BRAND = `<span class="brand"><b>Fedha</b> LIVE</span>`;

/* ------------------------------------------------------------------ W1 · alerta */

/**
 * Toca um alerta seguindo as fases do AN0:
 * entrada (400–700 ms, som de entrada) → valor (contagem 600 ms) → leitura (duração do som)
 * → pausa final (1 s, super +2 s) → saída (300–500 ms, nunca antes do som acabar).
 * Se o som não carregar em 5 s, o texto fica 6 s sem som e o widget segue.
 */
export async function playAlert(host: HTMLElement, a: Alert, cfg: OverlayConfig, queueSize: number): Promise<{ played: boolean }> {
  const level = levelOf(a.amountKz, cfg);
  const minimal = cfg.scenario === "c4";
  const el = document.createElement("div");
  el.className = `w1 lvl-${level} sc-${cfg.scenario} th-${cfg.theme} sz-${cfg.size}${cfg.reduceMotion ? " reduce" : ""}`;
  el.style.setProperty("--accent", cfg.accent);
  el.style.setProperty("--enter", `${cfg.reduceMotion ? 300 : cfg.enterMs}ms`);
  el.style.setProperty("--exit", `${cfg.reduceMotion ? 300 : cfg.exitMs}ms`);
  const words = (a.text ?? "").split(/(\s+)/);
  const meta = [a.kind === "audio" ? "Áudio gravado" : a.voice ? `Voz ${a.voice === "Ngola" ? "premium" : "padrão"} · ${a.voice}` : "Texto"];
  el.innerHTML = `
    <div class="w1-head">${BRAND}
      ${level !== "normal" ? `<span class="lvl">${level === "super" ? "Super" : "Destaque"}</span>` : ""}
      ${cfg.showValue && a.showAmount && a.amountKz > 0 ? `<span class="val"><span class="n">0</span> Kz</span>` : ""}
    </div>
    <div class="w1-body">
      ${cfg.showName ? `<div class="who">${esc(a.donorName)}</div>` : ""}
      ${minimal ? "" : `<div class="meta"><span>${esc(meta.join(""))}</span>${a.priority ? `<span class="prio">Prioridade</span>` : ""}${queueSize ? `<span class="q">${queueSize} na fila</span>` : ""}${a.isTest ? `<span class="test">Alerta de teste</span>` : ""}</div>`}
      ${a.kind === "audio"
        ? `<div class="wave">${Array.from({ length: 28 }, (_, i) => `<i style="--d:${(i * 97) % 900}ms;--h:${30 + ((i * 47) % 70)}%"></i>`).join("")}<span class="t">00:00</span></div>`
        : `<div class="txt"><div class="scroll">${words.map((w, i) => (/\s+/.test(w) ? w : `<span data-i="${i}">${esc(w)}</span>`)).join("")}</div></div>`}
      <div class="bar"><i></i></div>
    </div>
    ${level === "super" && !cfg.reduceMotion && cfg.scenario !== "c3" ? `<div class="sparks">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 26}deg;--d:${(i * 53) % 300}ms"></i>`).join("")}</div>` : ""}`;
  host.appendChild(el);

  // 1 · Entrada
  await wait(20);
  el.classList.add("in");
  await wait(cfg.reduceMotion ? 300 : cfg.enterMs);

  // 2 · Valor: contagem 0 → valor final (normal: só um pulso)
  const n = el.querySelector<HTMLElement>(".val .n");
  if (n) {
    if (level === "normal" || cfg.reduceMotion) { n.textContent = kz(a.amountKz); el.classList.add("pulse"); }
    else {
      const t0 = performance.now();
      await new Promise<void>((done) => {
        const step = (t: number) => {
          const p = Math.min(1, (t - t0) / 600);
          n.textContent = kz(a.amountKz * (1 - (1 - p) ** 3));
          if (p < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
      });
    }
  }

  // 3 · Leitura: duração do som; barra, deslizar e karaoke
  const audio = new Audio(a.audioUrl);
  audio.volume = cfg.volume;
  let duration = a.durationMs;
  const loaded = await Promise.race([
    new Promise<boolean>((r) => { audio.oncanplaythrough = () => r(true); audio.onerror = () => r(false); audio.load(); }),
    wait(5000).then(() => false),
  ]);
  if (loaded) { duration = Math.round((audio.duration || a.durationMs / 1000) * 1000); void audio.play().catch(() => {}); }
  else duration = Math.max(a.durationMs, 6000);
  const bar = el.querySelector<HTMLElement>(".bar i")!;
  const spans = [...el.querySelectorAll<HTMLElement>(".txt span")];
  const scroll = el.querySelector<HTMLElement>(".scroll");
  const box = el.querySelector<HTMLElement>(".txt");
  const time = el.querySelector<HTMLElement>(".wave .t");
  el.classList.add("reading");
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      bar.style.width = `${p * 100}%`;
      if (cfg.karaoke && spans.length) {
        const k = Math.floor(p * spans.length);
        spans.forEach((s, i) => s.classList.toggle("on", i === k));
      }
      if (scroll && box && scroll.scrollHeight > box.clientHeight) {
        scroll.style.transform = `translateY(${-p * (scroll.scrollHeight - box.clientHeight)}px)`;
      }
      if (time) time.textContent = `00:${String(Math.floor((p * duration) / 1000)).padStart(2, "0")}`;
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  spans.forEach((s) => s.classList.remove("on"));

  // 4 · Pausa final
  await wait(cfg.pauseMs + (level === "super" ? 2000 : 0));

  // 5 · Saída
  el.classList.add("out");
  await wait(cfg.reduceMotion ? 300 : cfg.exitMs);
  el.remove();
  return { played: loaded };
}

/* ------------------------------------------------------------------ W2 · meta */
export function renderGoal(host: HTMLElement, s: OverlayState, cfg: OverlayConfig) {
  const g = s.goal;
  if (!g) { host.innerHTML = ""; return; }
  const pct = Math.min(100, Math.round((g.current / g.target) * 100));
  const done = pct >= 100;
  const prev = Number(host.dataset.pct ?? pct);
  host.dataset.pct = String(pct);
  const bars = Array.from({ length: 34 }, (_, i) => `<i class="${i < (pct / 100) * 34 ? "on" : ""}" style="--h:${40 + ((i * 41) % 60)}%"></i>`).join("");
  host.innerHTML = cfg.scenario === "c1"
    ? `<div class="w2 wide th-${cfg.theme}${done ? " done" : ""}"><b>${esc(g.title)}</b><span class="track"><i style="width:${pct}%"></i></span><span class="m">${kz(g.current)} / ${kz(g.target)} Kz</span><span class="pct">${pct}%</span></div>`
    : `<div class="w2 card th-${cfg.theme}${done ? " done" : ""}"><div class="top"><small>Meta</small><span class="pct">${pct}%</span></div><b>${esc(g.title)}</b><div class="m"><span class="big">${kz(g.current)}</span> / ${kz(g.target)} Kz</div><div class="bars">${bars}</div></div>`;
  if (pct > prev && !cfg.reduceMotion) host.firstElementChild?.classList.add("bump");
  if (done && prev < 100 && !cfg.reduceMotion) host.firstElementChild?.classList.add("celebrate");
}

/* ------------------------------------------------------------------ W3 · ranking */
export function renderRanking(host: HTMLElement, s: OverlayState, cfg: OverlayConfig) {
  const n = cfg.scenario === "c1" ? 5 : 3;
  const rows = s.ranking.slice(0, n);
  if (!rows.length) { host.innerHTML = ""; return; }
  const leader = rows[0]!.name;
  const newLeader = host.dataset.leader && host.dataset.leader !== leader;
  host.dataset.leader = leader;
  host.innerHTML = `<div class="w3 th-${cfg.theme}${newLeader && !cfg.reduceMotion ? " swap" : ""}"><small>Top ${n} · esta live</small>${rows
    .map((r, i) => `<div class="r${i === 0 ? " first" : ""}"><span class="i">${i + 1}</span><span class="n">${esc(r.name)}</span><span class="v">${kz(r.kz)} Kz</span></div>`)
    .join("")}</div>`;
}

/* ------------------------------------------------------------------ W4 · últimas mensagens */
export function renderLatest(host: HTMLElement, s: OverlayState, cfg: OverlayConfig) {
  if (!s.latest.length) { host.innerHTML = ""; return; }
  if (cfg.scenario === "c1") {
    host.innerHTML = `<div class="w4 list th-${cfg.theme}">${s.latest
      .slice(0, 5)
      .map((m, i) => `<div class="row${i === 0 && !cfg.reduceMotion ? " fresh" : ""}"><div class="t"><b>${esc(m.name)}</b><span>${esc(m.text)}</span></div><span class="v">${kz(m.kz)}</span></div>`)
      .join("")}</div>`;
  } else {
    const items = s.latest.map((m) => `<span class="it"><b>${esc(m.name)}</b> <em>${kz(m.kz)} Kz</em> ${esc(m.text)}</span>`).join("");
    host.innerHTML = `<div class="w4 ticker th-${cfg.theme}"><span class="lab">Últimas</span><div class="belt"><div class="move${cfg.reduceMotion ? " still" : ""}">${items}${items}</div></div></div>`;
  }
}

/* ------------------------------------------------------------------ W5 · QR code */
export function renderQr(host: HTMLElement, cfg: OverlayConfig) {
  // TikTok e Instagram não permitem QR codes nem links no ecrã: o W5 fica vazio (transparente).
  if (cfg.destination === "tiktok" || cfg.destination === "instagram") {
    host.innerHTML = cfg.preview ? `<div class="w5 off">W5 desligado · ${cfg.destination === "tiktok" ? "TikTok" : "Instagram"} não permite QR no ecrã</div>` : "";
    return;
  }
  const url = `https://fedha.live/${cfg.handle}`;
  const qr = qrcode(0, "M");
  qr.addData(url);
  qr.make();
  host.innerHTML = `<div class="w5 th-${cfg.theme}${cfg.reduceMotion ? "" : " pulse"}"><div class="hd">${BRAND}</div><div class="qr" role="img" aria-label="QR para ${esc(url)}">${qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true })}</div><b>${esc(cfg.qrCall)}</b><small>fedha.live/${esc(cfg.handle)}</small></div>`;
}
