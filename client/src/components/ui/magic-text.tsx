import { useRef, useEffect, useMemo, useState, type CSSProperties } from 'react';

interface Particle {
  x: number;
  y: number;
  originalX: number;
  originalY: number;
  /** Скорость разлёта (px/s) — устанавливается при переходе revealed=true. */
  vx: number;
  vy: number;
  color: string;
  opacity: number;
  originalAlpha: number;
  floatingSpeed: number;
  floatingAngle: number;
  targetOpacity: number;
  sparkleSpeed: number;
}

type MagicTextProps = {
  text: string;
  /** Когда true — частицы разлетаются и фейдят, появляется нативный DOM-текст.
   *  Когда false — DOM-текст скрыт, частицы парят в форме слова. */
  revealed: boolean;
  /** CSS font-size в пикселях. Должен совпадать с окружающей версткой. */
  fontSize: number;
  /** CSS font-weight (300-900). */
  fontWeight?: number;
  /** CSS font-family. По умолчанию — Inter. */
  fontFamily?: string;
  /** Цвет текста (rgba/hex/var(...)). По умолчанию — белый. */
  color?: string;
  /** Радиус блюра-парения (px). На мобильных автоматически уменьшается. */
  spread?: number;
  /** Скорость анимации парения. */
  speed?: number;
  /** Плотность частиц 1-5 (выше = чаще). На мобиле уменьшается. */
  density?: number;
  className?: string;
  style?: CSSProperties;
};

const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 768 || /Mobi|Android|iPhone/i.test(navigator.userAgent);
};

/**
 * Эффект «магических частиц».
 *
 * Архитектура: DOM-span с настоящим текстом + canvas с частицами под ним.
 * - revealed=false: DOM-текст opacity:0, частицы парят в форме слова.
 * - revealed=true: DOM-текст плавно opacity:1, частицы разлетаются наружу
 *   с initial velocity и фейдят. Через ~600мс canvas пустой, виден только
 *   нативный текст.
 *
 * Используется на L2 (русские переводы) и L3 (англ. слово) для скрытия ответа
 * до взаимодействия. См. [[quiz-tier-exercise-mapping]] в memory.
 */
