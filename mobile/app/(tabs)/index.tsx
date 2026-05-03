import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getPendingShipments, getTodayStats, type Shipment, type ShipmentStats } from '@/services/shipmentApi';
import { getRecentScans, type RecentScan } from '@/utils/recentScans';
import { palette, spacing, radius, shadow, typography } from '@/constants/design';

export default function DashboardScreen() {
  const router = useRouter();

  const [stats, setStats] = useState<ShipmentStats>({ receivedToday: 0 });
  const [pending, setPending] = useState<Shipment[]>([]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [statsData, pendingData, scansData] = await Promise.all([
        getTodayStats().catch(() => ({ receivedToday: 0 })),
        getPendingShipments().catch(() => []),
        getRecentScans(),
      ]);
      setStats(statsData);
      setPending(pendingData);
      console.log('[DASHBOARD] Recent Scans:', scansData);
      setRecentScans(scansData);
    } catch (err: any) {
      setError('Could not load dashboard data. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the screen comes into focus (e.g., after a successful scan)
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleScanPress = () => router.push('/scan-shipment');
  const handlePendingTap = (tracking: string) =>
    router.push({ pathname: '/scan-shipment', params: { prefill: tracking } });

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[typography.bodySmall, { marginTop: spacing.md }]}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>ShelfAwareness</Text>
          <Text style={typography.h1}>Warehouse</Text>
        </View>
        <TouchableOpacity style={styles.avatarBtn}>
          <Ionicons name="person-circle-outline" size={36} color={palette.primary} />
        </TouchableOpacity>
      </View>

      {/* ── Error banner ────────────────────────────────────────── */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={16} color={palette.danger} />
          <Text style={[typography.bodySmall, { color: palette.danger, marginLeft: 6, flex: 1 }]}>
            {error}
          </Text>
        </View>
      )}

      {/* ── Today's Stats ───────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatCard
          icon="checkmark-circle"
          iconColor={palette.success}
          bg={palette.successLight}
          label="Received Today"
          value={String(stats.receivedToday)}
        />
        <StatCard
          icon="time"
          iconColor={palette.warning}
          bg={palette.warningLight}
          label="Pending"
          value={String(pending.length)}
        />
      </View>

      {/* ── Scan CTA ─────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.scanCta} onPress={handleScanPress} activeOpacity={0.85}>
        <View style={styles.scanCtaIcon}>
          <Ionicons name="scan" size={28} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.scanCtaTitle}>Scan Shipment</Text>
          <Text style={styles.scanCtaSub}>Camera or manual tracking number</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* ── Pending Shipments ─────────────────────────────────────── */}
      <SectionHeader title="Pending Shipments" count={pending.length} />
      {pending.length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" message="All caught up! No pending shipments." />
      ) : (
        <View style={styles.cardList}>
          {pending.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.shipmentCard}
              onPress={() => handlePendingTap(s.tracking_number)}
              activeOpacity={0.75}
            >
              <View style={styles.shipmentCardLeft}>
                <Ionicons name="cube-outline" size={22} color={palette.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                  {s.supplier_name ?? 'Unknown Supplier'}
                </Text>
                <Text style={[typography.mono, { marginTop: 2 }]} numberOfLines={1}>
                  {s.tracking_number}
                </Text>
                {s.expected_arrival && (
                  <Text style={[typography.bodySmall, { marginTop: 2, color: palette.warning }]}>
                    Expected {new Date(s.expected_arrival).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <View style={styles.shipmentCardRight}>
                {s.item_count ? (
                  <Text style={styles.itemCount}>{s.item_count}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Recent Activity ───────────────────────────────────────── */}
      <SectionHeader title="Recent Activity" count={recentScans.length} />
      {recentScans.length === 0 ? (
        <EmptyState icon="time-outline" message="No scans yet. Start scanning to see history here." />
      ) : (
        <View style={styles.cardList}>
          {recentScans.map((scan) => (
            <View key={`${scan.id}-${scan.receivedAt}`} style={styles.recentCard}>
              <View style={[styles.recentDot, scan.status === 'received' ? styles.dotSuccess : styles.dotWarning]} />
              <View style={{ flex: 1 }}>
                <Text style={[typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                  {scan.supplierName ?? scan.trackingNumber}
                </Text>
                <Text style={typography.mono} numberOfLines={1}>{scan.trackingNumber}</Text>
              </View>
              <Text style={[typography.bodySmall, { color: palette.textMuted }]}>
                {formatRelativeTime(scan.receivedAt)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, iconColor, bg, label, value }: {
  icon: string; iconColor: string; bg: string; label: string; value: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={28} color={iconColor} />
      <Text style={[typography.h1, { color: iconColor, marginTop: spacing.xs }]}>{value}</Text>
      <Text style={[typography.bodySmall, { marginTop: 2, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={typography.h3}>{title}</Text>
      {count > 0 && (
        <View style={styles.countBubble}>
          <Text style={styles.countBubbleText}>{count}</Text>
        </View>
      )}
    </View>
  );
}

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon as any} size={36} color={palette.textMuted} />
      <Text style={[typography.bodySmall, { marginTop: spacing.sm, textAlign: 'center' }]}>{message}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingBottom: spacing.xxl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  greeting: { ...typography.label, color: palette.primary, marginBottom: 2 },
  avatarBtn: { padding: 4 },

  // Error
  errorBanner: {
    flexDirection: 'row', alignItems: 'center',
    margin: spacing.md, padding: spacing.md,
    backgroundColor: palette.dangerLight, borderRadius: radius.md,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    margin: spacing.lg,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1, borderRadius: radius.lg, padding: spacing.md,
    alignItems: 'center', justifyContent: 'center', minHeight: 110,
    ...shadow.card,
  },

  // Scan CTA
  scanCta: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.primary,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.card,
  },
  scanCtaIcon: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  scanCtaTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  scanCtaSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 },

  // Section
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  countBubble: {
    backgroundColor: palette.primary, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  countBubbleText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Shipment cards
  cardList: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  shipmentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.white, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.md,
    ...shadow.card,
  },
  shipmentCardLeft: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: palette.infoLight, alignItems: 'center', justifyContent: 'center',
  },
  shipmentCardRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  itemCount: {
    fontSize: 13, fontWeight: '700', color: palette.textMuted,
    backgroundColor: palette.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
  },

  // Recent
  recentCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.white, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.md,
    ...shadow.card,
  },
  recentDot: { width: 10, height: 10, borderRadius: 5 },
  dotSuccess: { backgroundColor: palette.success },
  dotWarning: { backgroundColor: palette.warning },

  // Empty
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: palette.white, borderRadius: radius.lg,
    ...shadow.card,
  },
});
