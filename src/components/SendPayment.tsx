import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';

const RISK_CHECK_URL = 'https://functions.poehali.dev/410aaa09-451b-41e6-b66e-e0015ce8011c';

const NETWORKS = [
  { id: 'ethereum',  label: 'Ethereum',   sym: 'ETH',  color: '#8fadff' },
  { id: 'bsc',       label: 'BNB Chain',  sym: 'BSC',  color: '#f3ba2f' },
  { id: 'polygon',   label: 'Polygon',    sym: 'MATIC', color: '#a06bff' },
  { id: 'tron',      label: 'Tron',       sym: 'TRX',  color: '#ff3b3b' },
  { id: 'solana',    label: 'Solana',     sym: 'SOL',  color: '#42fff0' },
  { id: 'ton',       label: 'TON',        sym: 'TON',  color: '#39a0ff' },
  { id: 'arbitrum',  label: 'Arbitrum',   sym: 'ARB',  color: '#39c6ff' },
  { id: 'optimism',  label: 'Optimism',   sym: 'OP',   color: '#ff5f6d' },
  { id: 'avalanche', label: 'Avalanche',  sym: 'AVAX', color: '#ff5252' },
  { id: 'stellar',   label: 'Stellar',    sym: 'XLM',  color: '#7ee0ff' },
];

const COUNTRIES = [
  { code: 'RU', label: 'Россия' },
  { code: 'US', label: 'США' },
  { code: 'DE', label: 'Германия' },
  { code: 'AE', label: 'ОАЭ' },
  { code: 'CH', label: 'Швейцария' },
  { code: 'SG', label: 'Сингапур' },
  { code: 'TR', label: 'Турция' },
  { code: 'GB', label: 'Великобритания' },
  { code: 'CN', label: 'Китай' },
  { code: 'JP', label: 'Япония' },
];

type Recommendation = 'APPROVE' | 'MANUAL_REVIEW' | 'REJECT';

interface AmlResult {
  risk_score: number;
  is_sanctioned: boolean;
  is_mixer: boolean;
  recommendation: Recommendation;
  reasons: string[];
}

type Step = 'form' | 'aml' | 'confirm' | 'sending' | 'done' | 'rejected';

const STEP_LABELS = ['Детали', 'AML-проверка', 'Подтверждение'];

const riskMeta = (rec: Recommendation, score: number) => {
  if (rec === 'APPROVE')       return { color: 'neon-lime',       bar: 'bg-[hsl(var(--neon-lime))]',  bg: 'bg-[hsl(var(--neon-lime))]/8  border-[hsl(var(--neon-lime))]/25',  icon: 'ShieldCheck',   label: 'Низкий риск' };
  if (rec === 'MANUAL_REVIEW') return { color: 'text-yellow-400', bar: 'bg-yellow-400',               bg: 'bg-yellow-400/8 border-yellow-400/25',                                icon: 'ShieldAlert',   label: 'Средний риск' };
  return                              { color: 'text-destructive', bar: 'bg-destructive',              bg: 'bg-destructive/8 border-destructive/25',                              icon: 'ShieldX',       label: score >= 80 ? 'Критический риск' : 'Высокий риск' };
};