export function MagicText({
  text,
  revealed,
  fontSize,
  fontWeight = 600,
  fontFamily = 'Inter, sans-serif',
  color = 'rgba(255, 255, 255, 1)',
  spread = 30,
  speed = 0.5,
  density = 3,
  className = '',
  style = {},
}: MagicTextProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const isVisibleRef = useRef<boolean>(true);
  const revealedRef = useRef<boolean>(revealed);
  /** Кадр, в котором революция произошла — для триггера «разлёт». */
  const revealAtRef = useRef<number>(0);

  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  // Адаптив: на мобиле меньше пикселей и меньше плотность.
  const mobile = useMemo(() => isMobile(), []);
  const dpr = useMemo(() => {
    if (typeof window === 'undefined') return 1;
    return Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1);
  }, [mobile]);
  const effectiveDensity = mobile ? Math.min(density, 4) : density;
  const effectiveSpread = mobile ? spread * 0.7 : spread;
  const sampleRate = Math.max(1, 5 - effectiveDensity);

  // Триггер разлёта при переходе revealed false→true.
  useEffect(() => {
    revealedRef.current = revealed;
    if (revealed) {
      revealAtRef.current = performance.now();
      // Задаём каждой частице вектор разлёта от originalX/Y наружу.
      for (const p of particlesRef.current) {
        const dx = p.x - p.originalX;
        const dy = p.y - p.originalY;
        const d = Math.sqrt(dx * dx + dy * dy);
        // Если частица уже разлетелась — продолжим её направление.
        // Иначе — случайный outward вектор от центра.
        if (d > 0.5) {
          p.vx = (dx / d) * 300;
          p.vy = (dy / d) * 300;
        } else {
          const angle = Math.random() * Math.PI * 2;
          p.vx = Math.cos(angle) * 300;
          p.vy = Math.sin(angle) * 300;
        }
      }
    }
  }, [revealed]);

  // ResizeObserver: подстраиваем canvas под фактический размер текста.
  useEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const ro = new ResizeObserver(() => {
      const rect = measure.getBoundingClientRect();
      setSize({ w: Math.ceil(rect.width), h: Math.ceil(rect.height) });
    });
    ro.observe(measure);
    return () => ro.disconnect();
  }, [text, fontSize, fontWeight, fontFamily]);

  // Создание частиц при изменении размера / текста.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;

    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Рисуем текст на canvas в реальном размере. wrap руками.
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color;
    ctx.font = `${fontWeight} ${fontSize * dpr}px ${fontFamily}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = true;

    const lines = wrapText(ctx, text, canvas.width);
    const lineHeightPx = fontSize * 1.25 * dpr;
    lines.forEach((line, i) => ctx.fillText(line, 0, i * lineHeightPx));

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const particles: Particle[] = [];
    const step = sampleRate * dpr;
    const startRevealed = revealedRef.current;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha < 32) continue;
        const originalAlpha = alpha / 255;
        // Если revealed уже true при создании — частицы появятся уже распылёнными
        // и сразу начнут фейдить. Иначе — парят в форме слова.
        let startX = x;
        let startY = y;
        if (!startRevealed) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * effectiveSpread * dpr;
          startX = x + Math.cos(angle) * dist;
          startY = y + Math.sin(angle) * dist;
        }
        particles.push({
          x: startX,
          y: startY,
          originalX: x,
          originalY: y,
          vx: 0,
          vy: 0,
          color: `rgba(${data[idx]}, ${data[idx + 1]}, ${data[idx + 2]}, ${originalAlpha})`,
          // Если revealed=true сразу — стартовая opacity=0, чтобы не мелькать.
          opacity: startRevealed ? 0 : originalAlpha * (0.6 + Math.random() * 0.4),
          originalAlpha,
          floatingSpeed: Math.random() * 2 + 1,
          floatingAngle: Math.random() * Math.PI * 2,
          targetOpacity: (0.5 + Math.random() * 0.5) * originalAlpha,
          sparkleSpeed: Math.random() * 2 + 1,
        });
      }
    }
    particlesRef.current = particles;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [size, color, fontSize, fontWeight, fontFamily, text, sampleRate, dpr, effectiveSpread]);

  // Пауза при невидимой вкладке.
  useEffect(() => {
    const handler = () => { isVisibleRef.current = !document.hidden; };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Анимация.
  useEffect(() => {
    const animate = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx || !particlesRef.current.length || !isVisibleRef.current) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      updateParticles(
        particlesRef.current,
        dt,
        revealedRef.current,
        effectiveSpread * dpr,
        speed,
      );
      renderParticles(ctx, particlesRef.current, dpr);
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [effectiveSpread, dpr, speed]);

  return (
    <div
      ref={wrapperRef}
      className={`relative block ${className}`}
      style={{
        width: '100%',
        height: size.h || 'auto',
        ...style,
      }}
    >
      {/* Невидимый span для измерения настоящего размера текста.
          width:100% — иначе во flex-родителе ширина схлопывается до min-content
          и текст переносится посимвольно. */}
      <span
        ref={measureRef}
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          fontSize: `${fontSize}px`,
          fontWeight,
          fontFamily,
          lineHeight: 1.25,
          whiteSpace: 'pre-wrap',
          wordBreak: 'normal',
          overflowWrap: 'break-word',
          visibility: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {text}
      </span>
      {/* Canvas с частицами — слой 1. */}
      <canvas
        ref={canvasRef}
        aria-hidden
        className="absolute left-0 top-0"
        style={{ zIndex: 1 }}
      />
      {/* Настоящий DOM-текст — слой 2 (поверх частиц). Появляется когда revealed=true. */}
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          fontSize: `${fontSize}px`,
          fontWeight,
          fontFamily,
          lineHeight: 1.25,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color,
          opacity: revealed ? 1 : 0,
          transition: 'opacity 350ms ease-out',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {text}
      </span>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function updateParticles(
  particles: Particle[],
  dt: number,
  revealed: boolean,
  spread: number,
  speed: number,
) {
  const FLOAT_RADIUS = spread;
  const FLOAT_SPEED = speed;
  const TRANSITION_SPEED = 5 * FLOAT_SPEED;
  const NOISE_SCALE = 0.6;
  const CHAOS = 1.3;
  // Скорость затухания при разлёте — за ~600мс частица должна почти исчезнуть.
  const DISPERSE_FADE_PER_S = 2.5;
  // Замедление вектора разлёта (drag) — частицы летят чуть с замедлением.
  const VELOCITY_DAMPING = 0.92;
  const now = Date.now() * 0.001;

  for (const p of particles) {
    if (revealed) {
      // Разлёт: движемся по v, фейдим, drag.
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= VELOCITY_DAMPING;
      p.vy *= VELOCITY_DAMPING;
      p.opacity = Math.max(0, p.opacity - DISPERSE_FADE_PER_S * dt);
    } else {
      // Парение в форме слова.
      p.floatingAngle += dt * p.floatingSpeed * (1 + Math.random() * CHAOS);
      const uniq = p.floatingSpeed * 2000;
      const nx = (
        Math.sin(now * p.floatingSpeed + p.floatingAngle) * 1.2 +
        Math.sin((now + uniq) * 0.5) * 0.8 +
        (Math.random() - 0.5) * CHAOS
      ) * NOISE_SCALE;
      const ny = (
        Math.cos(now * p.floatingSpeed + p.floatingAngle * 1.5) * 0.6 +
        Math.cos((now + uniq) * 0.5) * 0.4 +
        (Math.random() - 0.5) * CHAOS
      ) * NOISE_SCALE;
      const targetX = p.originalX + FLOAT_RADIUS * nx;
      const targetY = p.originalY + FLOAT_RADIUS * ny;
      const dx = targetX - p.x;
      const dy = targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const jitterK = Math.min(1, dist / (FLOAT_RADIUS * 1.5));
      p.x += dx * TRANSITION_SPEED * dt + (Math.random() - 0.5) * FLOAT_SPEED * jitterK;
      p.y += dy * TRANSITION_SPEED * dt + (Math.random() - 0.5) * FLOAT_SPEED * jitterK;

      const ddx = p.x - p.originalX;
      const ddy = p.y - p.originalY;
      const dfo = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dfo > FLOAT_RADIUS) {
        const a = Math.atan2(ddy, ddx);
        const pull = (dfo - FLOAT_RADIUS) * 0.1;
        p.x -= Math.cos(a) * pull;
        p.y -= Math.sin(a) * pull;
      }

      const oDiff = p.targetOpacity - p.opacity;
      p.opacity += oDiff * p.sparkleSpeed * dt * 3;
      if (Math.abs(oDiff) < 0.01) {
        p.targetOpacity = (0.4 + Math.random() * 0.6) * p.originalAlpha;
        p.sparkleSpeed = Math.random() * 3 + 1;
      }
    }
  }
}

function renderParticles(ctx: CanvasRenderingContext2D, particles: Particle[], dpr: number) {
  const size = Math.max(1, Math.round(dpr));
  const byColor = new Map<string, Array<{ x: number; y: number }>>();
  for (const p of particles) {
    if (p.opacity <= 0.02) continue;
    const c = p.color.replace(/[\d.]+\)$/, `${Math.max(0, Math.min(1, p.opacity))})`);
    if (!byColor.has(c)) byColor.set(c, []);
    byColor.get(c)!.push({ x: p.x, y: p.y });
  }
  byColor.forEach((points, c) => {
    ctx.fillStyle = c;
    for (const pt of points) ctx.fillRect(pt.x, pt.y, size, size);
  });
}
