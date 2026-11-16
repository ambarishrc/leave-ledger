export type LeaveType = { id: string; name: string; emoji: string; color: string; quota: number;
  accrual: 'monthly' | 'upfront'; carryCap: number; unpaid?: boolean };
export type Entry = { id: string; typeId: string; start: string; end: string; half?: boolean; reason: string; notes?: string; skipWeekends?: boolean };
export type Settings = { cycleStart: number; cycleDay: number; skipWeekends: boolean; accent: string };
export type Data = { v: number; settings: Settings; types: LeaveType[]; entries: Entry[] };
export type Sum = { credited: number; used: number; carry: number; balance: number; total: number; lwp: number };

export const DEFAULT: Data = { v: 1, settings: { cycleStart: 0, cycleDay: 1, skipWeekends: true, accent: '#c5a059' }, entries: [], types: [
  { id: 'apl', name: 'Annual Paid Leave', emoji: '🌴', color: '#c5a059', quota: 30, accrual: 'monthly', carryCap: 0 },
  { id: 'lwp', name: 'Leave Without Pay', emoji: '🌫️', color: '#8a8a99', quota: 0, accrual: 'upfront', carryCap: 0, unpaid: true } ] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const P = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const fmtD = (s: string) => { const d = P(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

type DE = Pick<Entry, 'start' | 'end' | 'half' | 'skipWeekends'>;
export function dayList(e: DE, s: Settings): Date[] {
  const out: Date[] = [], skip = e.skipWeekends ?? s.skipWeekends, end = P(e.end);
  for (const d = P(e.start); d <= end; d.setDate(d.getDate() + 1)) { const w = d.getDay(); if (!(skip && (w === 0 || w === 6))) out.push(new Date(d)); }
  return out;
}
export const days = (e: DE, s: Settings) => e.half ? 0.5 : dayList(e, s).length;

/** Walks every leave year in order. Each day is charged to the year it falls in; whatever the balance can't cover becomes LWP. */
export function compute(d: Data, today = new Date()) {
  const S = d.settings;
  const idx = (dt: Date) => { const x = new Date(dt); x.setDate(x.getDate() - (S.cycleDay - 1)); return x.getFullYear() * 12 + x.getMonth() - S.cycleStart; };
  const cyc = (dt: Date) => Math.floor(idx(dt) / 12);
  const cur = cyc(today), tIdx = idx(today);
  type Part = { c: number; n: number; first: Date };
  const parts: Record<string, Part[]> = {}, monthly: Record<number, number[]> = {};
  let gFirst = cur, gLast = cur;
  for (const e of d.entries) {
    const m = new Map<number, Part>();
    for (const dt of e.half ? [P(e.start)] : dayList(e, S)) {
      const c = cyc(dt), n = e.half ? 0.5 : 1, p = m.get(c) || { c, n: 0, first: dt };
      p.n += n; m.set(c, p);
      const i = idx(dt); (monthly[c] ||= Array(12).fill(0))[i - c * 12] += n;
    }
    parts[e.id] = [...m.values()];
    parts[e.id].forEach(p => { gFirst = Math.min(gFirst, p.c); gLast = Math.max(gLast, p.c); });
  }
  const split: Record<string, { paid: number; lwp: number }> = {}, sum: Record<string, Record<number, Sum>> = {}, lwp: Record<number, number> = {};
  d.entries.forEach(e => split[e.id] = { paid: 0, lwp: 0 });
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  for (const t of d.types) {
    sum[t.id] = {}; let carry = 0;
    const es = d.entries.filter(e => e.typeId === t.id);
    for (let c = gFirst; c <= gLast; c++) {
      const items = es.flatMap(e => (parts[e.id] || []).filter(p => p.c === c).map(p => ({ e, ...p }))).sort((a, b) => +a.first - +b.first);
      const credit = (i: number) => r6(t.accrual === 'upfront' ? t.quota : t.quota / 12 * Math.min(12, Math.max(0, i - c * 12 + 1)));
      let used = 0, over = 0;
      for (const it of items) {
        if (t.unpaid) { split[it.e.id].lwp += it.n; over += it.n; continue; }
        const paid = Math.min(it.n, Math.max(0, r6(carry + credit(idx(it.first)) - used)));
        split[it.e.id].paid += paid; split[it.e.id].lwp += it.n - paid; used += paid; over += it.n - paid;
      }
      const cr = t.unpaid ? 0 : carry + credit(tIdx);
      sum[t.id][c] = { credited: cr, used, carry, balance: Math.max(0, cr - used), total: t.unpaid ? 0 : carry + t.quota, lwp: over };
      lwp[c] = (lwp[c] || 0) + over;
      if (!t.unpaid) carry = Math.min(Math.max(0, carry + t.quota - used), t.carryCap);
    }
  }
  return { split, sum, lwp, cur, gFirst, gLast, monthly };
}

const inr = (v: any, lo: number, hi: number, def: number) => { const n = Number(v); return Number.isFinite(n) && n >= lo && n <= hi ? Math.floor(n) : def; };

/** Accepts this app's backups AND the old "Leave Management" app's backups ({leaveSettings, leaveEntries}). */
function fromLegacy(r: any): Data {
  const L: any[] = Array.isArray(r) ? r : r.leaveEntries, s = (!Array.isArray(r) && r.leaveSettings) || {};
  const mon = s.allocationType === 'monthly_accrual';
  const apl: LeaveType = { ...DEFAULT.types[0], accrual: mon ? 'monthly' : 'upfront',
    quota: mon ? (Number(s.monthlyAccrualDays) || 2.5) * 12 : (Number(s.annualAllocatedDays) || 30) };
  return { v: 1, types: [apl, DEFAULT.types[1]],
    settings: { ...DEFAULT.settings, cycleStart: inr(s.resetMonth, 0, 11, 0), cycleDay: inr(s.resetDay, 1, 28, 1) },
    entries: L.filter(e => e && e.startDate && e.endDate && !String(e.id).startsWith('demo-')).map(e => ({
      id: String(e.id || uid()), typeId: 'apl', start: String(e.startDate), end: String(e.endDate),
      reason: String(e.reason || ''), notes: e.notes ? String(e.notes) : undefined, skipWeekends: e.skipWeekends !== false })) };
}

export function migrate(raw: any): Data {
  const d = raw && typeof raw === 'object' ? raw : {};
  if (Array.isArray(d) || Array.isArray(d.leaveEntries)) return fromLegacy(d);
  const st = { ...DEFAULT.settings, ...(d.settings || {}) };
  st.cycleDay = inr(st.cycleDay, 1, 28, 1); st.cycleStart = inr(st.cycleStart, 0, 11, 0);
  return { v: 1, settings: st, types: Array.isArray(d.types) && d.types.length ? d.types : DEFAULT.types,
    entries: Array.isArray(d.entries) ? d.entries.filter((e: any) => e && e.start && e.end && e.typeId) : [] };
}
