import { useEffect, useMemo, useState, ReactNode } from 'react';
import { compute, days, fmtD, iso, uid, P, MONTHS, Data, Entry, LeaveType } from './logic';
import { load, save, exportData, importData } from './store';

type Tab = 'home' | 'history' | 'types' | 'more';
const n1 = (x: number) => String(Math.round(x * 10) / 10);
const REASONS = ['🤒 Medical', '🏠 Family', '✈️ Trip', '🧘 Personal', '🚨 Emergency', '🎉 Celebration'];
const COLORS = ['#c5a059', '#ff7a8a', '#6ee7b7', '#7aa2ff', '#c084fc', '#ffb86b', '#5eead4', '#8a8a99'];

const Ring = ({ pct, color, children }: { pct: number; color: string; children: ReactNode }) => {
  const r = 44, c = 2 * Math.PI * r;
  return <div className="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} className="trk" />
    <circle cx="50" cy="50" r={r} className="arc" stroke={color} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))} /></svg>
    <div className="ringin">{children}</div></div>;
};
const Sheet = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) =>
  <div className="scrim" onClick={onClose}><div className="sheet" onClick={e => e.stopPropagation()}>
    <div className="grab" /><h2>{title}</h2>{children}</div></div>;

export default function App() {
  const [d, setD] = useState<Data | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [edit, setEdit] = useState<Partial<Entry> | null>(null);
  const [editT, setEditT] = useState<LeaveType | null>(null);
  const [fType, setFType] = useState('all');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [paste, setPaste] = useState(false);
  const [vc, setVc] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { load().then(setD); }, []);
  useEffect(() => { const f = () => setTick(t => t + 1); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
  useEffect(() => { if (d) document.documentElement.style.setProperty('--gold', d.settings.accent); }, [d?.settings.accent]);
  const res = useMemo(() => d ? compute(d) : null, [d, tick]);
  if (!d || !res) return <div className="boot">Loading…</div>;
  const commit = (n: Data) => { setD(n); save(n).catch(() => setMsg('⚠️ Could not save — export a backup')); };
  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2200); };
  const T = (id: string) => d.types.find(t => t.id === id);
  const cv = Math.min(res.gLast, Math.max(res.gFirst, vc ?? res.cur)), lw = res.lwp[cv] || 0;
  const cycLabel = (c: number) => d.settings.cycleStart === 0 && d.settings.cycleDay === 1 ? String(c) : `${d.settings.cycleDay} ${MONTHS[d.settings.cycleStart]} ${c} – ${c + 1}`;

  const Row = ({ e }: { e: Entry }) => { const t = T(e.typeId), s = res.split[e.id]; if (!t || !s) return null;
    return <div className="row" onClick={() => setEdit(e)}>
      <div className="dot" style={{ background: t.color + '33', color: t.color }}>{t.emoji}</div>
      <div className="grow"><b>{fmtD(e.start)}{e.start !== e.end && ` → ${fmtD(e.end)}`}</b><small>{[e.reason, e.notes].filter(Boolean).join(' · ') || t.name}</small></div>
      <div className="rt"><b>{n1(s.paid + s.lwp)}d</b>{s.lwp > 0 && !t.unpaid && <span className="pill warn">{n1(s.lwp)} LWP</span>}</div></div>; };

  const sorted = [...d.entries].sort((a, b) => b.start.localeCompare(a.start));
  const list = sorted.filter(e => (fType === 'all' || e.typeId === fType) && (!q || e.reason.toLowerCase().includes(q.toLowerCase())));
  const byMonth: Record<string, Entry[]> = {};
  list.forEach(e => { const k = e.start.slice(0, 7); (byMonth[k] ||= []).push(e); });

  return <div className="app">
    <main>
      {tab === 'home' && <>
        <header><small>Leave Ledger</small><h1>Your leaves</h1>
          <div className="cyc"><button disabled={cv <= res.gFirst} onClick={() => setVc(cv - 1)}>‹</button><span>{cycLabel(cv)}{cv === res.cur ? ' · now' : ''}</span><button disabled={cv >= res.gLast} onClick={() => setVc(cv + 1)}>›</button></div></header>
        {d.types.filter(t => !t.unpaid).map(t => { const s = res.sum[t.id]?.[cv]; if (!s) return null; return (
          <div className="card hero" key={t.id} style={{ ['--c' as any]: t.color }}>
            <Ring pct={s.total ? s.used / s.total : 0} color={t.color}><b>{n1(s.balance)}</b><small>left</small></Ring>
            <div className="grow"><h3>{t.emoji} {t.name}</h3>
              <p>{n1(s.used)} used of {n1(s.credited)} earned so far</p>
              <p className="dim">{t.accrual === 'monthly' ? `+${n1(t.quota / 12)}/month · ` : ''}{n1(s.total)} this year{s.carry > 0 ? ` (incl. ${n1(s.carry)} carried)` : ''}</p>
              {s.lwp > 0 && <span className="pill warn">{n1(s.lwp)} days became LWP</span>}</div></div>); })}
        {lw > 0 && <div className="card lwp"><span>🌫️</span><div className="grow"><b>{n1(lw)} days without pay</b><small>this cycle, counted automatically</small></div></div>}
        <h4>Month by month</h4>
        <div className="mstrip">{Array.from({ length: 12 }, (_, i) => { const u = res.monthly[cv]?.[i] || 0;
          return <div key={i}><b>{u ? n1(u) : ''}</b><i style={{ height: 4 + Math.min(56, u * 6), opacity: u ? 1 : .25 }} /><small>{MONTHS[(d.settings.cycleStart + i) % 12][0]}</small></div>; })}</div>
        <h4>Recent</h4>
        {sorted.slice(0, 5).map(e => <Row key={e.id} e={e} />)}
        {!sorted.length && <p className="empty">No leaves yet. Tap ＋ when you take one 🌴</p>}
      </>}
      {tab === 'history' && <>
        <header><h1>History</h1></header>
        <input className="in" placeholder="Search reasons…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="chips">{[{ id: 'all', name: 'All', emoji: '' }, ...d.types].map(t =>
          <button key={t.id} className={fType === t.id ? 'on' : ''} onClick={() => setFType(t.id)}>{t.emoji} {t.name}</button>)}</div>
        {Object.keys(byMonth).sort().reverse().map(k => <section key={k}>
          <h4>{MONTHS[+k.slice(5) - 1]} {k.slice(0, 4)} · {n1(byMonth[k].reduce((a, e) => a + days(e, d.settings), 0))}d</h4>
          {byMonth[k].map(e => <Row key={e.id} e={e} />)}</section>)}
        {!list.length && <p className="empty">Nothing here.</p>}
      </>}
      {tab === 'types' && <>
        <header><h1>Leave types</h1><small>Set up any company's policy — no code needed</small></header>
        {d.types.map(t => <div className="row" key={t.id} onClick={() => setEditT(t)}>
          <div className="dot" style={{ background: t.color + '33', color: t.color }}>{t.emoji}</div>
          <div className="grow"><b>{t.name}</b><small>{t.unpaid ? 'Unpaid · no balance' : `${t.quota}/yr · ${t.accrual === 'monthly' ? 'accrues monthly' : 'credited upfront'} · carry ${t.carryCap ? 'up to ' + t.carryCap : 'none'}`}</small></div>›</div>)}
        <button className="btn" onClick={() => setEditT({ id: '', name: '', emoji: '🗓️', color: COLORS[3], quota: 12, accrual: 'upfront', carryCap: 0 })}>＋ New leave type</button>
      </>}
      {tab === 'more' && <>
        <header><h1>Settings</h1></header>
        <div className="card"><label>Leave year starts in</label>
          <select className="in" value={d.settings.cycleStart} onChange={e => commit({ ...d, settings: { ...d.settings, cycleStart: +e.target.value } })}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}</select>
          <select className="in" value={d.settings.cycleDay} onChange={e => commit({ ...d, settings: { ...d.settings, cycleDay: +e.target.value } })}>
            {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}</select>
          <label>Accent colour</label><div className="chips sw">{COLORS.map(c => <button key={c} className={d.settings.accent === c ? 'on' : ''} style={{ background: c }} onClick={() => commit({ ...d, settings: { ...d.settings, accent: c } })} />)}</div>
          <label className="tog"><input type="checkbox" checked={d.settings.skipWeekends} onChange={e => commit({ ...d, settings: { ...d.settings, skipWeekends: e.target.checked } })} /> Skip Sat/Sun by default (changeable per leave)</label></div>
        <div className="card"><b>Backup</b><small>Updates never erase data, but keep a copy anyway.</small>
          <button className="btn" onClick={() => exportData(d).catch(() => toast('Export failed'))}>⬆️ Export backup</button>
          <label className="btn ghost">⬇️ Import backup<input hidden type="file" accept=".json,application/json" onChange={async e => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const n = importData(await f.text()); if (confirm(`Replace current data with ${n.entries.length} leaves from backup?`)) { commit(n); toast('Imported ✓'); } }
            catch { toast('Not a valid backup file'); } e.target.value = ''; }} /></label>
          <button className="btn ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(d)).then(() => toast('Copied ✓'), () => toast('Copy failed'))}>📋 Copy backup text</button>
          <button className="btn ghost" onClick={() => setPaste(true)}>📥 Paste backup text</button></div>
      </>}
    </main>

    <button className="fab" onClick={() => setEdit({})}>＋</button>
    <nav>{([['home', '🏠', 'Home'], ['history', '🗓️', 'History'], ['types', '🎨', 'Types'], ['more', '⚙️', 'More']] as const).map(([k, i, l]) =>
      <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</button>)}</nav>
    {msg && <div className="toast">{msg}</div>}

    {edit && <EntrySheet d={d} e={edit} onClose={() => setEdit(null)}
      onSave={f => { commit({ ...d, entries: [...d.entries.filter(x => x.id !== f.id), f] }); setEdit(null); toast('Saved ✓'); }}
      onDel={id => { if (confirm('Delete this leave?')) { commit({ ...d, entries: d.entries.filter(x => x.id !== id) }); setEdit(null); } }} />}
    {paste && <PasteSheet onClose={() => setPaste(false)} onImport={n => { commit(n); setPaste(false); toast('Imported ✓'); }} />}
    {editT && <TypeSheet t={editT} onClose={() => setEditT(null)}
      onSave={t => { const nt = { ...t, id: t.id || uid() }; commit({ ...d, types: d.types.some(x => x.id === nt.id) ? d.types.map(x => x.id === nt.id ? nt : x) : [...d.types, nt] }); setEditT(null); }}
      onDel={id => { if (d.entries.some(e => e.typeId === id)) return toast('This type has leaves logged — move or delete them first');
        if (confirm('Delete this type?')) { commit({ ...d, types: d.types.filter(x => x.id !== id) }); setEditT(null); } }} />}
  </div>;
}