export default function SendPayment() {
  // form
  const [fromNet, setFromNet]     = useState(NETWORKS[0].id);
  const [toNet, setToNet]         = useState(NETWORKS[2].id);
  const [amount, setAmount]       = useState('');
  const [address, setAddress]     = useState('');
  const [country, setCountry]     = useState('AE');

  // AML
  const [aml, setAml]             = useState<AmlResult | null>(null);
  const [amlLoading, setAmlLoading] = useState(false);
  const [amlError, setAmlError]   = useState('');
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);

  // flow
  const [step, setStep]           = useState<Step>('form');
  const [sendError, setSendError] = useState('');
  const [orderId, setOrderId]     = useState('');
  const [forceSubmit, setForceSubmit] = useState(false);

  const fromNetwork = NETWORKS.find(n => n.id === fromNet)!;
  const toNetwork   = NETWORKS.find(n => n.id === toNet)!;

  // Дебаунс AML при вводе адреса
  useEffect(() => {
    setAml(null);
    setAmlError('');
    if (address.length < 4) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setAmlLoading(true);
      try {
        const res = await fetch(RISK_CHECK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address, network: fromNet }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setAml(data);
      } catch {
        setAmlError('Не удалось проверить адрес');
      } finally {
        setAmlLoading(false);
      }
    }, 650);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [address, fromNet]);

  function canProceed() {
    return address.length >= 4 && Number(amount) > 0 && !amlLoading;
  }

  function handleNext() {
    setSendError('');
    setForceSubmit(false);
    setStep('aml');
  }

  async function handleSend() {
    setStep('sending');
    setSendError('');
    try {
      // В реальном проекте здесь POST /api/v1/payments/new с JWT
      await new Promise(r => setTimeout(r, 1800));
      setOrderId(`ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`);
      setStep('done');
    } catch {
      setSendError('Ошибка при отправке. Попробуйте ещё раз.');
      setStep('aml');
    }
  }

  function reset() {
    setStep('form');
    setAmount('');
    setAddress('');
    setAml(null);
    setOrderId('');
    setForceSubmit(false);
    setSendError('');
  }

  const meta = aml ? riskMeta(aml.recommendation, aml.risk_score) : null;

  // ── STEP: done ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="animate-scale-in max-w-lg mx-auto pt-8">
        <div className="glass rounded-3xl border border-[hsl(var(--neon-lime))]/30 p-10 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--neon-lime))]/10 grid place-items-center mx-auto mb-6 glow-lime">
            <Icon name="CheckCircle2" size={40} className="neon-lime" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Платёж отправлен</h2>
          <p className="text-muted-foreground mb-2">Swarm-рой формирует маршрут по сетям</p>
          <div className="mono text-xs neon-cyan mb-8">{orderId}</div>
          <div className="grid grid-cols-3 gap-3 mb-8 text-center">
            {[
              { l: 'Сумма', v: `${amount} ${fromNetwork.sym}` },
              { l: 'Сеть', v: fromNetwork.label },
              { l: 'Статус', v: 'В маршруте' },
            ].map(x => (
              <div key={x.l} className="bg-secondary/40 rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">{x.l}</div>
                <div className="text-sm font-semibold">{x.v}</div>
              </div>
            ))}
          </div>
          <button onClick={reset} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-cyan hover-scale">
            Новый платёж
          </button>
        </div>
      </div>
    );
  }

  // ── STEP: sending ───────────────────────────────────────────────────────
  if (step === 'sending') {
    return (
      <div className="animate-fade-in max-w-lg mx-auto pt-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-6 animate-pulse-glow">
          <Icon name="Loader" size={36} className="text-primary animate-spin" />
        </div>
        <h2 className="font-display text-xl font-bold mb-2">Запускаем Swarm-рой</h2>
        <p className="text-muted-foreground text-sm">Разбиваем платёж на части и выбираем маршруты…</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs mono text-muted-foreground mb-1 flex items-center gap-2">
          <Icon name="ArrowUpRight" size={13} className="neon-cyan" />
          ОТПРАВИТЬ ПЛАТЁЖ
        </div>
        <h1 className="font-display text-2xl font-bold">Новый перевод</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8">
        {STEP_LABELS.map((label, i) => {
          const stepMap: Step[] = ['form', 'aml', 'confirm'];
          const current = stepMap.indexOf(step as Step);
          const active = current === i;
          const done   = current > i;
          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              <div className={`flex items-center gap-2 ${active ? '' : 'opacity-50'}`}>
                <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition-all ${
                  done   ? 'bg-[hsl(var(--neon-lime))] text-background' :
                  active ? 'bg-primary text-primary-foreground glow-cyan' :
                           'bg-secondary text-muted-foreground'
                }`}>
                  {done ? <Icon name="Check" size={13} /> : i + 1}
                </div>
                <span className="text-sm font-medium hidden sm:block">{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`flex-1 mx-3 h-px transition-all ${done ? 'bg-[hsl(var(--neon-lime))]/50' : 'bg-border/50'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ── STEP: form ─────────────────────────────────────────────────── */}
      {step === 'form' && (
        <div className="glass rounded-3xl border border-border/60 p-6 sm:p-8 space-y-6 animate-fade-in">

          {/* Network selector */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mono text-muted-foreground mb-2">Из сети</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {NETWORKS.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setFromNet(n.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
                      fromNet === n.id
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] mono font-bold shrink-0"
                      style={{ background: `${n.color}22`, color: n.color }}>
                      {n.sym.slice(0, 2)}
                    </span>
                    <span className="truncate">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs mono text-muted-foreground mb-2">В сеть</label>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                {NETWORKS.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setToNet(n.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border ${
                      toNet === n.id
                        ? 'border-[hsl(var(--neon-lime))]/50 bg-[hsl(var(--neon-lime))]/10 neon-lime'
                        : 'border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full grid place-items-center text-[9px] mono font-bold shrink-0"
                      style={{ background: `${n.color}22`, color: n.color }}>
                      {n.sym.slice(0, 2)}
                    </span>
                    <span className="truncate">{n.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Route preview */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/30 border border-border/40">
            <span className="mono text-sm font-semibold" style={{ color: fromNetwork.color }}>{fromNetwork.sym}</span>
            <div className="flex-1 flex items-center gap-1">
              <div className="flex-1 h-px border-t border-dashed border-border/60" />
              <Icon name="Zap" size={13} className="neon-cyan shrink-0" />
              <div className="flex-1 h-px border-t border-dashed border-border/60" />
            </div>
            <span className="mono text-sm font-semibold" style={{ color: toNetwork.color }}>{toNetwork.sym}</span>
            <span className="text-xs text-muted-foreground hidden sm:block">Swarm-маршрут</span>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs mono text-muted-foreground mb-2">Сумма</label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                className="w-full bg-secondary/40 border border-border/60 rounded-xl px-4 py-3 pr-20 font-display text-xl font-semibold text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 mono text-sm font-bold" style={{ color: fromNetwork.color }}>
                {fromNetwork.sym}
              </span>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs mono text-muted-foreground mb-2">Адрес получателя</label>
            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={`${toNetwork.sym}-адрес получателя`}
                className={`w-full bg-secondary/40 border rounded-xl px-4 py-3 pr-10 mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none transition-colors ${
                  aml?.recommendation === 'REJECT'        ? 'border-destructive/60 focus:border-destructive' :
                  aml?.recommendation === 'MANUAL_REVIEW' ? 'border-yellow-400/60 focus:border-yellow-400' :
                  aml?.recommendation === 'APPROVE'       ? 'border-[hsl(var(--neon-lime))]/60 focus:border-[hsl(var(--neon-lime))]' :
                                                            'border-border/60 focus:border-primary/60'
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {amlLoading && <Icon name="Loader" size={15} className="text-muted-foreground animate-spin" />}
                {!amlLoading && aml?.recommendation === 'APPROVE'       && <Icon name="ShieldCheck" size={15} className="neon-lime" />}
                {!amlLoading && aml?.recommendation === 'MANUAL_REVIEW' && <Icon name="ShieldAlert" size={15} className="text-yellow-400" />}
                {!amlLoading && aml?.recommendation === 'REJECT'        && <Icon name="ShieldX"     size={15} className="text-destructive" />}
              </div>
            </div>

            {/* Inline AML result */}
            {aml && meta && (
              <div className={`mt-2 rounded-xl border p-3 ${meta.bg} animate-fade-in`}>
                <div className={`flex items-center gap-2 text-sm font-medium ${meta.color} mb-1`}>
                  <Icon name={meta.icon} size={15} />
                  {meta.label} — Риск-скор: {aml.risk_score}/100
                </div>
                <div className="w-full h-1.5 rounded-full bg-background/30 overflow-hidden mb-2">
                  <div className={`h-full rounded-full transition-all ${meta.bar}`} style={{ width: `${aml.risk_score}%` }} />
                </div>
                <ul className="space-y-0.5">
                  {aml.reasons.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">·</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {amlError && (
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                <Icon name="WifiOff" size={12} /> {amlError}
              </p>
            )}
          </div>

          {/* Country */}
          <div>
            <label className="block text-xs mono text-muted-foreground mb-2">Страна назначения</label>
            <div className="grid grid-cols-5 gap-1.5">
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => setCountry(c.code)}
                  className={`px-2 py-2 rounded-xl text-xs font-medium border transition-all ${
                    country === c.code
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/40 bg-secondary/30 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {c.code}
                </button>
              ))}
            </div>
          </div>

          {/* Next button */}
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold glow-cyan hover-scale disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            Далее — AML-проверка <Icon name="ArrowRight" size={17} />
          </button>
        </div>
      )}

      {/* ── STEP: aml ──────────────────────────────────────────────────── */}
      {step === 'aml' && aml && meta && (
        <div className="space-y-4 animate-fade-in">

          {/* Big risk card */}
          <div className={`glass rounded-3xl border p-7 ${meta.bg}`}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className={`text-xs mono mb-1.5 ${meta.color}`}>AML · РЕЗУЛЬТАТ ПРОВЕРКИ</div>
                <h2 className="font-display text-2xl font-bold">{meta.label}</h2>
              </div>
              <div className={`w-16 h-16 rounded-2xl grid place-items-center ${
                aml.recommendation === 'APPROVE' ? 'bg-[hsl(var(--neon-lime))]/15' :
                aml.recommendation === 'MANUAL_REVIEW' ? 'bg-yellow-400/15' : 'bg-destructive/15'
              }`}>
                <Icon name={meta.icon} size={32} className={meta.color} />
              </div>
            </div>

            {/* Score bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mono mb-1.5">
                <span className="text-muted-foreground">Риск-скор</span>
                <span className={meta.color}>{aml.risk_score} / 100</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-background/25 overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                  style={{ width: `${aml.risk_score}%` }} />
              </div>
              <div className="flex justify-between text-[10px] mono text-muted-foreground mt-1">
                <span>0 — Чисто</span><span>40 — Ручная</span><span>80+ — Блок</span>
              </div>
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className={`inline-flex items-center gap-1.5 text-xs mono px-2.5 py-1 rounded-lg border ${
                aml.is_sanctioned ? 'text-destructive bg-destructive/10 border-destructive/30' : 'text-muted-foreground bg-secondary/40 border-border/30'
              }`}>
                <Icon name={aml.is_sanctioned ? 'XCircle' : 'CheckCircle2'} size={11} />
                Санкционный список
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs mono px-2.5 py-1 rounded-lg border ${
                aml.is_mixer ? 'text-destructive bg-destructive/10 border-destructive/30' : 'text-muted-foreground bg-secondary/40 border-border/30'
              }`}>
                <Icon name={aml.is_mixer ? 'XCircle' : 'CheckCircle2'} size={11} />
                Миксер / CoinJoin
              </span>
            </div>

            {/* Reasons */}
            <div className="space-y-1.5">
              {aml.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Icon name="ChevronRight" size={13} className={`${meta.color} mt-0.5 shrink-0`} />
                  <span className="text-muted-foreground">{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment summary */}
          <div className="glass rounded-2xl border border-border/60 p-5">
            <div className="text-xs mono text-muted-foreground mb-3">ДЕТАЛИ ПЕРЕВОДА</div>
            <div className="space-y-2.5">
              {[
                { l: 'Сумма', v: `${amount} ${fromNetwork.sym}` },
                { l: 'Маршрут', v: `${fromNetwork.label} → ${toNetwork.label}` },
                { l: 'Адрес', v: address.length > 24 ? address.slice(0, 12) + '…' + address.slice(-8) : address },
              ].map(x => (
                <div key={x.l} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{x.l}</span>
                  <span className="font-medium mono">{x.v}</span>
                </div>
              ))}
            </div>
          </div>

          {sendError && (
            <div className="text-sm text-destructive flex items-center gap-2 px-1">
              <Icon name="AlertCircle" size={14} /> {sendError}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2">
            {/* REJECT — нельзя отправить стандартным способом */}
            {aml.recommendation === 'REJECT' && (
              <>
                <div className="glass rounded-xl border border-destructive/30 p-4 text-sm text-destructive flex items-start gap-2.5">
                  <Icon name="Ban" size={16} className="shrink-0 mt-0.5" />
                  <span>Автоматическая отправка заблокирована. Адрес не прошёл AML-фильтр. Вы можете направить на ручную проверку compliance-офицеру.</span>
                </div>
                {!forceSubmit ? (
                  <button
                    onClick={() => setForceSubmit(true)}
                    className="w-full py-3.5 rounded-xl border border-destructive/40 text-destructive font-semibold hover:bg-destructive/10 transition-all flex items-center justify-center gap-2"
                  >
                    <Icon name="ShieldAlert" size={16} /> Всё равно отправить (на ручную проверку)
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    className="w-full py-3.5 rounded-xl bg-destructive/90 text-white font-semibold hover-scale flex items-center justify-center gap-2 animate-fade-in"
                  >
                    <Icon name="AlertTriangle" size={16} /> Подтверждаю — отправить на ручную проверку
                  </button>
                )}
              </>
            )}

            {/* MANUAL_REVIEW */}
            {aml.recommendation === 'MANUAL_REVIEW' && (
              <button
                onClick={handleSend}
                className="w-full py-3.5 rounded-xl bg-yellow-500/90 text-background font-semibold hover-scale flex items-center justify-center gap-2"
              >
                <Icon name="Send" size={17} /> Отправить (с пометкой на проверку)
              </button>
            )}

            {/* APPROVE */}
            {aml.recommendation === 'APPROVE' && (
              <button
                onClick={handleSend}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold glow-cyan hover-scale flex items-center justify-center gap-2"
              >
                <Icon name="Send" size={17} /> Отправить платёж
              </button>
            )}

            <button
              onClick={() => { setStep('form'); setForceSubmit(false); }}
              className="w-full py-3 rounded-xl glass border border-border/50 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Назад к форме
            </button>
          </div>
        </div>
      )}

      {/* Fallback: aml step but no result yet (edge case) */}
      {step === 'aml' && !aml && (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="Loader" size={28} className="animate-spin mx-auto mb-3" />
          <p className="text-sm">Загрузка результатов AML...</p>
        </div>
      )}
    </div>
  );
}
