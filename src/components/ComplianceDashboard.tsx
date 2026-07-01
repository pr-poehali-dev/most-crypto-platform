import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';

const PENDING_URL = 'https://functions.poehali.dev/30cbda0e-a401-4771-99ae-9526937b05db';
const APPROVE_URL = 'https://functions.poehali.dev/9cec00cd-a2d5-4d4a-96b8-ddb169426cc6';

type SortField = 'risk_score' | 'amount' | 'created_at';
type SortOrder = 'desc' | 'asc';
type RiskLevel  = 'high' | 'medium' | 'low';

interface PendingPayment {
  id: string;
  user_email: string;
  user_company: string | null;
  from_currency: string;
  to_currency: string;
  amount: number;
  destination_country: string;
  destination_address: string;
  risk_score: number;
  risk_level: RiskLevel;
  created_at: string;
}

interface ApiResponse {
  total: number;
  limit: number;
  offset: number;
  items: PendingPayment[];
}

type ActionState = 'idle' | 'loading' | 'done' | 'error';

const RISK_META: Record<RiskLevel, { label: string; cls: string; bar: string }> = {
  high:   { label: 'Высокий',   cls: 'text-destructive bg-destructive/10 border-destructive/30', bar: 'bg-destructive' },
  medium: { label: 'Средний',   cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',   bar: 'bg-yellow-400' },
  low:    { label: 'Низкий',    cls: 'neon-lime bg-[hsl(var(--neon-lime))]/10 border-[hsl(var(--neon-lime))]/30', bar: 'bg-[hsl(var(--neon-lime))]' },
};

function RiskBadge({ level, score }: { level: RiskLevel; score: number }) {
  const m = RISK_META[level];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs mono font-medium px-2 py-0.5 rounded-md border ${m.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.bar}`} />
      {m.label} · {score}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const level: RiskLevel = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';
  const m = RISK_META[level];
  return (
    <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${m.bar}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function SortBtn({ field, current, order, onClick }: {
  field: SortField; current: SortField; order: SortOrder; onClick: () => void;
}) {
  const active = field === current;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-xs mono px-2 py-1 rounded-md border transition-all ${
        active
          ? 'border-primary/50 bg-primary/10 text-primary'
          : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border'
      }`}
    >
      {field === 'risk_score' ? 'Риск' : field === 'amount' ? 'Сумма' : 'Дата'}
      {active && <Icon name={order === 'desc' ? 'ArrowDown' : 'ArrowUp'} size={10} />}
    </button>
  );
}

