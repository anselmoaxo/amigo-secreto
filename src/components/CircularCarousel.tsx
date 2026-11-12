"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

export type CarouselItem = { src: string; alt: string; title?: string; subtitle?: string };

type Props = {
  items: CarouselItem[];
  /** Por enquanto só existe o cilindro. */
  preset?: "cylinder";
  /** Animação de entrada: os cartões sobem um a um. */
  intro?: "rise" | "none";
  /** Largura máxima do cartão, em px. Em telas estreitas ele encolhe. */
  cardWidth?: number;
  /** Largura ÷ altura do cartão. */
  aspectRatio?: number;
  /** Velocidade do giro automático, em graus por segundo. */
  speed?: number;
  captions?: boolean;
  /** Espaço entre os cartões, em px. */
  gap?: number;
  /** Inclinação do anel, em graus. */
  tilt?: number;
  /** 1 = cartões acompanham a curva do cilindro; 0 = cartões sempre de frente. */
  curve?: number;
  perspective?: number;
  /** "drift" gira sem parar; "step" avança um cartão a cada `interval` segundos. */
  autoplay?: "drift" | "step" | false;
  interval?: number;
  direction?: "left" | "right";
  /** Quanto do impulso do arraste continua depois de soltar (0 a 1). */
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  draggable?: boolean;
  /** Deslocamento da imagem dentro do cartão conforme ele gira (0 a 1). */
  parallax?: number;
  /** Alarga os cartões das laterais para compensar o encurtamento (0 a 1). */
  stretch?: number;
  /** Cor que "apaga" os cartões do fundo. Use a cor de fundo da página. */
  fadeColor?: string;
  depthFade?: number;
  /** Sombra no verso dos cartões que estão de costas (0 a 1). */
  innerShade?: number;
  cornerRadius?: number;
  /** Nome do carrossel para leitores de tela. */
  label?: string;
  className?: string;
};

const mod = (n: number, m: number) => ((n % m) + m) % m;

