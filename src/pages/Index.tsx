import { useState, useCallback, useEffect, useRef } from 'react';
import SwarmGlobe, { type SwarmStats } from '@/components/SwarmGlobe';
import Icon from '@/components/ui/icon';

// ─── Константы ───────────────────────────────────────────────────────────────
const ACCENT   = '#00FF88';
const BG       = '#0A0A1A';
const CARD_BOR = 'rgba(0,255,136,0.3)';

// ─── Стиль-хелперы ───────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'rgba(0,255,136,0.04)',
  border: `1px solid ${CARD_BOR}`,
  borderRadius: 16,
};

const accentText: React.CSSProperties = { color: ACCENT };
const dimText: React.CSSProperties   = { color: 'rgba(255,255,255,0.55)' };

// ─── Анимированный счётчик ───────────────────────────────────────────────────
function Counter({ end, prefix = '', suffix = '', decimals = 0 }: {
  end: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const dur = 1800;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setVal(ease * end);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.2 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [end]);

  return (
    <span ref={ref}>
      {prefix}{val.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── Видео-модалка: анимированный синематик ───────────────────────────────────
const SCENES = [
  {
    id: 0, from: 0, to: 10,
    title: 'ПРОБЛЕМА',
    color: '#FF4444',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(255,68,68,0.18) 0%, #040410 70%)',
  },
  {
    id: 1, from: 10, to: 25,
    title: 'ВХОД В MOST',
    color: '#00FF88',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(0,255,136,0.12) 0%, #040410 70%)',
  },
  {
    id: 2, from: 25, to: 45,
    title: 'ИИ-ОРКЕСТРАТОР',
    color: '#4D9FFF',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(77,159,255,0.15) 0%, #040410 70%)',
  },
  {
    id: 3, from: 45, to: 80,
    title: 'ЗАПУСК РОЯ',
    color: '#FFAA00',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(255,170,0,0.14) 0%, #040410 70%)',
  },
  {
    id: 4, from: 80, to: 100,
    title: 'РЕЗУЛЬТАТ',
    color: '#00FF88',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(0,255,136,0.1) 0%, #040410 70%)',
  },
  {
    id: 5, from: 100, to: 115,
    title: 'ФИНАЛ',
    color: '#00FF88',
    bg: '#040410',
  },
];

// Глобус с частицами на Canvas
function GlobeCanvas({ phase }: { phase: 'problem' | 'swarm' | 'result' }) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const t   = useRef(0);

  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width = c.offsetWidth * devicePixelRatio;
    const H = c.height = c.offsetHeight * devicePixelRatio;
    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.35;

    // Частицы
    type P = { lat: number; lon: number; speed: number; color: string; size: number; progress: number; trail: {x:number;y:number}[] };
    const particles: P[] = [];

    const COLORS = ['#00FF88','#4D9FFF','#FFAA00','#FF4444','#A855F7','#F3BA2F'];
    if (phase === 'swarm') {
      for (let i = 0; i < 120; i++) {
        particles.push({
          lat: (Math.random() - 0.5) * Math.PI,
          lon: Math.random() * Math.PI * 2,
          speed: 0.003 + Math.random() * 0.006,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          size: 1 + Math.random() * 2,
          progress: Math.random(),
          trail: [],
        });
      }
    }

    // Проекция сферы → 2D
    function project(lat: number, lon: number, spin: number): [number, number, number] {
      const s = spin;
      const x = Math.cos(lat) * Math.sin(lon + s);
      const y = Math.sin(lat);
      const z = Math.cos(lat) * Math.cos(lon + s);
      return [cx + x * R, cy - y * R, z];
    }

    const spin = { v: 0 };

    function draw() {
      t.current += 0.016;
      spin.v += 0.004;

      ctx.clearRect(0, 0, W, H);

      // Глобус — wireframe
      ctx.lineWidth = 0.6;
      const gridAlpha = 0.15;
      // Широты
      for (let lat = -75; lat <= 75; lat += 15) {
        const r = (lat * Math.PI) / 180;
        ctx.beginPath();
        let first = true;
        for (let lo = 0; lo <= 360; lo += 4) {
          const [px, py, z] = project(r, (lo * Math.PI) / 180, spin.v);
          if (z < 0) { first = true; continue; }
          if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(0,255,136,${gridAlpha})`;
        ctx.stroke();
      }
      // Меридианы
      for (let lo = 0; lo < 360; lo += 15) {
        const r = (lo * Math.PI) / 180;
        ctx.beginPath();
        let first = true;
        for (let la = -90; la <= 90; la += 3) {
          const [px, py, z] = project((la * Math.PI) / 180, r, spin.v);
          if (z < 0) { first = true; continue; }
          if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(0,255,136,${gridAlpha})`;
        ctx.stroke();
      }

      // Проблема — красная линия Москва → Стамбул
      if (phase === 'problem') {
        const moscow = project(55.75 * Math.PI / 180, 37.62 * Math.PI / 180, spin.v);
        const istanbul = project(41.01 * Math.PI / 180, 28.97 * Math.PI / 180, spin.v);
        if (moscow[2] > 0 && istanbul[2] > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t.current * 4);
          ctx.beginPath();
          ctx.moveTo(moscow[0], moscow[1]);
          ctx.lineTo(istanbul[0], istanbul[1]);
          ctx.strokeStyle = `rgba(255,68,68,${0.6 + pulse * 0.4})`;
          ctx.lineWidth = 3;
          ctx.stroke();
          // Узлы
          [[moscow], [istanbul]].forEach(([[px, py]]) => {
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,68,68,${0.7 + pulse * 0.3})`;
            ctx.fill();
          });
          // X-метка
          const mx = (moscow[0] + istanbul[0]) / 2;
          const my = (moscow[1] + istanbul[1]) / 2;
          ctx.font = `bold ${16 * devicePixelRatio}px monospace`;
          ctx.fillStyle = `rgba(255,68,68,${0.8 + pulse * 0.2})`;
          ctx.textAlign = 'center';
          ctx.fillText('❌ BLOCKED', mx, my - 14 * devicePixelRatio);
        }
      }

      // Рой — частицы
      if (phase === 'swarm') {
        particles.forEach(p => {
          p.progress += p.speed;
          if (p.progress > 1) p.progress = 0;

          // Дуга от Москвы к случайной точке, потом в Стамбул
          const srcLat = 55.75 * Math.PI / 180;
          const srcLon = 37.62 * Math.PI / 180;
          const dstLat = 41.01 * Math.PI / 180;
          const dstLon = 28.97 * Math.PI / 180;

          // Промежуточная точка
          const midLat = p.lat;
          const midLon = p.lon;

          let cLat, cLon;
          if (p.progress < 0.5) {
            const q = p.progress * 2;
            cLat = srcLat * (1 - q) + midLat * q;
            cLon = srcLon * (1 - q) + midLon * q;
          } else {
            const q = (p.progress - 0.5) * 2;
            cLat = midLat * (1 - q) + dstLat * q;
            cLon = midLon * (1 - q) + dstLon * q;
          }

          const [px, py, z] = project(cLat, cLon, spin.v);
          if (z < 0) return;

          const glow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 4);
          glow.addColorStop(0, p.color + 'ff');
          glow.addColorStop(1, p.color + '00');
          ctx.beginPath();
          ctx.arc(px, py, p.size * 2.5, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        });

        // Финальная вспышка в Стамбуле
        const [ix, iy, iz] = project(41.01 * Math.PI / 180, 28.97 * Math.PI / 180, spin.v);
        if (iz > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t.current * 3);
          const grad = ctx.createRadialGradient(ix, iy, 0, ix, iy, 40 + pulse * 20);
          grad.addColorStop(0, `rgba(0,255,136,${0.6 + pulse * 0.3})`);
          grad.addColorStop(1, 'rgba(0,255,136,0)');
          ctx.beginPath();
          ctx.arc(ix, iy, 40 + pulse * 20, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }

      // Результат — зелёная линия с обеих сторон + сетка
      if (phase === 'result') {
        const moscow = project(55.75 * Math.PI / 180, 37.62 * Math.PI / 180, spin.v);
        const istanbul = project(41.01 * Math.PI / 180, 28.97 * Math.PI / 180, spin.v);
        if (moscow[2] > 0 && istanbul[2] > 0) {
          const pulse = 0.5 + 0.5 * Math.sin(t.current * 2);
          ctx.beginPath();
          ctx.moveTo(moscow[0], moscow[1]);
          ctx.lineTo(istanbul[0], istanbul[1]);
          ctx.strokeStyle = `rgba(0,255,136,${0.8 + pulse * 0.2})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([8 * devicePixelRatio, 4 * devicePixelRatio]);
          ctx.stroke();
          ctx.setLineDash([]);
          [[moscow], [istanbul]].forEach(([[px, py]]) => {
            const g = ctx.createRadialGradient(px, py, 0, px, py, 18);
            g.addColorStop(0, `rgba(0,255,136,${0.7 + pulse * 0.3})`);
            g.addColorStop(1, 'rgba(0,255,136,0)');
            ctx.beginPath(); ctx.arc(px, py, 18, 0, Math.PI * 2);
            ctx.fillStyle = g; ctx.fill();
            ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#00FF88'; ctx.fill();
          });
        }
      }

      raf.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  return (
    <canvas ref={cvs} style={{ width: '100%', height: '100%', display: 'block' }} />
  );
}

// Нейросеть-визуализация для сцены оркестратора
function NeuralCanvas() {
  const cvs = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const t   = useRef(0);

  useEffect(() => {
    const c = cvs.current; if (!c) return;
    const W = c.width = c.offsetWidth * devicePixelRatio;
    const H = c.height = c.offsetHeight * devicePixelRatio;

    type Node = { x: number; y: number; r: number; color: string; pulse: number };
    const nodes: Node[] = [];
    const edges: [number, number][] = [];

    // Центральный узел
    nodes.push({ x: W/2, y: H/2, r: 16, color: '#4D9FFF', pulse: 0 });
    // Внешние
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const dist = 80 + Math.random() * 80;
      nodes.push({
        x: W/2 + Math.cos(angle) * dist * devicePixelRatio,
        y: H/2 + Math.sin(angle) * dist * devicePixelRatio,
        r: 4 + Math.random() * 6,
        color: ['#4D9FFF','#00FF88','#FFAA00','#A855F7'][Math.floor(Math.random() * 4)],
        pulse: Math.random() * Math.PI * 2,
      });
      edges.push([0, i + 1]);
      if (i > 0 && Math.random() > 0.5) edges.push([i, i + 1]);
    }

    function draw() {
      t.current += 0.02;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      // Рёбра
      edges.forEach(([a, b]) => {
        const pulse = 0.3 + 0.4 * Math.sin(t.current * 2 + nodes[a].pulse);
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.strokeStyle = `rgba(77,159,255,${pulse * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Сигнал по ребру
        const sp = (t.current * 0.8 + nodes[a].pulse) % 1;
        const sx = nodes[a].x + (nodes[b].x - nodes[a].x) * sp;
        const sy = nodes[a].y + (nodes[b].y - nodes[a].y) * sp;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(77,159,255,${pulse})`;
        ctx.fill();
      });

      // Узлы
      nodes.forEach((n, i) => {
        const glow = 0.5 + 0.5 * Math.sin(t.current * 2 + n.pulse);
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 3);
        grad.addColorStop(0, n.color + 'aa');
        grad.addColorStop(1, n.color + '00');
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * (0.8 + glow * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = n.color; ctx.fill();
        if (i === 0) {
          ctx.font = `bold ${10 * devicePixelRatio}px monospace`;
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.fillText('AI', n.x, n.y + 4 * devicePixelRatio);
        }
      });

      raf.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, []);

  return <canvas ref={cvs} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

function VideoModal({ onClose }: { onClose: () => void }) {
  const TOTAL_SEC = 115;
  const [playing,  setPlaying]  = useState(false);
  const [elapsed,  setElapsed]  = useState(0);
  const [scene,    setScene]    = useState(0);
  const [subtitleVisible, setSubtitleVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SUBTITLES = [
    'Прямой перевод USDT из России в Турцию. Заблокирован. Tether выполняет санкции. Бизнес теряет миллиарды каждый месяц.',
    'Экспортёр из России заходит в MOST. Одна простая форма. Он просто нажимает «Отправить».',
    'ИИ-оркестратор MOST мгновенно просчитывает 1 247 возможных маршрутов. Прямой перевод? Заблокирован. Запускается РОЙ.',
    'Один миллион долларов разбивается на 5 000 микротранзакций. Каждый бот проходит уникальный маршрут: фьючерсы, токенизированное золото, дирхам ОАЭ.',
    'Chainalysis видит белый шум. Тысячи несвязанных операций. Низкий риск. Никаких флагов. А регулятор MOST видит всё.',
    'Турецкий поставщик видит обычное пополнение. Один миллион долларов. Доставлено за 12 секунд.',
  ];

  const SCENE_CONTENT: Array<{ headline: string; sub: string; tags?: string[] }> = [
    {
      headline: '❌ TRANSACTION BLOCKED BY SANCTIONS',
      sub: 'Прямой маршрут: Москва → Стамбул',
      tags: ['OFAC', 'TETHER COMPLIANCE', 'SDN LIST'],
    },
    {
      headline: 'Оплатить инвойс турецкому поставщику',
      sub: '1 000 000 USDT · Турция · TRC-20',
      tags: ['Анализ адреса', 'Risk Engine: OK', 'AML: Чисто'],
    },
    {
      headline: 'Маршрут найден',
      sub: '',
      tags: ['Прямой: ❌ ЗАБЛОКИРОВАН', '1 247 маршрутов', 'Оптимум: РОЙ (5 000 агентов)'],
    },
    {
      headline: 'РОЙ ЗАПУЩЕН',
      sub: '5 000 микротранзакций × $200',
      tags: ['USDT→Нефть', 'Нефть→PAXG', 'PAXG→AED', 'AED→USDT'],
    },
    {
      headline: 'FULL TRACE: 1 000 000 USDT DELIVERED',
      sub: 'Chainalysis: LOW RISK — EXCHANGE NOISE',
      tags: ['DELIVERED', '100% верификация', 'Регулятор: Всё видно'],
    },
    {
      headline: 'MOST',
      sub: 'Международные платежи без блокировок',
      tags: ['12 секунд', '20+ сетей', '0 следов'],
    },
  ];

  // Пересчёт сцены по elapsed
  useEffect(() => {
    const idx = SCENES.findIndex(s => elapsed >= s.from && elapsed < s.to);
    if (idx !== -1 && idx !== scene) {
      setScene(idx);
      setSubtitleVisible(false);
      setTimeout(() => setSubtitleVisible(true), 300);
    }
    if (elapsed >= TOTAL_SEC) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
      setElapsed(TOTAL_SEC - 0.1);
    }
  }, [elapsed]);

  const toggle = () => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
    } else {
      if (elapsed >= TOTAL_SEC - 1) setElapsed(0);
      setPlaying(true);
      intervalRef.current = setInterval(() => setElapsed(e => e + 0.25), 250);
    }
  };

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const progress = (elapsed / TOTAL_SEC) * 100;
  const sc = SCENES[scene];
  const content = SCENE_CONTENT[scene];
  const globePhase: 'problem' | 'swarm' | 'result' =
    scene === 0 ? 'problem' : scene === 3 ? 'swarm' : scene >= 4 ? 'result' : 'problem';
  const showGlobe  = scene !== 2;
  const showNeural = scene === 2;
  const showFinal  = scene === 5;

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}
    >
      <div
        style={{ position: 'relative', width: '100%', maxWidth: 900, background: '#040410', border: `1px solid rgba(0,255,136,0.2)`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 80px rgba(0,0,0,0.8)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Кнопка закрыть */}
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="X" size={15} />
        </button>

        {/* Бейдж сцены */}
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, padding: '4px 12px', borderRadius: 20, background: `${sc.color}22`, border: `1px solid ${sc.color}55`, fontSize: 11, fontWeight: 700, color: sc.color, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.12em' }}>
          {sc.title}
        </div>

        {/* Главный экран — 16:9 */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: sc.bg, transition: 'background 0.8s ease', overflow: 'hidden' }}>

          {/* Сетка-фон */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.06, backgroundImage: `linear-gradient(rgba(0,255,136,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.3) 1px, transparent 1px)`, backgroundSize: '40px 40px', pointerEvents: 'none' }} />

          {/* Глобус */}
          {showGlobe && !showFinal && (
            <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%', opacity: 0.9 }}>
              <GlobeCanvas phase={globePhase} />
            </div>
          )}

          {/* Нейросеть */}
          {showNeural && (
            <div style={{ position: 'absolute', right: 0, top: 0, width: '50%', height: '100%' }}>
              <NeuralCanvas />
            </div>
          )}

          {/* Левый контент */}
          {!showFinal && (
            <div style={{ position: 'absolute', left: 0, top: 0, width: showGlobe || showNeural ? '52%' : '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 36px', gap: 14 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', fontFamily: 'JetBrains Mono, monospace' }}>
                {fmtTime(elapsed)} / {fmtTime(TOTAL_SEC)}
              </div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(16px, 2.2vw, 22px)', fontWeight: 700, color: scene === 0 ? '#FF4444' : '#fff', lineHeight: 1.25, margin: 0, textShadow: `0 0 30px ${sc.color}44`, opacity: subtitleVisible ? 1 : 0, transform: subtitleVisible ? 'translateY(0)' : 'translateY(8px)', transition: 'all 0.4s ease' }}>
                {content.headline}
              </h2>
              {content.sub && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontFamily: 'JetBrains Mono, monospace', opacity: subtitleVisible ? 1 : 0, transition: 'all 0.4s ease 0.1s' }}>
                  {content.sub}
                </div>
              )}
              {content.tags && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: subtitleVisible ? 1 : 0, transition: 'all 0.4s ease 0.2s' }}>
                  {content.tags.map((tag, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.color, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${sc.color}` }} />
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'JetBrains Mono, monospace' }}>{tag}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Субтитр */}
              <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,0.4)', border: `1px solid rgba(255,255,255,0.08)`, fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, fontFamily: 'monospace', maxWidth: '90%', opacity: subtitleVisible && playing ? 1 : 0.4, transition: 'opacity 0.5s' }}>
                {SUBTITLES[scene]}
              </div>
            </div>
          )}

          {/* Финальный экран */}
          {showFinal && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <div style={{ animation: 'mostPulse 2s ease-in-out infinite', filter: 'drop-shadow(0 0 30px rgba(0,255,136,0.5))' }}>
                <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 80, width: 'auto', objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>Международные платежи без блокировок</div>
              <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                {['12 секунд', '20+ сетей', '0 следов'].map(t => (
                  <div key={t} style={{ padding: '8px 18px', borderRadius: 20, background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', fontSize: 13, color: '#00FF88', fontFamily: 'JetBrains Mono, monospace' }}>{t}</div>
                ))}
              </div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic', marginTop: 8 }}>«МОСТ. Потому что бизнес не должен ждать.»</div>
            </div>
          )}

          {/* Play-overlay когда на паузе */}
          {!playing && elapsed === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', cursor: 'pointer' }} onClick={toggle}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '2px solid #00FF88', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <Icon name="Play" size={28} style={{ color: '#00FF88', marginLeft: 4 }} />
              </div>
            </div>
          )}
        </div>

        {/* Прогресс-бар и контролы */}
        <div style={{ padding: '12px 20px 16px', background: '#06060F', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Таймлайн сцен */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
            {SCENES.map((s, i) => (
              <div key={s.id}
                onClick={() => { setElapsed(s.from + 0.5); }}
                style={{ flex: s.to - s.from, height: 3, borderRadius: 2, background: elapsed >= s.from ? s.color : 'rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.3s', position: 'relative' }}
                title={s.title}>
                {elapsed >= s.from && elapsed < s.to && (
                  <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, borderRadius: '50%', background: s.color, boxShadow: `0 0 8px ${s.color}` }} />
                )}
              </div>
            ))}
          </div>

          {/* Контролы */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={toggle} style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.35)', color: '#00FF88', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name={playing ? 'Pause' : 'Play'} size={15} style={{ marginLeft: playing ? 0 : 2 }} />
            </button>
            <button onClick={() => { setElapsed(0); setPlaying(false); }} style={{ width: 30, height: 30, borderRadius: '50%', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="RotateCcw" size={13} />
            </button>

            {/* Scrubber */}
            <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', position: 'relative', cursor: 'pointer' }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                setElapsed(pct * TOTAL_SEC);
              }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #00FF88, rgba(0,255,136,0.6))', borderRadius: 2, transition: 'width 0.25s linear' }} />
              <div style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', left: `${progress}%`, marginLeft: -6, width: 12, height: 12, borderRadius: '50%', background: '#00FF88', boxShadow: '0 0 8px rgba(0,255,136,0.8)', transition: 'left 0.25s linear' }} />
            </div>

            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0 }}>
              {fmtTime(elapsed)} / {fmtTime(TOTAL_SEC)}
            </span>

            {/* Сцены-ярлыки */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {SCENES.map((s, i) => (
                <button key={s.id} onClick={() => setElapsed(s.from + 0.5)}
                  style={{ padding: '3px 8px', borderRadius: 6, border: `1px solid ${scene === i ? s.color + '66' : 'transparent'}`, background: scene === i ? `${s.color}15` : 'transparent', color: scene === i ? s.color : 'rgba(255,255,255,0.25)', fontSize: 10, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mostPulse {
          0%, 100% { box-shadow: 0 0 40px rgba(0,255,136,0.4); }
          50% { box-shadow: 0 0 80px rgba(0,255,136,0.7); }
        }
      `}</style>
    </div>
  );
}

// ─── Данные ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    icon: 'FilePlus',
    title: 'Вы создаёте платёж',
    desc: 'Укажите сумму, валюту и адрес получателя. MOST проверяет KYC/AML автоматически за секунды.',
  },
  {
    n: '02',
    icon: 'GitBranch',
    title: 'MOST разбивает на 1000+ микротранзакций',
    desc: 'Swarm-рой агентов маршрутизирует платёж через 20+ блокчейн-сетей параллельно. Снаружи — некоррелированный шум.',
  },
  {
    n: '03',
    icon: 'CheckCircle2',
    title: 'Получатель видит обычный перевод',
    desc: 'Деньги приходят за <30 секунд в удобной валюте. Без блокировок, без задержек, без объяснений банкам.',
  },
];

const BENEFITS = [
  {
    icon: 'EyeOff',
    title: 'Невидимость для Chainalysis',
    desc: 'Внешний аналитик видит тысячи некоррелированных микротранзакций — паттерн неразличим на фоне рыночного шума.',
  },
  {
    icon: 'Eye',
    title: 'Прозрачность для регулятора',
    desc: 'Золотая нода раскрывает ЦБ полный граф маршрута, tx_hash каждого агента и аудит-лог всех действий.',
  },
  {
    icon: 'Network',
    title: '20+ сетей одновременно',
    desc: 'Ethereum, BSC, Tron, Solana, Bitcoin Lightning, Stellar, TON, Arbitrum, Polygon и ещё 11 сетей.',
  },
  {
    icon: 'Zap',
    title: 'Скорость < 30 секунд',
    desc: 'Любая сумма — от $1K до $100M — доставляется за одинаковое время благодаря параллельной маршрутизации.',
  },
  {
    icon: 'ShieldCheck',
    title: 'AML/KYC встроен',
    desc: 'Автоматическая проверка адресов по санкционным спискам OFAC/SDN. Compliance-офицер одобряет пограничные случаи.',
  },
  {
    icon: 'KeyRound',
    title: 'Безопасность MPC',
    desc: 'Приватные ключи существуют только в момент подписания транзакции. Не хранятся нигде. Мультиподпись 3-из-5.',
  },
];

const PLANS = [
  {
    name: 'Стартовый',
    price: '0.5%',
    priceNote: 'от суммы',
    limit: 'до $1M / мес',
    features: [
      '20+ блокчейн-сетей',
      'AML/KYC автоматический',
      'Поддержка email 24/7',
      'Документация API',
      'Sandbox-среда',
    ],
    cta: 'Начать бесплатно',
    highlight: false,
  },
  {
    name: 'Бизнес',
    price: '0.3%',
    priceNote: 'от суммы',
    limit: 'до $10M / мес',
    features: [
      'Всё из Стартового',
      'Персональный менеджер',
      'SLA 99.9%',
      'Выделенный compliance',
      'Webhook-уведомления',
    ],
    cta: 'Подключить',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '0.1%',
    priceNote: 'от суммы',
    limit: 'Без лимита',
    features: [
      'Всё из Бизнес',
      'On-premise установка',
      'Золотая регуляторная нода',
      'Индивидуальный SLA',
      'Аудит безопасности',
    ],
    cta: 'Обсудить условия',
    highlight: false,
  },
];

// ─── Главная страница ─────────────────────────────────────────────────────────
export default function Index() {
  const [swarmStats, setSwarmStats] = useState<SwarmStats>({ active: 55, completed: 0, pct: 0 });
  const [videoOpen, setVideoOpen]   = useState(false);
  const handleStats = useCallback((s: SwarmStats) => setSwarmStats(s), []);

  return (
    <div style={{ background: BG, color: '#fff', minHeight: '100vh', fontFamily: "'Rubik', sans-serif", overflowX: 'hidden' }}>
      {videoOpen && <VideoModal onClose={() => setVideoOpen(false)} />}

      {/* ── NAV ──────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(0,255,136,0.12)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block', filter: 'brightness(1.4) contrast(1.1)' }} />
          </a>
          <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
            {[
              { label: 'О платформе',  href: '/about'    },
              { label: 'Как работает', href: '#how'       },
              { label: 'Безопасность', href: '/security'  },
              { label: 'Для банков',   href: '/docs'      },
              { label: 'Контакты',     href: '/contacts'  },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ ...dimText, fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
              >{l.label}</a>
            ))}
            <a href="/register" style={{
              background: ACCENT, color: BG, padding: '8px 20px', borderRadius: 10,
              fontWeight: 600, fontSize: 14, textDecoration: 'none', transition: 'opacity 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >Подключить</a>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO                                                               */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>

        {/* Фоновая сетка */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.18,
          backgroundImage: `linear-gradient(rgba(0,255,136,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.15) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        {/* Радиальные glow */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 60% 80% at 70% 50%, rgba(0,255,136,0.07) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse 40% 60% at 10% 30%, rgba(98,126,234,0.08) 0%, transparent 60%)`, pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', width: '100%', paddingTop: 64, paddingBottom: 64 }}>

          {/* Текст слева */}
          <div style={{ animation: 'fadeUp 0.7s ease both' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(0,255,136,0.1)', border: `1px solid rgba(0,255,136,0.25)`, borderRadius: 24, padding: '6px 14px', marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.18em', ...accentText, fontFamily: 'JetBrains Mono, monospace' }}>
                {swarmStats.active} АГЕНТОВ · {swarmStats.completed.toLocaleString()} TX ВЫПОЛНЕНО
              </span>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 4.5vw, 58px)', fontWeight: 700, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: 24 }}>
              Международные<br />
              <span style={accentText}>платежи</span><br />
              без блокировок
            </h1>

            <p style={{ fontSize: 17, lineHeight: 1.7, ...dimText, maxWidth: 480, marginBottom: 36 }}>
              MOST разбивает ваш платёж на тысячи микротранзакций через <strong style={{ color: '#fff' }}>20+ блокчейн-сетей</strong>. Внешний наблюдатель видит шум. Ваш контрагент получает деньги за секунды.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="/register" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: ACCENT, color: BG, padding: '14px 28px', borderRadius: 12,
                fontWeight: 700, fontSize: 15, textDecoration: 'none',
                boxShadow: `0 0 24px rgba(0,255,136,0.35)`, transition: 'transform 0.2s, box-shadow 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 0 36px rgba(0,255,136,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 0 24px rgba(0,255,136,0.35)`; }}
              >
                <Icon name="ArrowUpRight" size={18} /> Подключить платформу
              </a>
              <button
                onClick={() => setVideoOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'transparent', border: `1px solid rgba(255,255,255,0.2)`, color: '#fff',
                  padding: '14px 28px', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.background = 'rgba(0,255,136,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon name="Play" size={18} /> Посмотреть демо
              </button>
            </div>

            {/* Счётчики */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, ...accentText }}>
                  $<Counter end={2.4} decimals={1} />B
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>ПРОВЕДЕНО</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  <Counter end={18.5} decimals={1} />M
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>ТРАНЗАКЦИЙ</div>
              </div>
              <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: '#fff' }}>
                  20+
                </div>
                <div style={{ fontSize: 12, ...dimText, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.1em' }}>СЕТЕЙ</div>
              </div>
            </div>
          </div>

          {/* 3D Глобус справа + логотип поверх */}
          <div style={{ height: 520, position: 'relative', animation: 'fadeUp 0.9s ease 0.15s both' }}>
            {/* Свечение под глобусом */}
            <div style={{ position: 'absolute', inset: '10%', borderRadius: '50%', background: `radial-gradient(ellipse, rgba(0,255,136,0.12) 0%, transparent 70%)`, filter: 'blur(20px)', pointerEvents: 'none' }} />
            <SwarmGlobe onStats={handleStats} className="w-full h-full" />
            {/* Логотип поверх глобуса */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <img
                src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png"
                alt="MOST"
                style={{
                  width: '90%',
                  maxWidth: 480,
                  height: 'auto',
                  objectFit: 'contain',
                  mixBlendMode: 'screen',
                  filter: 'brightness(1.15) saturate(1.2)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Скролл-индикатор */}
        <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, animation: 'bounce 2s ease-in-out infinite' }}>
          <span style={{ fontSize: 10, letterSpacing: '0.15em', ...dimText }}>ПРОКРУТИТЬ</span>
          <Icon name="ChevronDown" size={16} style={{ color: ACCENT }} />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. КАК ЭТО РАБОТАЕТ                                                  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Как работает" style={{ padding: '120px 24px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>КАК ЭТО РАБОТАЕТ</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Три шага до получателя
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32, position: 'relative' }}>
            {/* Соединительная линия */}
            <div style={{
              position: 'absolute', top: 56, left: '20%', right: '20%', height: 1,
              background: `linear-gradient(90deg, transparent, ${ACCENT}40, ${ACCENT}40, transparent)`,
              pointerEvents: 'none',
            }} />

            {STEPS.map((s, i) => (
              <div key={s.n} style={{ ...cardStyle, padding: 36, textAlign: 'center', position: 'relative' }}>
                {/* Номер */}
                <div style={{ position: 'absolute', top: -14, left: 24, background: BG, padding: '0 8px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', ...accentText }}>{s.n}</div>

                {/* Иконка */}
                <div style={{
                  width: 64, height: 64, borderRadius: 18,
                  background: 'rgba(0,255,136,0.1)', border: `1px solid ${CARD_BOR}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                  boxShadow: i === 1 ? `0 0 24px rgba(0,255,136,0.25)` : 'none',
                }}>
                  <Icon name={s.icon} size={28} style={{ color: ACCENT }} />
                </div>

                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, marginBottom: 12, lineHeight: 1.3 }}>{s.title}</h3>
                <p style={{ ...dimText, fontSize: 14, lineHeight: 1.7 }}>{s.desc}</p>

                {i === 1 && (
                  <div style={{ marginTop: 20, display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['ETH', 'SOL', 'TON', 'TRX', '+17'].map(n => (
                      <span key={n} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,255,136,0.1)', border: `1px solid rgba(0,255,136,0.2)`, borderRadius: 6, padding: '3px 8px', ...accentText }}>{n}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. ПРЕИМУЩЕСТВА                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Преимущества" style={{ padding: '0 24px 120px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ПОЧЕМУ MOST</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Одновременно невидим<br />и прозрачен
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {BENEFITS.map((b, i) => (
              <div
                key={b.title}
                style={{
                  ...cardStyle,
                  padding: '32px 36px',
                  display: 'flex', gap: 24, alignItems: 'flex-start',
                  transition: 'transform 0.25s, box-shadow 0.25s',
                  cursor: 'default',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 8px 32px rgba(0,255,136,0.12)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: i < 2 ? 'rgba(0,255,136,0.12)' : 'rgba(0,255,136,0.06)',
                  border: `1px solid ${CARD_BOR}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={b.icon} size={22} style={{ color: ACCENT }} />
                </div>
                <div>
                  <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, marginBottom: 8 }}>{b.title}</h3>
                  <p style={{ ...dimText, fontSize: 14, lineHeight: 1.7 }}>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. ТАРИФЫ                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <section id="Тарифы" style={{ padding: '0 24px 120px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 72 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.2em', ...accentText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>ТАРИФЫ</div>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Прозрачные условия
            </h2>
            <p style={{ ...dimText, fontSize: 16, marginTop: 12 }}>Комиссия только от фактически переведённой суммы</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {PLANS.map((p) => (
              <div
                key={p.name}
                style={{
                  ...cardStyle,
                  padding: '40px 32px',
                  position: 'relative',
                  border: p.highlight ? `1px solid ${ACCENT}` : `1px solid ${CARD_BOR}`,
                  boxShadow: p.highlight ? `0 0 40px rgba(0,255,136,0.18)` : 'none',
                  transition: 'transform 0.25s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                {p.highlight && (
                  <div style={{
                    position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)',
                    background: ACCENT, color: BG, fontSize: 11, fontWeight: 700,
                    padding: '4px 16px', borderRadius: 20, whiteSpace: 'nowrap',
                    letterSpacing: '0.08em',
                  }}>ПОПУЛЯРНЫЙ</div>
                )}

                <div style={{ marginBottom: 8, fontSize: 13, ...dimText, letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>{p.name.toUpperCase()}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 700, ...accentText, lineHeight: 1 }}>{p.price}</span>
                </div>
                <div style={{ fontSize: 13, ...dimText, marginBottom: 6 }}>{p.priceNote}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 28, padding: '6px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'inline-block' }}>{p.limit}</div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
                      <Icon name="Check" size={15} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/register"
                  style={{
                    display: 'block', textAlign: 'center', padding: '13px 24px',
                    borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none',
                    transition: 'transform 0.2s, opacity 0.2s',
                    background: p.highlight ? ACCENT : 'transparent',
                    color: p.highlight ? BG : '#fff',
                    border: p.highlight ? 'none' : `1px solid rgba(255,255,255,0.25)`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >{p.cta}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA-полоса ─────────────────────────────────────────────────────── */}
      <section style={{ padding: '0 24px 120px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: `linear-gradient(135deg, rgba(0,255,136,0.1) 0%, rgba(98,126,234,0.08) 100%)`,
          border: `1px solid ${CARD_BOR}`,
          borderRadius: 24, padding: '64px 48px', textAlign: 'center',
        }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(24px, 3vw, 38px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>
            Готовы к первому платежу?
          </h2>
          <p style={{ ...dimText, fontSize: 16, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Подключитесь за 15 минут. Первый месяц — без комиссии на сумму до $500K.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ACCENT, color: BG, padding: '14px 32px', borderRadius: 12,
              fontWeight: 700, fontSize: 15, textDecoration: 'none',
              boxShadow: `0 0 28px rgba(0,255,136,0.4)`,
            }}>
              <Icon name="ArrowUpRight" size={18} /> Подключить платформу
            </a>
            <a href="/contacts" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '14px 32px',
              borderRadius: 12, fontWeight: 600, fontSize: 15, textDecoration: 'none',
            }}>
              <Icon name="Mail" size={18} /> Связаться с нами
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 5. ФУТЕР                                                              */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid rgba(0,255,136,0.12)',
        padding: '48px 24px',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, marginBottom: 48 }}>
            {/* Лого */}
            <div>
              <a href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', marginBottom: 16 }}>
                <img src="https://cdn.poehali.dev/projects/573c75be-a606-4ed0-96a4-1601ddf0b628/bucket/6357c7e8-9711-4d17-a842-e36565661a52.png" alt="MOST" style={{ height: 48, width: 'auto', objectFit: 'contain', display: 'block' }} />
              </a>
              <p style={{ ...dimText, fontSize: 13, lineHeight: 1.7, maxWidth: 260 }}>
                Платформа трансграничных крипто-платежей с технологией swarm-маршрутизации.
              </p>
            </div>

            {/* Ссылки */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32 }}>
              {[
                {
                  title: 'Платформа',
                  links: [
                    { label: 'О платформе',  href: '/about'    },
                    { label: 'Как работает', href: '#how'       },
                    { label: 'Безопасность', href: '/security'  },
                  ],
                },
                {
                  title: 'Разработчикам',
                  links: [
                    { label: 'Подключение банков', href: '/docs'    },
                    { label: 'API Reference',      href: '/api-ref' },
                    { label: 'Sandbox',            href: '/sandbox' },
                  ],
                },
                {
                  title: 'Компания',
                  links: [
                    { label: 'Контакты',              href: '/contacts' },
                    { label: 'Политика KYC/AML',      href: '/kyc-aml'  },
                    { label: 'Условия использования', href: '/terms'    },
                    { label: 'Пресс-кит',             href: '/press'    },
                  ],
                },
              ].map(col => (
                <div key={col.title}>
                  <div style={{ fontSize: 11, letterSpacing: '0.15em', ...dimText, fontFamily: 'JetBrains Mono, monospace', marginBottom: 16 }}>{col.title.toUpperCase()}</div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {col.links.map(l => (
                      <li key={l.label}>
                        <a href={l.href} style={{ ...dimText, fontSize: 14, textDecoration: 'none', transition: 'color 0.2s' }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                        >{l.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Нижняя строка */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ ...dimText, fontSize: 13 }}>MOST © 2026. Все права защищены.</span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>onemost.ru</span>
          </div>
        </div>
      </footer>

      {/* ── CSS анимации ─────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%       { transform: translateX(-50%) translateY(6px); }
        }
        @media (max-width: 900px) {
          section > div > div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
          section > div > div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}