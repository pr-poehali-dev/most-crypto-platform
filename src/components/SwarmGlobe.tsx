import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

// ─── Конфиг сетей ───────────────────────────────────────────────────────────
const NETWORKS = [
  { name: 'ETH',     hex: '#627EEA' },
  { name: 'BSC',     hex: '#F3BA2F' },
  { name: 'Polygon', hex: '#8247E5' },
  { name: 'Tron',    hex: '#FF060A' },
  { name: 'Solana',  hex: '#14F195' },
  { name: 'Stellar', hex: '#08B5E5' },
];
const NET_COLORS = NETWORKS.map(n => new THREE.Color(n.hex));

const GLOBE_R   = 1.55;
const AGENT_CNT = 55;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomSurface(r = GLOBE_R) {
  const phi   = Math.acos(2 * Math.random() - 1);
  const theta = Math.random() * Math.PI * 2;
  return new THREE.Vector3(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function bezier(p0: THREE.Vector3, p2: THREE.Vector3, t: number) {
  const mid = p0.clone().add(p2).multiplyScalar(0.5);
  const p1  = mid.normalize().multiplyScalar(mid.length() * 1.6);
  const mt  = 1 - t;
  return new THREE.Vector3(
    mt*mt*p0.x + 2*mt*t*p1.x + t*t*p2.x,
    mt*mt*p0.y + 2*mt*t*p1.y + t*t*p2.y,
    mt*mt*p0.z + 2*mt*t*p1.z + t*t*p2.z,
  );
}

// ─── Статистика для HUD ──────────────────────────────────────────────────────
export interface SwarmStats {
  active: number;
  completed: number;
  pct: number;
}

interface Props {
  onStats?: (s: SwarmStats) => void;
  className?: string;
}

export default function SwarmGlobe({ onStats, className = '' }: Props) {
  const mountRef  = useRef<HTMLDivElement>(null);
  const statsRef  = useRef({ active: 0, completed: 0, pct: 0 });

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    // ── Renderer ────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(renderer.domElement);

    // ── Scene & Camera ───────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 50);
    camera.position.set(0, 0.4, 4.6);

    // ── Globe ────────────────────────────────────────────────────────────────
    const wireGeo = new THREE.SphereGeometry(GLOBE_R, 40, 26);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x0d4060, wireframe: true, transparent: true, opacity: 0.28,
    });
    const globe = new THREE.Mesh(wireGeo, wireMat);
    scene.add(globe);

    // Внутренняя тёмная сфера — чтобы задняя wireframe не просвечивала
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 0.994, 40, 26),
      new THREE.MeshBasicMaterial({ color: 0x020812, transparent: true, opacity: 0.92, side: THREE.BackSide }),
    ));

    // Экваториальное кольцо
    scene.add(new THREE.Mesh(
      new THREE.TorusGeometry(GLOBE_R, 0.006, 4, 130),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.4 }),
    ));

    // ── Города ───────────────────────────────────────────────────────────────
    const CITIES = [
      { pos: new THREE.Vector3(-1, 0.5, 4.5).normalize().multiplyScalar(GLOBE_R), color: 0xff3b3b },
      { pos: new THREE.Vector3(0.5, 0.5, 4.5).normalize().multiplyScalar(GLOBE_R), color: 0x14f195 },
    ];
    CITIES.forEach(c => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 10, 10),
        new THREE.MeshBasicMaterial({ color: c.color }),
      );
      m.position.copy(c.pos);
      scene.add(m);
      // Ореол
      const h = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 10, 10),
        new THREE.MeshBasicMaterial({ color: c.color, transparent: true, opacity: 0.15 }),
      );
      h.position.copy(c.pos);
      scene.add(h);
    });

    // ── Звёзды ───────────────────────────────────────────────────────────────
    const starPos = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const th  = Math.random() * Math.PI * 2;
      const r   = 10 + Math.random() * 8;
      starPos[i*3]   = r * Math.sin(phi) * Math.cos(th);
      starPos[i*3+1] = r * Math.cos(phi);
      starPos[i*3+2] = r * Math.sin(phi) * Math.sin(th);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: 0x4a88aa, size: 0.03, transparent: true, opacity: 0.5 }),
    ));

    // ── Агенты ───────────────────────────────────────────────────────────────
    const agentGeo = new THREE.SphereGeometry(0.018, 5, 5);

    type Agent = {
      mesh:  THREE.Mesh;
      trail: { line: THREE.Line; pos: Float32Array; cnt: number };
      src: THREE.Vector3; dst: THREE.Vector3;
      t: number; speed: number; netIdx: number; done: boolean;
    };

    const TRAIL_LEN = 28;

    function makeAgent(): Agent {
      const ni   = Math.floor(Math.random() * NETWORKS.length);
      const col  = NET_COLORS[ni];
      const mesh = new THREE.Mesh(agentGeo, new THREE.MeshBasicMaterial({ color: col }));
      scene.add(mesh);

      const tPos  = new Float32Array(TRAIL_LEN * 3);
      const tGeo  = new THREE.BufferGeometry();
      tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
      tGeo.setDrawRange(0, 0);
      const tLine = new THREE.Line(tGeo,
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.45 }),
      );
      scene.add(tLine);

      // Иногда — между городами
      let src: THREE.Vector3, dst: THREE.Vector3;
      const r = Math.random();
      if (r < 0.25)      { src = CITIES[0].pos.clone(); dst = CITIES[1].pos.clone(); }
      else if (r < 0.45) { src = CITIES[1].pos.clone(); dst = randomSurface(); }
      else if (r < 0.60) { src = randomSurface(); dst = CITIES[0].pos.clone(); }
      else               { src = randomSurface(); dst = randomSurface(); }

      return {
        mesh, trail: { line: tLine, pos: tPos, cnt: 0 },
        src, dst, t: Math.random(),
        speed: 0.003 + Math.random() * 0.005,
        netIdx: ni, done: false,
      };
    }

    const agents: Agent[] = Array.from({ length: AGENT_CNT }, makeAgent);

    // Дуговые следы (fade out)
    type ArcLine = { line: THREE.Line; ttl: number };
    const arcLines: ArcLine[] = [];

    function addArc(src: THREE.Vector3, dst: THREE.Vector3, col: THREE.Color) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 36; i++) pts.push(bezier(src, dst, i / 36));
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.07 }));
      scene.add(l);
      arcLines.push({ line: l, ttl: 3.5 });
    }

    // ── Clock & RAF ──────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let completed = 0;
    let frame = 0;
    let rafId: number;

    function animate() {
      rafId = requestAnimationFrame(animate);
      const dt  = clock.getDelta();
      const now = clock.getElapsedTime();
      frame++;

      globe.rotation.y += dt * 0.055;

      // Города — пульс
      CITIES.forEach((c, ci) => {
        const mesh = scene.children.find(
          ch => ch instanceof THREE.Mesh && ch.position.distanceTo(c.pos) < 0.01
        ) as THREE.Mesh | undefined;
        if (mesh) mesh.scale.setScalar(1 + 0.25 * Math.sin(now * 2.8 + ci * 1.5));
      });

      let activeNow = 0;
      agents.forEach((a, idx) => {
        if (a.done) return;
        a.t += a.speed;
        activeNow++;

        const pos = bezier(a.src, a.dst, Math.min(a.t, 1));
        a.mesh.position.copy(pos);

        // Трейл — сдвиг истории
        const p = a.trail.pos;
        for (let i = TRAIL_LEN - 1; i > 0; i--) {
          p[i*3] = p[(i-1)*3]; p[i*3+1] = p[(i-1)*3+1]; p[i*3+2] = p[(i-1)*3+2];
        }
        p[0] = pos.x; p[1] = pos.y; p[2] = pos.z;
        a.trail.cnt = Math.min(a.trail.cnt + 1, TRAIL_LEN);
        a.trail.line.geometry.attributes.position.needsUpdate = true;
        a.trail.line.geometry.setDrawRange(0, a.trail.cnt);

        if (a.t >= 1) {
          a.done = true;
          completed++;
          scene.remove(a.mesh);
          scene.remove(a.trail.line);
          addArc(a.src, a.dst, NET_COLORS[a.netIdx]);
          agents[idx] = makeAgent();
        }
      });

      // Дуги — fade
      for (let i = arcLines.length - 1; i >= 0; i--) {
        arcLines[i].ttl -= dt;
        (arcLines[i].line.material as THREE.LineBasicMaterial).opacity =
          Math.max(0, arcLines[i].ttl * 0.02);
        if (arcLines[i].ttl <= 0) {
          scene.remove(arcLines[i].line);
          arcLines.splice(i, 1);
        }
      }

      // Stats callback каждые 8 кадров
      if (frame % 8 === 0 && onStats) {
        const total = completed + activeNow;
        const pct   = total ? Math.min(100, Math.round((completed / Math.max(total, AGENT_CNT * 3)) * 100)) : 0;
        statsRef.current = { active: activeNow, completed, pct };
        onStats(statsRef.current);
      }

      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ───────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      if (!el) return;
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={`w-full h-full ${className}`} />;
}
