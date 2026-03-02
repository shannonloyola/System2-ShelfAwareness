import { useState, useEffect } from 'react';
import {
  runExpirationCheck, fetchExpiringSoon, fetchExpiredPOs
} from '../../../imports/expirationService';

export default function ExpirationDashboard() {
  const [expiringSoon, setExpiringSoon] = useState<any[]>([]);
  const [expiredPOs, setExpiredPOs]     = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [running, setRunning]           = useState(false);
  const [lastRun, setLastRun]           = useState<Date | null>(null);
  const [released, setReleased]         = useState<any[]>([]);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [soon, expired] = await Promise.all([
        fetchExpiringSoon(),
        fetchExpiredPOs(),
      ]);
      setExpiringSoon(soon);
      setExpiredPOs(expired);
    } catch (e: any) { showToast(e.message, false); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Auto-run every 15 minutes in the frontend as backup
  useEffect(() => {
    const interval = setInterval(() => handleRun(), 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runExpirationCheck();
      setReleased(result ?? []);
      setLastRun(new Date());
      await loadData();
      if (result?.length > 0) {
        showToast(`✓ Released stock from ${result.length} expired PO(s)`);
      } else {
        showToast('✓ Check complete — no expired reservations found');
      }
    } catch (e: any) { showToast(e.message, false); }
    setRunning(false);
  };

  const timeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m remaining`;
  };

  return (
    <div style={s.page}>
      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#166534' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Expiration Service</h1>
          <p style={s.sub}>
            Unreleased reservations free up automatically every 15 min via pg_cron
            {lastRun && <> · Last manual run: {lastRun.toLocaleTimeString()}</>}
          </p>
        </div>
        <button style={{ ...s.primaryBtn, opacity: running ? 0.6 : 1 }}
          disabled={running} onClick={handleRun}>
          {running ? '⏳ Running…' : '▶ Run Check Now'}
        </button>
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { label: 'Expiring in 2hrs', value: expiringSoon.length, color: '#D97706', bg: '#FEF9C3' },
          { label: 'Already Expired', value: expiredPOs.length,   color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Released This Run', value: released.length,   color: '#16A34A', bg: '#DCFCE7' },
        ].map((stat) => (
          <div key={stat.label} style={{ ...s.statCard, background: stat.bg }}>
            <strong style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</strong>
            <span style={{ fontSize: 12, color: stat.color, fontWeight: 600 }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Expiring Soon */}
      <div style={s.card}>
        <p style={s.cardLabel}>⚠ EXPIRING SOON (within 2 hours)</p>
        {loading ? <p style={s.empty}>Loading…</p>
          : expiringSoon.length === 0 ? (
            <p style={s.empty}>No reservations expiring soon</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['PO Number', 'Supplier', 'Status', 'Reserved At', 'Expires At', 'Time Left'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiringSoon.map(po => (
                  <tr key={po.po_id} style={s.tr}>
                    <td style={s.td}><strong>{po.po_no}</strong></td>
                    <td style={s.td}>{po.supplier_name}</td>
                    <td style={s.td}>
                      <span style={s.statusChip}>{po.status}</span>
                    </td>
                    <td style={s.td}><span style={s.mono}>{new Date(po.reserved_at).toLocaleString()}</span></td>
                    <td style={s.td}><span style={s.mono}>{new Date(po.expires_at).toLocaleString()}</span></td>
                    <td style={s.td}>
                      <span style={{ color: '#D97706', fontWeight: 600, fontSize: 13 }}>
                        {timeRemaining(po.expires_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Expired POs */}
      <div style={s.card}>
        <p style={s.cardLabel}>✕ EXPIRED — Stock Released</p>
        {loading ? <p style={s.empty}>Loading…</p>
          : expiredPOs.length === 0 ? (
            <p style={s.empty}>No expired reservations</p>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['PO Number', 'Supplier', 'Expired At', 'Status'].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expiredPOs.map(po => (
                  <tr key={po.po_id} style={s.tr}>
                    <td style={s.td}><strong>{po.po_no}</strong></td>
                    <td style={s.td}>{po.supplier_name}</td>
                    <td style={s.td}><span style={s.mono}>{new Date(po.expires_at).toLocaleString()}</span></td>
                    <td style={s.td}>
                      <span style={{ ...s.statusChip, background: '#FEE2E2', color: '#991B1B' }}>
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { maxWidth: 1000, margin: '0 auto', padding: '32px 20px', fontFamily: "'Segoe UI', sans-serif", color: '#111827' },
  header:     { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title:      { fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' },
  sub:        { fontSize: 13, color: '#6B7280', marginTop: 4 },
  primaryBtn: { background: '#2563EB', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 22px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  statsRow:   { display: 'flex', gap: 14, marginBottom: 4, flexWrap: 'wrap' },
  statCard:   { flex: 1, minWidth: 140, borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 4 },
  card:       { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 24, marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 },
  cardLabel:  { fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.08em' },
  table:      { width: '100%', borderCollapse: 'collapse', minWidth: 600 },
  th:         { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' },
  tr:         { borderBottom: '1px solid #F3F4F6' },
  td:         { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' },
  statusChip: { background: '#FEF9C3', color: '#854D0E', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  mono:       { fontFamily: 'monospace', fontSize: 12, color: '#6B7280' },
  empty:      { textAlign: 'center', color: '#9CA3AF', padding: 32, fontSize: 14 },
  toast:      { position: 'fixed', bottom: 28, right: 28, zIndex: 200, padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 500, color: '#fff', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' },
};
```

---

## How it all works
```
PO Created → expires_at = now() + 24hrs (auto via trigger)
     ↓
pg_cron runs every 15min → calls expire_reservations()
     ↓
Finds unpaid POs where expires_at < now()
     ↓
Sets status = "Expired"
Releases reserved_stock back to available_stock
Logs as "RESERVATION_EXPIRED" in movements table
```

---

## File placement
```
src/
  imports/
    expirationService.ts          ← new
  app/
    components/
      screens/
        ExpirationDashboard.tsx   ← new