export default function CircularCarousel({
  items,
  intro = "rise",
  cardWidth = 220,
  aspectRatio = 1,
  speed = 14,
  captions = false,
  gap = 25,
  tilt = -5,
  curve = 1,
  perspective = 2500,
  autoplay = "drift",
  interval = 3,
  direction = "left",
  momentum = 0.6,
  snap = true,
  pauseOnHover = true,
  focusOnClick = true,
  draggable = true,
  parallax = 0.3,
  stretch = 0.5,
  fadeColor = "#000000",
  depthFade = 0.55,
  innerShade = 0.6,
  cornerRadius = 12,
  label = "Carrossel de imagens",
  className = "",
}: Props) {
  const n = items.length;
  const step = 360 / n;
  const dirSign = direction === "left" ? -1 : 1;

  const rootRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [width, setWidth] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [paused, setPaused] = useState(false);
  const [front, setFront] = useState(0);

  // Estado da animação fica em refs para não renderizar o React a cada quadro.
  const s = useRef({
    rot: 0,
    vel: 0,
    target: null as number | null,
    hover: false,
    drag: null as null | { x: number; rot: number; lastX: number; lastT: number; moved: number },
    resumeAt: 0,
    nextStepAt: 0,
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const upd = () => setReduced(mq.matches);
    upd();
    mq.addEventListener("change", upd);
    return () => mq.removeEventListener("change", upd);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cartão encolhe em telas estreitas para o anel não ficar enorme.
  const k = n / (2 * Math.PI);
  const fit = width ? (1.5 * width - 2 * k * gap) / (2 * k + 1) : cardWidth;
  const w = Math.round(Math.max(110, Math.min(cardWidth, fit)));
  const h = Math.round(w / aspectRatio);
  const radius = (n * (w + gap)) / (2 * Math.PI);
  const degPerPx = 360 / (n * (w + gap));

  const autoOn = !!autoplay && !reduced && !paused;

  const render = useCallback(() => {
    const { rot } = s.current;
    let best = 0;
    let bestCos = -2;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const a = ((i * step + rot) * Math.PI) / 180;
      const sin = Math.sin(a);
      const cos = Math.cos(a);
      if (cos > bestCos) { bestCos = cos; best = i; }
      const x = radius * sin;
      const z = radius * cos - radius;
      const rotY = (a * 180) / Math.PI * curve;
      const sx = 1 + stretch * 0.3 * (1 - Math.abs(cos));
      card.style.transform = `translate3d(${x.toFixed(2)}px,0,${z.toFixed(2)}px) rotateY(${rotY.toFixed(2)}deg) scaleX(${sx.toFixed(3)})`;
      card.style.setProperty("--fade", (depthFade * (1 - cos) / 2).toFixed(3));
      card.style.setProperty("--shade", (innerShade * 0.45 * Math.max(0, -cos)).toFixed(3));
      card.style.setProperty("--px", `${(-sin * parallax * w * 0.25).toFixed(2)}px`);
    });
    setFront((f) => (f === best ? f : best));
  }, [step, radius, curve, stretch, depthFade, innerShade, parallax, w]);

  // Laço de animação.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    s.current.nextStepAt = last + interval * 1000;
    const tick = (now: number) => {
      const st = s.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!st.drag) {
        if (Math.abs(st.vel) > 0.5) {
          st.rot += st.vel * dt;
          st.vel *= Math.pow(0.04, dt); // atrito
          if (Math.abs(st.vel) <= 0.5 && snap) st.target = Math.round(st.rot / step) * step;
        } else if (st.target !== null) {
          const d = st.target - st.rot;
          if (reduced || Math.abs(d) < 0.05) { st.rot = st.target; st.target = null; }
          else st.rot += d * Math.min(1, dt * 7);
        } else if (autoOn && !(pauseOnHover && st.hover) && now >= st.resumeAt) {
          if (autoplay === "drift") st.rot += dirSign * speed * dt;
          else if (now >= st.nextStepAt) {
            st.target = Math.round(st.rot / step) * step + dirSign * step;
            st.nextStepAt = now + interval * 1000;
          }
        }
      }
      render();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [render, autoOn, autoplay, dirSign, speed, interval, pauseOnHover, snap, step, reduced]);

  const goTo = (rotTarget: number) => {
    const st = s.current;
    st.vel = 0;
    st.target = rotTarget;
    st.resumeAt = performance.now() + interval * 1000 * 2;
  };
  const nearest = () => Math.round(s.current.rot / step) * step;
  // Quem navega pelos botões ou teclado assume o controle: o giro automático para.
  const move = (d: 1 | -1) => { setPaused(true); goTo((s.current.target ?? nearest()) - d * step); };
  const focusCard = (i: number) => {
    const cur = i * step + s.current.rot;
    const delta = mod(cur + 180, 360) - 180; // caminho mais curto até a frente
    goTo(s.current.rot - delta);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!draggable || e.button !== 0) return;
    const st = s.current;
    st.drag = { x: e.clientX, rot: st.rot, lastX: e.clientX, lastT: performance.now(), moved: 0 };
    st.vel = 0;
    st.target = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = s.current.drag;
    if (!d) return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    const dtt = Math.max(1, now - d.lastT) / 1000;
    s.current.vel = (dx * degPerPx) / dtt;
    d.lastX = e.clientX;
    d.lastT = now;
    d.moved = Math.max(d.moved, Math.abs(e.clientX - d.x));
    s.current.rot = d.rot + (e.clientX - d.x) * degPerPx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const st = s.current;
    const d = st.drag;
    if (!d) return;
    st.drag = null;
    st.resumeAt = performance.now() + interval * 1000 * 2;
    if (d.moved < 6) {
      st.vel = 0;
      if (focusOnClick) {
        const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-i]");
        if (el) focusCard(Number(el.dataset.i));
      }
      return;
    }
    st.vel = reduced ? 0 : st.vel * momentum;
    if (Math.abs(st.vel) <= 0.5 && snap) st.target = Math.round(st.rot / step) * step;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { e.preventDefault(); move(1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); move(-1); }
  };

  const current = items[front];
  const style = { "--fade-color": fadeColor } as CSSProperties;

  return (
    <div
      ref={rootRef}
      role="region"
      aria-roledescription="carrossel"
      aria-label={label}
      className={`cc-root relative flex h-full w-full flex-col ${className}`}
      style={style}
      onPointerEnter={() => { s.current.hover = true; }}
      onPointerLeave={() => { s.current.hover = false; }}
      onFocus={() => { s.current.hover = true; }}
      onBlur={() => { s.current.hover = false; }}
    >
      <div
        className={`cc-stage relative min-h-0 flex-1 overflow-hidden ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
        style={{ perspective: `${perspective}px`, touchAction: draggable ? "pan-y" : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        tabIndex={0}
        onKeyDown={onKeyDown}
        aria-label={`${label}. Use as setas do teclado para girar.`}
      >
        <div
          className="absolute left-1/2 top-1/2"
          style={{ transformStyle: "preserve-3d", transform: `translateZ(${-radius * 0.15}px) rotateX(${tilt}deg)` }}
        >
          {items.map((it, i) => (
            <div
              key={it.src}
              ref={(el) => { cardRefs.current[i] = el; }}
              data-i={i}
              className="cc-card absolute"
              style={{ width: w, height: h, left: -w / 2, top: -h / 2, transformStyle: "preserve-3d" }}
              aria-hidden={i !== front}
            >
              <div
                className={`absolute inset-0 ${intro === "rise" && !reduced ? "cc-rise" : ""}`}
                style={{ transformStyle: "preserve-3d", animationDelay: `${i * 70}ms` }}
              >
                <div className="cc-face" style={{ borderRadius: cornerRadius, animationDelay: `${i * 70}ms` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt={it.alt} draggable={false} loading="lazy" className="cc-img" />
                  {captions && (it.title || it.subtitle) && (
                    <div className="cc-caption">
                      {it.subtitle && <span className="block text-xs opacity-80">{it.subtitle}</span>}
                      {it.title && <span className="block font-bold">{it.title}</span>}
                    </div>
                  )}
                  <div className="cc-fade" />
                </div>
                <div className="cc-back" style={{ borderRadius: cornerRadius, animationDelay: `${i * 70}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(-1)} aria-label="Anterior">
          <span aria-hidden>←</span>
        </button>
        {autoplay && !reduced && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setPaused((p) => !p)}
            aria-pressed={paused}
          >
            {paused ? "Girar" : "Pausar"}
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(1)} aria-label="Próxima">
          <span aria-hidden>→</span>
        </button>
      </div>
      <p className="sr-only" aria-live={autoOn ? "off" : "polite"} aria-atomic>
        {current && `${front + 1} de ${n}: ${current.title ?? current.alt}`}
      </p>
    </div>
  );
}