function EntrySheet({ d, e, onClose, onSave, onDel }: { d: Data; e: Partial<Entry>; onClose: () => void; onSave: (e: Entry) => void; onDel: (id: string) => void }) {
  const t0 = iso(new Date());
  const [f, setF] = useState<Entry>({ id: e.id || '', typeId: e.typeId || d.types.find(t => !t.unpaid)?.id || d.types[0].id,
    start: e.start || t0, end: e.end || e.start || t0, half: !!e.half, reason: e.reason || '', notes: e.notes || '', skipWeekends: e.skipWeekends ?? d.settings.skipWeekends });
  const clash = d.entries.find(x => x.id !== f.id && x.start <= f.end && f.start <= x.end);
  const set = (p: Partial<Entry>) => setF(x => { const n = { ...x, ...p }; if (n.end < n.start) n.end = n.start; if (n.start !== n.end) n.half = false; return n; });
  const prev = useMemo(() => { const id = f.id || '__new'; const r = compute({ ...d, entries: [...d.entries.filter(x => x.id !== f.id), { ...f, id }] });
    return { n: days(f, d.settings), s: r.split[id] }; }, [f, d]);
  return <Sheet title={e.id ? 'Edit leave' : 'Log a leave'} onClose={onClose}>
    <div className="chips">{d.types.map(t => <button key={t.id} className={f.typeId === t.id ? 'on' : ''} style={f.typeId === t.id ? { background: t.color, color: '#000' } : {}} onClick={() => set({ typeId: t.id })}>{t.emoji} {t.name}</button>)}</div>
    <div className="two"><div><label>From</label><input className="in" type="date" value={f.start} onChange={x => x.target.value && set({ start: x.target.value })} /></div>
      <div><label>To</label><input className="in" type="date" value={f.end} min={f.start} onChange={x => x.target.value && set({ end: x.target.value })} /></div></div>
    {f.start === f.end && <label className="tog"><input type="checkbox" checked={!!f.half} onChange={x => set({ half: x.target.checked })} /> Half day</label>}
    {!f.half && <label className="tog"><input type="checkbox" checked={f.skipWeekends !== false} onChange={x => set({ skipWeekends: x.target.checked })} /> Skip weekends</label>}
    <label>Why?</label><input className="in" placeholder="Reason (optional)" value={f.reason} onChange={x => set({ reason: x.target.value })} />
    <div className="chips">{REASONS.map(r => <button key={r} onClick={() => set({ reason: r })}>{r}</button>)}</div>
    <input className="in" placeholder="Notes (optional)" value={f.notes || ''} onChange={x => set({ notes: x.target.value })} />
    {clash && <p className="err">Overlaps your leave on {fmtD(clash.start)}{clash.start !== clash.end && ` → ${fmtD(clash.end)}`} — edit that one instead.</p>}
    <div className={'card prev' + (prev.s?.lwp ? ' warnbox' : '')}><b>{n1(prev.n)} day{prev.n === 1 ? '' : 's'}</b>
      {prev.s && !T(d, f.typeId)?.unpaid && <span> → {n1(prev.s.paid)} paid{prev.s.lwp > 0 && <> + <b>{n1(prev.s.lwp)} LWP</b> (balance ran out)</>}</span>}
      {prev.n === 0 && <span> — no working days in this range</span>}</div>
    <button className="btn" disabled={prev.n === 0 || !!clash} onClick={() => onSave({ ...f, id: f.id || uid() })}>Save</button>
    {e.id && <button className="btn danger" onClick={() => onDel(e.id!)}>Delete</button>}
  </Sheet>;
}
const T = (d: Data, id: string) => d.types.find(t => t.id === id);

