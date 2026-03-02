import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

type Direction = 'ALL' | 'IN' | 'OUT';

interface Movement {
  id: string;
  sku: string;
  product_name: string;
  movement_type: string;
  direction: 'IN' | 'OUT';
  qty: number;
  stock_before: number;
  stock_after: number;
  reference: string | null;
  notes: string | null;
  created_at: string;
  source: string;
}

const DIR_STYLE = {
  IN:  { bg: '#DCFCE7', color: '#166534', border: '#BBF7D0' },
  OUT: { bg: '#FEE2E2', color: '#991B1B', border: '#FECACA' },
};

const TYPE_COLORS: Record<string, string> = {
  GRN_RECEIPT:          '#1D4ED8',
  GRN_POST:             '#7C3AED',
  RECEIPT:              '#0891B2',
  'Manual Adjustment':  '#D97706',
  RESERVATION_EXPIRED:  '#DC2626',
  ADJUSTMENT:           '#EA580C',
  DISPATCH:             '#BE185D',
};

export default function MovementReport() {
  const [movements, setMovements]   = useState<Movement[]>([]);
  const [loading, setLoading]       = useState(false);
  const [skuSearch, setSkuSearch]   = useState('');
  const [direction, setDirection]   = useState<Direction>('ALL');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [skuOptions, setSkuOptions] = useState<string[]>([]);

  // Load SKU list for dropdown
  useEffect(() => {
    supabase.from('products').select('sku').order('sku')
      .then(({ data }) => setSkuOptions(data?.map(p => p.sku) ?? []));
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('movement_report')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    // Filter by SKU
    if (skuSearch.trim()) {
      query = query.ilike('sku', `%${skuSearch.trim()}%`);
    }

    // Filter by direction
    if (direction !== 'ALL') {
      query = query.eq('direction', direction);
    }

    // Filter by date range
    if (dateFrom) {
      query = query.gte('created_at', new Date(dateFrom).toISOString());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59);
      query = query.lte('created_at', end.toISOString());
    }

    const { data, error } = await query;
    if (!error) setMovements((data as Movement[]) ?? []);
    setLoading(false);
  }, [skuSearch, direction, dateFrom, dateTo]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => fetchMovements(), 300);
    return () => clearTimeout(t);
  }, [fetchMovements]);

  const totalIn  = movements.filter(m => m.direction === 'IN').reduce((s, m) => s + m.qty, 0);
  const totalOut = movements.filter(m => m.direction === 'OUT').reduce((s, m) => s + m.qty, 0);
  const netFlow  = totalIn - totalOut;

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Movement Report</h1>
          <p style={s.sub}>All IN and OUT stock movements — searchable by SKU</p>
        </div>
        <button style={s.refreshBtn} onClick={fetchMovements} disabled={loading}>
          {loading ? '⏳' : '↻'} Refresh
        </button>
      </div>

      {/* Filters */}
      <div style={s.filterRow}>
        {/* SKU Search */}
        <div style={s.searchWrap}>
          <span style={s.searchIcon}>⌕</span>
          <input
            style={s.searchInput}
            placeholder="Search by SKU or product name…"
            value={skuSearch}
            onChange={e => setSkuSearch(e.target.value)}
            list="sku-list"
          />
          <datalist id="sku-list">
            {skuOptions.map(sku => <option key={sku} value={sku} />)}
          </datalist>
          {skuSearch && (
            <button style={s.clearBtn} onClick={() => setSkuSearch('')}>✕</button>
          )}
        </div>

        {/* Direction filter */}
        <div style={s.dirBtns}>
          {(['ALL', 'IN', 'OUT'] as Direction[]).map(d => (
            <button
              key={d}
              style={{
                ...s.dirBtn,
                ...(direction === d ? s.dirBtnActive : {}),
                ...(d === 'IN' && direction === d ? { background: '#DCFCE7', color: '#166534', borderColor: '#BBF7D0' } : {}),
                ...(d === 'OUT' && direction === d ? { background: '#FEE2E2', color: '#991B1B', borderColor: '#FECACA' } : {}),
              }}
              onClick={() => setDirection(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Date range */}
        <input style={s.dateInput} type="date" value={dateFrom}
          onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: '#9CA3AF', fontSize: 13 }}>to</span>
        <input style={s.dateInput} type="date" value={dateTo}
          onChange={e => setDateTo(e.target.value)} />

        {/* Clear filters */}
        {(skuSearch || direction !== 'ALL' || dateFrom || dateTo) && (
          <button style={s.clearAllBtn} onClick={() => {
            setSkuSearch(''); setDirection('ALL');
            setDateFrom(''); setDateTo('');
          }}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { label: 'Total Movements', value: movements.length,       color: '#1D4ED8', bg: '#EFF6FF' },
          { label: 'Total IN',        value: `+${totalIn}`,          color: '#166534', bg: '#DCFCE7' },
          { label: 'Total OUT',       value: `-${totalOut}`,         color: '#991B1B', bg: '#FEE2E2' },
          { label: 'Net Flow',        value: netFlow >= 0 ? `+${netFlow}` : `${netFlow}`,
            color: netFlow >= 0 ? '#166534' : '#991B1B',
            bg: netFlow >= 0 ? '#DCFCE7' : '#FEE2E2' },
        ].map(stat => (
          <div key={stat.label} style={{ ...s.statCard, background: stat.bg }}>
            <strong style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontFamily: 'monospace' }}>
              {stat.value}
            </strong>
            <span style={{ fontSize: 11, color: stat.color, fontWeight: 600 }}>{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={s.tableWrap}>
        {loading ? (
          <p style={s.empty}>Loading movements…</p>
        ) : movements.length === 0 ? (
          <div style={s.emptyState}>
            <div style={{ fontSize: 32 }}>📋</div>
            <p style={{ color: '#6B7280', marginTop: 8 }}>
              {skuSearch ? `No movements found for "${skuSearch}"` : 'No movements found'}
            </p>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Date', 'SKU', 'Product', 'Type', 'Direction', 'Qty', 'Before', 'After', 'Reference', 'Notes'].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.id} style={s.tr}>
                  <td style={s.td}>
                    <span style={s.mono}>{new Date(m.created_at).toLocaleDateString()}</span>
                    <br />
                    <span style={{ ...s.mono, fontSize: 11 }}>{new Date(m.created_at).toLocaleTimeString()}</span>
                  </td>
                  <td style={s.td}><code style={s.skuCode}>{m.sku}</code></td>
                  <td style={s.td}><strong style={{ fontSize: 13 }}>{m.product_name}</strong></td>
                  <td style={s.td}>
                    <span style={{
                      ...s.typeChip,
                      background: (TYPE_COLORS[m.movement_type] ?? '#6B7280') + '18',
                      color: TYPE_COLORS[m.movement_type] ?? '#6B7280',
                    }}>
                      {m.movement_type}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{
                      ...s.dirChip,
                      background: DIR_STYLE[m.direction].bg,
                      color: DIR_STYLE[m.direction].color,
                      border: `1px solid ${DIR_STYLE[m.direction].border}`,
                    }}>
                      {m.direction === 'IN' ? '↑ IN' : '↓ OUT'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <strong style={{
                      fontFamily: 'monospace',
                      fontSize: 15,
                      color: m.direction === 'IN' ? '#16A34A' : '#DC2626',
                    }}>
                      {m.direction === 'IN' ? '+' : '-'}{Math.abs(m.qty)}
                    </strong>
                  </td>
                  <td style={{ ...s.td, ...s.mono }}>{m.stock_before ?? '—'}</td>
                  <td style={{ ...s.td, ...s.mono }}>{m.stock_after ?? '—'}</td>
                  <td style={s.td}>
                    {m.reference
                      ? <code style={s.refCode}>{m.reference}</code>
                      : <span style={{ color: '#D1D5DB' }}>—</span>}
                  </td>
                  <td style={{ ...s.td, maxWidth: 200 }}>
                    <span style={{ fontSize: 12, color: '#6B7280' }}>{m.notes ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
        Showing {movements.length} movements · Sources: movements + inventory_movements tables
      </p>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:        { maxWidth: 1200, margin: '0 auto', padding: '32px 20px', fontFamily: "'Segoe UI', sans-serif", color: '#111827' },
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title:       { fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' },
  sub:         { fontSize: 13, color: '#6B7280', marginTop: 4 },
  refreshBtn:  { background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: 8, padding: '9px 16px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
  filterRow:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 },
  searchWrap:  { position: 'relative', display: 'flex', alignItems: 'center', flex: 1, minWidth: 240 },
  searchIcon:  { position: 'absolute', left: 10, color: '#9CA3AF', fontSize: 17, pointerEvents: 'none' },
  searchInput: { width: '100%', background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 9, padding: '10px 36px 10px 32px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' },
  clearBtn:    { position: 'absolute', right: 10, background: '#E5E7EB', border: 'none', color: '#6B7280', width: 20, height: 20, borderRadius: '50%', fontSize: 10, cursor: 'pointer', display: 'grid', placeItems: 'center' },
  dirBtns:     { display: 'flex', gap: 4 },
  dirBtn:      { background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 7, padding: '8px 14px', fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  dirBtnActive:{ background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' },
  dateInput:   { background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#111827', outline: 'none', fontFamily: 'inherit' },
  clearAllBtn: { background: 'transparent', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 14px', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' },
  statsRow:    { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  statCard:    { flex: 1, minWidth: 120, borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
  tableWrap:   { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, overflow: 'auto' },
  table:       { width: '100%', borderCollapse: 'collapse', minWidth: 900 },
  th:          { textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB', whiteSpace: 'nowrap' },
  tr:          { borderBottom: '1px solid #F3F4F6' },
  td:          { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' },
  skuCode:     { fontFamily: 'monospace', fontSize: 12, color: '#1D4ED8', background: '#EFF6FF', padding: '2px 7px', borderRadius: 4 },
  typeChip:    { padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  dirChip:     { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 },
  refCode:     { fontFamily: 'monospace', fontSize: 11, color: '#6B7280', background: '#F3F4F6', padding: '2px 7px', borderRadius: 4 },
  mono:        { fontFamily: 'monospace', fontSize: 12, color: '#6B7280' },
  empty:       { textAlign: 'center', color: '#9CA3AF', padding: 40, fontSize: 14 },
  emptyState:  { textAlign: 'center', padding: '48px 0' },
};