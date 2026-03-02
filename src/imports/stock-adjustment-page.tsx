import { useState, useEffect } from 'react';
import {
  submitAdjustment, approveAdjustment, rejectAdjustment,
  fetchAdjustments, REASON_CATEGORIES,
  type StockAdjustment, type ReasonCategory,
} from '../../../imports/adjustmentApi';
import { supabase } from '../lib/supabase';

type Tab = 'request' | 'pending' | 'history';

const STATUS = {
  pending:  { label: 'Pending',  bg: '#FEF9C3', color: '#854D0E', dot: '#CA8A04' },
  approved: { label: 'Approved', bg: '#DCFCE7', color: '#166534', dot: '#16A34A' },
  rejected: { label: 'Rejected', bg: '#FEE2E2', color: '#991B1B', dot: '#DC2626' },
};

const EMPTY_FORM = {
  product_id: 0, sku: '', product_name: '',
  qty_before: 0, qty_change: '', reason: '',
  reason_category: 'Count Correction' as ReasonCategory,
  requested_by: '',
};

export default function StockAdjustmentPage() {
  const [tab, setTab]                   = useState<Tab>('request');
  const [adjustments, setAdjustments]   = useState<StockAdjustment[]>([]);
  const [products, setProducts]         = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);

  // Approval modal
  const [modalAdj, setModalAdj]         = useState<StockAdjustment | null>(null);
  const [managerName, setManagerName]   = useState('');
  const [rejectNote, setRejectNote]     = useState('');
  const [modalAction, setModalAction]   = useState<'approve' | 'reject' | null>(null);

  const pendingCount = adjustments.filter(a => a.status === 'pending').length;

  // Load data
  useEffect(() => {
    supabase.from('products')
      .select('product_id, sku, product_name, inventory_on_hand')
      .order('product_name')
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAdjustments()
      .then(setAdjustments)
      .finally(() => setLoading(false));
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleProductChange = (e: any) => {
    const p = products.find(x => x.product_id === parseInt(e.target.value));
    if (p) setForm(prev => ({
      ...prev,
      product_id: p.product_id,
      sku: p.sku,
      product_name: p.product_name,
      qty_before: p.inventory_on_hand,
    }));
  };

  const handleSubmit = async () => {
    if (!form.product_id || !form.qty_change || !form.reason || !form.requested_by) return;
    setSubmitting(true);
    try {
      const result = await submitAdjustment({
        ...form,
        qty_change: parseInt(form.qty_change as any),
      });
      setAdjustments(p => [result, ...p]);
      setForm(EMPTY_FORM);
      showToast('Adjustment submitted — awaiting manager approval');
      setTab('pending');
    } catch (e: any) { showToast(e.message, false); }
    setSubmitting(false);
  };

  const handleApprove = async () => {
    if (!modalAdj || !managerName.trim()) return;
    setSubmitting(true);
    try {
      await approveAdjustment(modalAdj.id, managerName);
      setAdjustments(p => p.map(a => a.id === modalAdj.id
        ? { ...a, status: 'approved', approved_by: managerName, approved_at: new Date().toISOString() }
        : a));
      closeModal();
      showToast(`✓ Approved by ${managerName} — stock updated`);
    } catch (e: any) { showToast(e.message, false); }
    setSubmitting(false);
  };

  const handleReject = async () => {
    if (!modalAdj || !managerName.trim() || !rejectNote.trim()) return;
    setSubmitting(true);
    try {
      await rejectAdjustment(modalAdj.id, managerName, rejectNote);
      setAdjustments(p => p.map(a => a.id === modalAdj.id
        ? { ...a, status: 'rejected', approved_by: managerName, rejection_note: rejectNote }
        : a));
      closeModal();
      showToast('Adjustment rejected');
    } catch (e: any) { showToast(e.message, false); }
    setSubmitting(false);
  };

  const closeModal = () => {
    setModalAdj(null); setManagerName('');
    setRejectNote(''); setModalAction(null);
  };

  const newQty = form.product_id && form.qty_change !== ''
    ? form.qty_before + parseInt(form.qty_change as any || '0')
    : null;

  const formValid = form.product_id && form.qty_change
    && parseInt(form.qty_change as any) !== 0
    && form.reason.length >= 10 && form.requested_by.trim();

  const pending = adjustments.filter(a => a.status === 'pending');
  const history = adjustments.filter(a => a.status !== 'pending');

  return (
    <div style={s.page}>
      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#166534' : '#991B1B' }}>
          {toast.msg}
        </div>
      )}

      {/* Approval Modal */}
      {modalAdj && (
        <div style={s.overlay} onClick={closeModal}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Manager Approval</h2>
              <button style={s.closeBtn} onClick={closeModal}>✕</button>
            </div>

            {/* Summary */}
            <div style={s.summaryBox}>
              {[
                ['Product', <strong>{modalAdj.product_name}</strong>],
                ['SKU', <code style={s.skuCode}>{modalAdj.sku}</code>],
                ['Stock Change', (
                  <span>
                    {modalAdj.qty_before}
                    <span style={{ color: '#9CA3AF' }}> → </span>
                    <strong style={{ color: modalAdj.qty_change > 0 ? '#16A34A' : '#DC2626' }}>
                      {modalAdj.qty_after}
                    </strong>
                    <span style={{
                      ...s.changePill,
                      background: modalAdj.qty_change > 0 ? '#DCFCE7' : '#FEE2E2',
                      color: modalAdj.qty_change > 0 ? '#166534' : '#991B1B',
                    }}>
                      {modalAdj.qty_change > 0 ? '+' : ''}{modalAdj.qty_change}
                    </span>
                  </span>
                )],
                ['Category', <span style={s.categoryChip}>{modalAdj.reason_category}</span>],
                ['Reason', <em style={{ color: '#6B7280', fontSize: 13 }}>"{modalAdj.reason}"</em>],
                ['Requested By', <strong>{modalAdj.requested_by}</strong>],
              ].map(([label, value], i) => (
                <div key={i} style={s.summaryRow}>
                  <span style={s.summaryLabel}>{label as string}</span>
                  <span>{value as any}</span>
                </div>
              ))}
            </div>

            {/* Manager name */}
            <div style={s.field}>
              <label style={s.label}>Manager Name <span style={s.req}>*</span></label>
              <input style={s.input} placeholder="Enter your full name to authenticate"
                value={managerName} onChange={e => setManagerName(e.target.value)} />
            </div>

            {/* Rejection note */}
            {modalAction === 'reject' && (
              <div style={s.field}>
                <label style={s.label}>Rejection Reason <span style={s.req}>*</span></label>
                <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
                  placeholder="Explain why this adjustment is being rejected…"
                  value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
              </div>
            )}

            {/* Actions */}
            {!modalAction && (
              <div style={s.modalActions}>
                <button style={s.approveBtn} onClick={() => setModalAction('approve')}>
                  ✓ Approve Adjustment
                </button>
                <button style={s.rejectOutlineBtn} onClick={() => setModalAction('reject')}>
                  ✕ Reject
                </button>
              </div>
            )}
            {modalAction === 'approve' && (
              <div style={s.modalActions}>
                <button style={s.approveBtn}
                  disabled={!managerName.trim() || submitting}
                  onClick={handleApprove}>
                  {submitting ? 'Approving…' : `✓ Confirm as ${managerName || '…'}`}
                </button>
                <button style={s.ghostBtn} onClick={() => setModalAction(null)}>Back</button>
              </div>
            )}
            {modalAction === 'reject' && (
              <div style={s.modalActions}>
                <button style={s.dangerBtn}
                  disabled={!managerName.trim() || !rejectNote.trim() || submitting}
                  onClick={handleReject}>
                  {submitting ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
                <button style={s.ghostBtn} onClick={() => setModalAction(null)}>Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Page Header */}
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>Manual Stock Adjustment</h1>
          <p style={s.pageSub}>Adjustments are saved as Pending until a Manager approves</p>
        </div>
        {pendingCount > 0 && (
          <button style={s.pendingBadge} onClick={() => setTab('pending')}>
            ⏳ {pendingCount} Pending Approval{pendingCount > 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {(['request', 'pending', 'history'] as Tab[]).map(t => (
          <button key={t} style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}>
            {t === 'request' && '+ New Adjustment'}
            {t === 'pending' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Pending Approval
                {pendingCount > 0 && <span style={s.tabBadge}>{pendingCount}</span>}
              </span>
            )}
            {t === 'history' && 'History'}
          </button>
        ))}
      </div>

      {/* ── REQUEST FORM ── */}
      {tab === 'request' && (
        <div style={s.card}>
          <p style={s.cardLabel}>ADJUSTMENT REQUEST</p>

          {/* Product */}
          <div style={s.field}>
            <label style={s.label}>Product <span style={s.req}>*</span></label>
            <select style={s.input} value={form.product_id || ''} onChange={handleProductChange}>
              <option value=''>Select a product…</option>
              {products.map(p => (
                <option key={p.product_id} value={p.product_id}>
                  {p.sku} — {p.product_name} (stock: {p.inventory_on_hand})
                </option>
              ))}
            </select>
          </div>

          {/* Stock Preview */}
          {form.product_id > 0 && (
            <div style={s.stockPreview}>
              <div style={s.stockBox}>
                <span style={s.stockLabel}>Current Stock</span>
                <strong style={s.stockNum}>{form.qty_before}</strong>
              </div>
              <span style={s.stockArrow}>→</span>
              <div style={s.stockBox}>
                <span style={s.stockLabel}>After Adjustment</span>
                <strong style={{
                  ...s.stockNum,
                  color: newQty === null ? '#9CA3AF'
                    : newQty < 0 ? '#DC2626'
                    : newQty > form.qty_before ? '#16A34A'
                    : '#D97706',
                }}>
                  {newQty ?? '—'}
                </strong>
              </div>
            </div>
          )}

          {/* Qty + Category */}
          <div style={s.fieldRow}>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Qty Change <span style={s.req}>*</span></label>
              <input style={s.input} type='number' placeholder='e.g. -5 or +10'
                value={form.qty_change} onChange={f('qty_change')} />
              <span style={s.hint}>Negative = remove · Positive = add</span>
            </div>
            <div style={{ ...s.field, flex: 1 }}>
              <label style={s.label}>Reason Category <span style={s.req}>*</span></label>
              <select style={s.input} value={form.reason_category} onChange={f('reason_category')}>
                {REASON_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Reason */}
          <div style={s.field}>
            <label style={s.label}>
              Reason / Notes <span style={s.req}>*</span>
              <span style={{ ...s.hint, marginLeft: 6 }}>(min 10 characters)</span>
            </label>
            <textarea style={{ ...s.input, resize: 'vertical' }} rows={3}
              placeholder='Describe why this stock adjustment is needed…'
              value={form.reason} onChange={f('reason')} />
            <span style={{
              ...s.hint,
              color: form.reason.length >= 10 ? '#16A34A' : '#9CA3AF',
            }}>
              {form.reason.length} chars {form.reason.length >= 10 ? '✓' : '(need 10+)'}
            </span>
          </div>

          {/* Requested By */}
          <div style={s.field}>
            <label style={s.label}>Requested By <span style={s.req}>*</span></label>
            <input style={s.input} placeholder='Your full name'
              value={form.requested_by} onChange={f('requested_by')} />
          </div>

          {/* Info + Submit */}
          <div style={s.formFooter}>
            <div style={s.infoBox}>
              ⓘ This will be logged as <strong style={{ color: '#1D4ED8' }}>Manual Adjustment</strong> and
              saved as <strong style={{ color: '#D97706' }}>Pending</strong> until a Manager approves.
            </div>
            <button style={{ ...s.primaryBtn, opacity: !formValid || submitting ? 0.45 : 1 }}
              disabled={!formValid || submitting}
              onClick={handleSubmit}>
              {submitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </div>
      )}

      {/* ── PENDING APPROVALS ── */}
      {tab === 'pending' && (
        <div style={s.card}>
          <p style={s.cardLabel}>PENDING MANAGER APPROVAL</p>
          {loading ? <p style={s.empty}>Loading…</p>
            : pending.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 36 }}>✓</div>
                <p style={{ color: '#6B7280', marginTop: 8 }}>No pending adjustments</p>
              </div>
            ) : pending.map(a => (
              <div key={a.id} style={s.adjCard}>
                <div style={s.adjCardTop}>
                  <div>
                    <strong style={{ fontSize: 15 }}>{a.product_name}</strong>
                    <code style={{ ...s.skuCode, marginLeft: 8 }}>{a.sku}</code>
                  </div>
                  <span style={{ ...s.statusBadge, background: STATUS[a.status].bg, color: STATUS[a.status].color }}>
                    {STATUS[a.status].label}
                  </span>
                </div>
                <div style={s.adjMeta}>
                  <span>{a.qty_before} → <strong>{a.qty_after}</strong></span>
                  <span style={{
                    ...s.changePill,
                    background: a.qty_change > 0 ? '#DCFCE7' : '#FEE2E2',
                    color: a.qty_change > 0 ? '#166534' : '#991B1B',
                  }}>{a.qty_change > 0 ? '+' : ''}{a.qty_change}</span>
                  <span style={s.categoryChip}>{a.reason_category}</span>
                  <span style={s.hint}>by {a.requested_by}</span>
                  <span style={s.hint}>{new Date(a.created_at).toLocaleString()}</span>
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', fontStyle: 'italic' }}>"{a.reason}"</p>
                <div style={s.adjActions}>
                  <button style={s.approveSm}
                    onClick={() => { setModalAdj(a); setModalAction('approve'); }}>
                    ✓ Approve
                  </button>
                  <button style={s.rejectSm}
                    onClick={() => { setModalAdj(a); setModalAction('reject'); }}>
                    ✕ Reject
                  </button>
                  <button style={s.ghostSm}
                    onClick={() => { setModalAdj(a); setModalAction(null); }}>
                    View Details
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab === 'history' && (
        <div style={s.card}>
          <p style={s.cardLabel}>ADJUSTMENT HISTORY — logged as "Manual Adjustment"</p>
          {loading ? <p style={s.empty}>Loading…</p>
            : history.length === 0 ? (
              <div style={s.emptyState}>
                <div style={{ fontSize: 32 }}>📋</div>
                <p style={{ color: '#6B7280', marginTop: 8 }}>No history yet</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Date','SKU','Product','Change','Before → After','Category','Requested By','Approved By','Status'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(a => (
                      <tr key={a.id} style={s.tr}>
                        <td style={s.td}><span style={s.hint}>{new Date(a.created_at).toLocaleDateString()}</span></td>
                        <td style={s.td}><code style={s.skuCode}>{a.sku}</code></td>
                        <td style={s.td}><strong>{a.product_name}</strong></td>
                        <td style={s.td}>
                          <span style={{
                            ...s.changePill,
                            background: a.qty_change > 0 ? '#DCFCE7' : '#FEE2E2',
                            color: a.qty_change > 0 ? '#166534' : '#991B1B',
                          }}>{a.qty_change > 0 ? '+' : ''}{a.qty_change}</span>
                        </td>
                        <td style={{ ...s.td, fontFamily: 'monospace', fontSize: 13 }}>{a.qty_before} → {a.qty_after}</td>
                        <td style={s.td}><span style={s.categoryChip}>{a.reason_category}</span></td>
                        <td style={s.td}>{a.requested_by}</td>
                        <td style={s.td}>{a.approved_by ?? <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                        <td style={s.td}>
                          <span style={{ ...s.statusBadge, background: STATUS[a.status].bg, color: STATUS[a.status].color }}>
                            {STATUS[a.status].label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:         { maxWidth: 960, margin: '0 auto', padding: '32px 20px', fontFamily: "'Segoe UI', sans-serif", color: '#111827' },
  pageHeader:   { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  pageTitle:    { fontSize: 24, fontWeight: 700, letterSpacing: '-0.4px' },
  pageSub:      { fontSize: 13, color: '#6B7280', marginTop: 4 },
  pendingBadge: { background: '#FEF9C3', border: '1px solid #FDE047', color: '#854D0E', borderRadius: 20, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  tabs:         { display: 'flex', gap: 4, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 4, width: 'fit-content', marginBottom: 16 },
  tab:          { background: 'transparent', border: 'none', color: '#6B7280', padding: '8px 18px', borderRadius: 7, fontFamily: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  tabActive:    { background: '#fff', color: '#111827', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  tabBadge:     { background: '#EAB308', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 },
  card:         { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 },
  cardLabel:    { fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.08em' },
  field:        { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldRow:     { display: 'flex', gap: 14 },
  label:        { fontSize: 13, fontWeight: 600, color: '#374151' },
  req:          { color: '#3B82F6' },
  hint:         { fontSize: 11, color: '#9CA3AF' },
  input:        { background: '#F9FAFB', border: '1.5px solid #E5E7EB', borderRadius: 9, padding: '11px 13px', fontSize: 14, color: '#111827', outline: 'none', fontFamily: 'inherit', width: '100%' },
  stockPreview: { display: 'flex', alignItems: 'center', gap: 20, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 20px' },
  stockBox:     { display: 'flex', flexDirection: 'column', gap: 3 },
  stockLabel:   { fontSize: 11, color: '#9CA3AF', fontWeight: 500 },
  stockNum:     { fontSize: 26, fontWeight: 700, fontFamily: 'monospace' },
  stockArrow:   { fontSize: 20, color: '#D1D5DB' },
  formFooter:   { display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' },
  infoBox:      { flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, padding: '11px 14px', fontSize: 13, color: '#1E40AF', lineHeight: 1.5 },
  primaryBtn:   { background: '#2563EB', color: '#fff', border: 'none', borderRadius: 9, padding: '12px 24px', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' },
  adjCard:      { background: '#F9FAFB', border: '1px solid #E5E7EB', borderLeft: '3px solid #EAB308', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  adjCardTop:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  adjMeta:      { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 },
  adjActions:   { display: 'flex', gap: 8 },
  statusBadge:  { display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  changePill:   { display: 'inline-block', padding: '2px 9px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'monospace' },
  categoryChip: { background: '#F3F4F6', color: '#374151', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500 },
  skuCode:      { fontFamily: 'monospace', fontSize: 12, color: '#6B7280', background: '#F3F4F6', padding: '2px 7px', borderRadius: 4 },
  approveSm:    { background: '#DCFCE7', color: '#166534', border: '1px solid #BBF7D0', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  rejectSm:     { background: '#FEE2E2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  ghostSm:      { background: 'transparent', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' },
  table:        { width: '100%', borderCollapse: 'collapse', minWidth: 800 },
  th:           { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '.07em', textTransform: 'uppercase', borderBottom: '1px solid #E5E7EB' },
  tr:           { borderBottom: '1px solid #F3F4F6' },
  td:           { padding: '12px 14px', fontSize: 13, verticalAlign: 'middle' },
  empty:        { textAlign: 'center', color: '#9CA3AF', padding: 40 },
  emptyState:   { textAlign: 'center', padding: '48px 0' },
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'grid', placeItems: 'center', zIndex: 100 },
  modal:        { background: '#fff', borderRadius: 16, padding: 0, width: 'min(520px, 95vw)', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 0' },
  modalTitle:   { fontSize: 18, fontWeight: 700 },
  closeBtn:     { background: 'none', border: 'none', fontSize: 16, color: '#9CA3AF', cursor: 'pointer' },
  modalActions: { display: 'flex', gap: 10, padding: '0 24px 24px', marginTop: 4 },
  summaryBox:   { margin: '16px 24px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
  summaryRow:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 },
  summaryLabel: { color: '#6B7280', fontSize: 12 },
  approveBtn:   { background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  rejectOutlineBtn: { background: 'transparent', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 8, padding: '11px 20px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
  dangerBtn:    { background: '#DC2626', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 20px', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  ghostBtn:     { background: 'transparent', color: '#6B7280', border: '1px solid #E5E7EB', borderRadius: 8, padding: '11px 18px', fontFamily: 'inherit', fontSize: 13, cursor: 'pointer' },
};