function TypeSheet({ t, onClose, onSave, onDel }: { t: LeaveType; onClose: () => void; onSave: (t: LeaveType) => void; onDel: (id: string) => void }) {
  const [f, setF] = useState(t); const set = (p: Partial<LeaveType>) => setF(x => ({ ...x, ...p }));
  return <Sheet title={t.id ? 'Edit type' : 'New leave type'} onClose={onClose}>
    <div className="two"><div style={{ flex: '0 0 70px' }}><label>Icon</label><input className="in" value={f.emoji} maxLength={4} onChange={x => set({ emoji: x.target.value })} /></div>
      <div><label>Name</label><input className="in" value={f.name} onChange={x => set({ name: x.target.value })} placeholder="e.g. Casual Leave" /></div></div>
    <div className="chips sw">{COLORS.map(c => <button key={c} className={f.color === c ? 'on' : ''} style={{ background: c }} onClick={() => set({ color: c })} />)}</div>
    <label className="tog"><input type="checkbox" checked={!!f.unpaid} onChange={x => set({ unpaid: x.target.checked })} /> Unpaid (no balance, like LWP)</label>
    {!f.unpaid && <>
      <div className="two"><div><label>Days per year</label><input className="in" type="number" min={0} step="0.5" value={f.quota} onChange={x => set({ quota: Math.max(0, +x.target.value) })} /></div>
        <div><label>Carry over (max)</label><input className="in" type="number" min={0} value={f.carryCap} onChange={x => set({ carryCap: Math.max(0, +x.target.value) })} /></div></div>
      <label>Credited</label><div className="chips">{(['monthly', 'upfront'] as const).map(a => <button key={a} className={f.accrual === a ? 'on' : ''} onClick={() => set({ accrual: a })}>{a === 'monthly' ? 'Monthly (quota ÷ 12)' : 'All at start of year'}</button>)}</div></>}
    <button className="btn" disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim() })}>Save</button>
    {t.id && <button className="btn danger" onClick={() => onDel(t.id)}>Delete</button>}
  </Sheet>;
}

function PasteSheet({ onClose, onImport }: { onClose: () => void; onImport: (n: Data) => void }) {
  const [t, setT] = useState(''); const [err, setErr] = useState('');
  return <Sheet title="Paste backup" onClose={onClose}>
    <p className="dim">Works with backups from the old Leave Management app too.</p>
    <textarea className="in" rows={8} value={t} onChange={x => setT(x.target.value)} />
    {err && <p className="err">{err}</p>}
    <button className="btn" onClick={() => { try { const n = importData(t); if (confirm(`Replace current data with ${n.entries.length} leaves?`)) onImport(n); } catch { setErr('That text is not a valid backup'); } }}>Import</button>
  </Sheet>;
}