function truncAddr(addr: string) {
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtAmount(n: number) {
  return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function ComplianceDashboard() {
  const [data, setData]           = useState<ApiResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [sortBy, setSortBy]       = useState<SortField>('risk_score');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [offset, setOffset]       = useState(0);
  const LIMIT = 20;

  // action modal
  const [selected, setSelected]   = useState<PendingPayment | null>(null);
  const [action, setAction]       = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason]       = useState('');
  const [actState, setActState]   = useState<ActionState>('idle');
  const [actError, setActError]   = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('most_token') || '';
      const url = `${PENDING_URL}?sort_by=${sortBy}&order=${sortOrder}&limit=${LIMIT}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [sortBy, sortOrder, offset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setOffset(0);
  }

  async function submitAction() {
    if (!selected || !action) return;
    if (action === 'reject' && !reason.trim()) {
      setActError('Укажите причину отклонения');
      return;
    }
    setActState('loading');
    setActError('');
    try {
      const token = localStorage.getItem('most_token') || '';
      const res = await fetch(APPROVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ order_id: selected.id, action, reason: reason.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setActState('done');
      setTimeout(() => {
        setSelected(null);
        setAction(null);
        setReason('');
        setActState('idle');
        fetchData();
      }, 1200);
    } catch (e) {
      setActState('error');
      setActError(e instanceof Error ? e.message : 'Ошибка');
    }
  }

  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const highCount   = items.filter(i => i.risk_level === 'high').length;
  const mediumCount = items.filter(i => i.risk_level === 'medium').length;
  const totalPages  = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs mono text-muted-foreground mb-1">
            <Icon name="ShieldCheck" size={14} className="neon-cyan" />
            AML · COMPLIANCE QUEUE
          </div>
          <h1 className="font-display text-2xl font-bold">Очередь проверки</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass border border-border/60 text-sm hover-scale disabled:opacity-50"
        >
          <Icon name={loading ? 'Loader' : 'RefreshCw'} size={15} className={loading ? 'animate-spin' : ''} />
          Обновить
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="glass rounded-xl p-4 text-center">
          <div className="font-display text-3xl font-bold neon-cyan">{total}</div>
          <div className="text-xs text-muted-foreground mt-1">Всего на проверке</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="font-display text-3xl font-bold text-destructive">{highCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Высокий риск</div>
        </div>
        <div className="glass rounded-xl p-4 text-center">
          <div className="font-display text-3xl font-bold text-yellow-400">{mediumCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Средний риск</div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-muted-foreground mr-1">Сортировка:</span>
        {(['risk_score', 'amount', 'created_at'] as SortField[]).map(f => (
          <SortBtn key={f} field={f} current={sortBy} order={sortOrder} onClick={() => toggleSort(f)} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-4 border border-destructive/30 text-destructive text-sm mb-4 flex items-center gap-2">
          <Icon name="AlertTriangle" size={16} /> {error}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && items.length === 0 && (
        <div className="glass rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 grid place-items-center mx-auto mb-4">
            <Icon name="CheckCircle2" size={32} className="text-primary" />
          </div>
          <div className="font-display text-lg font-semibold mb-1">Очередь пуста</div>
          <div className="text-sm text-muted-foreground">Все платежи проверены — отличная работа</div>
        </div>
      )}

      {/* Table */}
      {items.length > 0 && (
        <div className="glass rounded-2xl overflow-hidden border border-border/60">
          {/* Table header */}
          <div className="hidden lg:grid grid-cols-[1fr_120px_130px_110px_100px_160px] gap-3 px-5 py-3 border-b border-border/50 text-xs mono text-muted-foreground">
            <span>Клиент / Адрес</span>
            <span>Сумма</span>
            <span>Маршрут</span>
            <span>Риск</span>
            <span>Создан</span>
            <span className="text-right">Действия</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/40">
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="grid lg:grid-cols-[1fr_120px_130px_110px_100px_160px] gap-3 items-center px-5 py-4 hover:bg-secondary/20 transition-colors animate-fade-in"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                {/* Client */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                      <Icon name="Building2" size={14} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.user_company || '—'}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.user_email}</div>
                    </div>
                  </div>
                  <div className="mt-1.5 ml-9 flex items-center gap-1.5 text-xs mono text-muted-foreground">
                    <Icon name="MapPin" size={10} />
                    <span>{item.destination_country}</span>
                    <span className="mx-1 text-border">·</span>
                    <span className="truncate">{truncAddr(item.destination_address)}</span>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <div className="font-display font-semibold text-sm">{fmtAmount(item.amount)}</div>
                  <div className="text-xs text-muted-foreground mono">{item.from_currency}</div>
                </div>

                {/* Route */}
                <div className="flex items-center gap-1.5 text-xs mono">
                  <span className="text-muted-foreground">{item.from_currency}</span>
                  <Icon name="ArrowRight" size={10} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">{item.to_currency}</span>
                </div>

                {/* Risk */}
                <div className="space-y-1.5">
                  <RiskBadge level={item.risk_level} score={item.risk_score} />
                  <RiskBar score={item.risk_score} />
                </div>

                {/* Date */}
                <div className="text-xs mono text-muted-foreground hidden lg:block">
                  {fmtDate(item.created_at)}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setSelected(item); setAction('approve'); setReason(''); setActState('idle'); setActError(''); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[hsl(var(--neon-lime))]/10 neon-lime border border-[hsl(var(--neon-lime))]/25 hover:bg-[hsl(var(--neon-lime))]/20 transition-all"
                  >
                    <Icon name="Check" size={13} /> Одобрить
                  </button>
                  <button
                    onClick={() => { setSelected(item); setAction('reject'); setReason(''); setActState('idle'); setActError(''); }}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/25 hover:bg-destructive/20 transition-all"
                  >
                    <Icon name="X" size={13} /> Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-xs mono text-muted-foreground">
            Стр. {currentPage} из {totalPages} · {total} платежей
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              disabled={offset === 0}
              className="px-3 py-1.5 rounded-lg glass border border-border/50 text-xs disabled:opacity-40 hover-scale"
            >
              <Icon name="ChevronLeft" size={14} />
            </button>
            <button
              onClick={() => setOffset(o => o + LIMIT)}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 rounded-lg glass border border-border/50 text-xs disabled:opacity-40 hover-scale"
            >
              <Icon name="ChevronRight" size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {selected && action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => { if (actState !== 'loading') setSelected(null); }}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <div
            className="relative glass rounded-2xl border border-border/60 w-full max-w-md p-6 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className={`text-xs mono mb-1 ${action === 'approve' ? 'neon-lime' : 'text-destructive'}`}>
                  {action === 'approve' ? '✓ ОДОБРЕНИЕ ПЛАТЕЖА' : '✕ ОТКЛОНЕНИЕ ПЛАТЕЖА'}
                </div>
                <h3 className="font-display text-lg font-semibold">
                  {action === 'approve' ? 'Подтвердите одобрение' : 'Подтвердите отклонение'}
                </h3>
              </div>
              <button
                onClick={() => { if (actState !== 'loading') setSelected(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Payment summary */}
            <div className="bg-secondary/40 rounded-xl p-4 mb-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Клиент</span>
                <span className="font-medium truncate ml-4">{selected.user_company || selected.user_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Сумма</span>
                <span className="font-display font-semibold">{fmtAmount(selected.amount)} {selected.from_currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Адрес</span>
                <span className="mono text-xs">{truncAddr(selected.destination_address)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Риск-скор</span>
                <RiskBadge level={selected.risk_level} score={selected.risk_score} />
              </div>
            </div>

            {/* Reject reason */}
            {action === 'reject' && (
              <div className="mb-4">
                <label className="block text-xs mono text-muted-foreground mb-2">
                  Причина отклонения <span className="text-destructive">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Укажите причину — будет сохранено в аудит-логе..."
                  rows={3}
                  className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            )}

            {actError && (
              <div className="text-xs text-destructive mb-3 flex items-center gap-1.5">
                <Icon name="AlertCircle" size={13} /> {actError}
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { if (actState !== 'loading') setSelected(null); }}
                className="flex-1 px-4 py-2.5 rounded-xl glass border border-border/50 text-sm hover-scale"
              >
                Отмена
              </button>
              <button
                onClick={submitAction}
                disabled={actState === 'loading' || actState === 'done'}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover-scale disabled:opacity-60 ${
                  actState === 'done'
                    ? 'bg-[hsl(var(--neon-lime))]/20 neon-lime border border-[hsl(var(--neon-lime))]/40'
                    : action === 'approve'
                    ? 'bg-primary text-primary-foreground glow-cyan'
                    : 'bg-destructive text-white'
                }`}
              >
                {actState === 'loading' && <Icon name="Loader" size={15} className="animate-spin" />}
                {actState === 'done'    && <Icon name="CheckCircle2" size={15} />}
                {actState === 'done'
                  ? 'Готово'
                  : actState === 'loading'
                  ? 'Отправка...'
                  : action === 'approve' ? 'Одобрить' : 'Отклонить'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}