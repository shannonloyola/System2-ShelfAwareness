import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { getPendingShipments, getTodayStats, getShipmentByTracking, markAsReceived, getReceivedTodayList, type Shipment, type ShipmentStats } from '@/services/shipmentApi';
import { palette, spacing, radius, shadow, typography } from '@/constants/design';
import { useAuth } from '@/context/AuthContext';

// Module-level in-memory cache to prevent visible flashes during tab switching (Fix 2)
interface DashboardCache {
  stats: ShipmentStats;
  pending: Shipment[];
  receivedToday: Shipment[];
  lastUpdated: number | null;
}

const dashboardCache: DashboardCache = {
  stats: { receivedToday: 0 },
  pending: [],
  receivedToday: [],
  lastUpdated: null,
};

export default function DashboardScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { signOut, user, profile } = useAuth();

  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [listModalVisible, setListModalVisible] = useState(false);
  const [listModalType, setListModalType] = useState<'pending' | 'received'>('pending');

  // States initialized from Cache (Fix 2)
  const [stats, setStats] = useState<ShipmentStats>(dashboardCache.stats);
  const [pending, setPending] = useState<Shipment[]>(dashboardCache.pending);
  const [receivedToday, setReceivedToday] = useState<Shipment[]>(dashboardCache.receivedToday);
  const [lastUpdated, setLastUpdated] = useState<number | null>(dashboardCache.lastUpdated);
  const [lastUpdatedText, setLastUpdatedText] = useState('');

  const [loading, setLoading] = useState(dashboardCache.lastUpdated === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout positions for smooth scrolling (Fix 1)
  const [pendingY, setPendingY] = useState(0);
  const [recentY, setRecentY] = useState(0);

  // Flash highlight animations (Fix 1)
  const pendingFlashAnim = useRef(new Animated.Value(0)).current;
  const recentFlashAnim = useRef(new Animated.Value(0)).current;

  // Bottom Sheet Details State (Fix 4 & 5)
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Mark as Received processing state
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});

  const triggerPendingFlash = () => {
    pendingFlashAnim.setValue(1);
    Animated.timing(pendingFlashAnim, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  };

  const triggerRecentFlash = () => {
    recentFlashAnim.setValue(1);
    Animated.timing(recentFlashAnim, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: false,
    }).start();
  };

  const pendingFlashBg = pendingFlashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(26, 43, 71, 0.12)'],
  });

  const recentFlashBg = recentFlashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', 'rgba(26, 43, 71, 0.12)'],
  });

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const [statsData, pendingData, receivedData] = await Promise.all([
        getTodayStats().catch(() => ({ receivedToday: 0 })),
        getPendingShipments().catch(() => []),
        getReceivedTodayList().catch(() => []),
      ]);

      // Update cache
      dashboardCache.stats = statsData;
      dashboardCache.pending = pendingData;
      dashboardCache.receivedToday = receivedData;
      dashboardCache.lastUpdated = Date.now();

      // Update state
      setStats(statsData);
      setPending(pendingData);
      setReceivedToday(receivedData);
      setLastUpdated(dashboardCache.lastUpdated);
    } catch (err: any) {
      setError('Could not load dashboard data. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload dynamically when screen is focused
  useFocusEffect(
    useCallback(() => {
      const isInitial = dashboardCache.lastUpdated === null;
      loadData(isInitial);
    }, [loadData]),
  );

  // Monitor last updated text changes
  useEffect(() => {
    if (!lastUpdated) {
      setLastUpdatedText('');
      return;
    }

    const updateText = () => {
      const diffMs = Date.now() - lastUpdated;
      const secs = Math.floor(diffMs / 1000);
      if (secs < 60) {
        setLastUpdatedText('Last updated just now');
        return;
      }
      const mins = Math.floor(secs / 60);
      setLastUpdatedText(`Last updated ${mins} minute${mins > 1 ? 's' : ''} ago`);
    };

    updateText();
    const interval = setInterval(updateText, 30000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, [loadData]);

  const handleSignOutPress = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: signOut }
      ]
    );
  };

  const handleScanPress = () => router.push('/scan-shipment');

  const handlePendingTap = (tracking: string) => {
    router.push({ pathname: '/scan-shipment', params: { prefill: tracking } });
  };

  const handleMarkReceived = async (shipment: Shipment) => {
    // ── Optimistic UI: snapshot current state for rollback ────────────
    const prevPending = pending;
    const prevStats = stats;
    const prevReceivedToday = receivedToday;

    const now = new Date().toISOString();
    const optimisticShipment: Shipment = {
      ...shipment,
      status: 'received',
      received_at: now,
      received_by: 'Operator',
    };

    // Apply optimistic updates immediately
    setPending((prev) => prev.filter((s) => s.id !== shipment.id));
    setStats((prev) => ({ ...prev, receivedToday: prev.receivedToday + 1 }));
    setReceivedToday((prev) => [optimisticShipment, ...prev]);
    setProcessingIds((prev) => ({ ...prev, [shipment.id]: true }));

    // Update cache too so tab-switch doesn't revert
    dashboardCache.pending = prevPending.filter((s) => s.id !== shipment.id);
    dashboardCache.stats = { ...prevStats, receivedToday: prevStats.receivedToday + 1 };
    dashboardCache.receivedToday = [optimisticShipment, ...prevReceivedToday];

    try {
      await markAsReceived(shipment.id, 'Operator', 'Received directly from Mobile Dashboard');
      // Reconcile with fresh server data in background
      loadData(false);
    } catch (err) {
      console.error('Error marking as received:', err);
      // ── Rollback on failure ──────────────────────────────────────────
      setPending(prevPending);
      setStats(prevStats);
      setReceivedToday(prevReceivedToday);
      dashboardCache.pending = prevPending;
      dashboardCache.stats = prevStats;
      dashboardCache.receivedToday = prevReceivedToday;
      Alert.alert('Error', 'Could not mark shipment as received. Please try again.');
    } finally {
      setProcessingIds((prev) => ({ ...prev, [shipment.id]: false }));
    }
  };

  const handlePendingCardPress = () => {
    setListModalType('pending');
    setListModalVisible(true);
  };

  const handleRecentCardPress = () => {
    setListModalType('received');
    setListModalVisible(true);
  };

  const openShipmentDetail = useCallback(async (trackingNumber: string, initialData?: any) => {
    setSelectedShipment(initialData || { tracking_number: trackingNumber });
    setDetailVisible(true);
    setLoadingDetail(true);
    try {
      const data = await getShipmentByTracking(trackingNumber);
      if (data) {
        setSelectedShipment(data);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={palette.primary} />
        <Text style={[typography.bodySmall, { marginTop: spacing.md }]}>Loading dashboard…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        ref={scrollViewRef}
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
          <TouchableOpacity 
            style={styles.avatarBtn} 
            activeOpacity={0.7}
            onPress={() => setProfileModalVisible(true)}
          >
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

        {/* ── Today's Stats (Fix 1) ───────────────────────────────── */}
        <View style={styles.statsRow}>
          <InteractiveStatCard
            icon="checkmark-circle"
            iconColor={palette.success}
            bg={palette.successLight}
            label="Received Today"
            value={String(stats.receivedToday)}
            onPress={handleRecentCardPress}
          />
          <InteractiveStatCard
            icon="time"
            iconColor={palette.warning}
            bg={palette.warningLight}
            label="Pending"
            value={String(pending.length)}
            onPress={handlePendingCardPress}
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
        <View onLayout={(e) => setPendingY(e.nativeEvent.layout.y)}>
          <Animated.View style={[{ borderRadius: radius.md, paddingVertical: 4 }, { backgroundColor: pendingFlashBg }]}>
            <SectionHeader title="Pending Shipments" count={pending.length} />
          </Animated.View>
        </View>

        {pending.length === 0 ? (
          <EmptyState icon="checkmark-done-circle-outline" message="All caught up! No pending shipments." />
        ) : (
          <View style={styles.cardList}>
            {pending.map((s) => {
              const supplierName = s.supplier_name || 'Unknown Supplier';
              const truncatedSupplier = supplierName.length > 20 ? supplierName.substring(0, 17) + '...' : supplierName;

              // Calculate expected quantity by summing expected items array (Fix 3)
              const expectedQty = Array.isArray(s.expected_items)
                ? s.expected_items.reduce((sum: number, item: any) => sum + (item.expected_qty || item.quantity || 0), 0)
                : s.item_count || 0;

              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.shipmentCard}
                  onPress={() => openShipmentDetail(s.tracking_number, s)}
                  activeOpacity={0.75}
                >
                  <View style={styles.shipmentCardLeft}>
                    <Ionicons name="cube-outline" size={22} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.body, { fontWeight: '700' }]} numberOfLines={1}>
                      {truncatedSupplier}
                    </Text>
                    {supplierName.length > 20 && (
                      <Text style={{ fontSize: 11, color: palette.textMuted, marginTop: 1 }} numberOfLines={1}>
                        {supplierName}
                      </Text>
                    )}
                    <Text style={styles.shipmentMeta}>
                      PO #: {s.po_no || s.po_number || 'N/A'}
                    </Text>
                    <Text style={styles.shipmentMeta}>
                      Qty Expected: {expectedQty} units
                    </Text>
                    {s.expected_arrival && (
                      <Text style={styles.shipmentMeta}>
                        Expected Arrival: {new Date(s.expected_arrival).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.receiveBtn}
                    onPress={() => handleMarkReceived(s)}
                    disabled={processingIds[s.id]}
                    activeOpacity={0.8}
                  >
                    {processingIds[s.id] ? (
                      <ActivityIndicator size="small" color="#fff" style={{ paddingHorizontal: 12 }} />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.receiveBtnText}>Receive</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Recent Activity (server-driven) ───────────────────────── */}
        <View onLayout={(e) => setRecentY(e.nativeEvent.layout.y)} style={{ marginTop: spacing.lg }}>
          <Animated.View style={[{ borderRadius: radius.md, paddingVertical: 4 }, { backgroundColor: recentFlashBg }]}>
            <SectionHeader title="Recent Activity" count={Math.min(receivedToday.length, 5)} />
            {lastUpdatedText ? (
              <Text style={{ fontSize: 10, color: palette.textMuted, paddingHorizontal: spacing.lg, marginTop: -6, marginBottom: 8 }}>
                {lastUpdatedText}
              </Text>
            ) : null}
          </Animated.View>
        </View>

        {receivedToday.length === 0 ? (
          <EmptyState icon="time-outline" message="No shipments received today. Start scanning!" />
        ) : (
          <View style={styles.cardList}>
            {receivedToday.slice(0, 5).map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.recentCard}
                onPress={() => openShipmentDetail(s.tracking_number, s)}
                activeOpacity={0.75}
              >
                <View style={[styles.recentDot, styles.dotSuccess]} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body, { fontWeight: '700' }]} numberOfLines={1}>
                    {s.supplier_name ?? 'Unknown Supplier'}
                  </Text>
                  <Text style={typography.mono} numberOfLines={1}>
                    Tracking: {s.tracking_number}
                  </Text>
                  <Text style={styles.recentMeta}>
                    By: {s.received_by || 'Operator'} · {s.item_count ?? 0} units
                  </Text>
                </View>
                <Text style={[typography.bodySmall, { color: palette.textMuted }]}>
                  {s.received_at ? formatRelativeTime(s.received_at) : '—'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>

      {/* ── Shipment Detail Bottom Sheet (Fix 4 & 5) ───────────── */}
      <ShipmentDetailSheet
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        shipment={selectedShipment}
        loading={loadingDetail}
      />

      {/* ── Account Profile Modal ────────────────────────────── */}
      <Modal
        visible={profileModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProfileModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Account Profile</Text>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#1A2B47" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarLargeText}>
                  {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
              <Text style={styles.profileNameText}>{profile?.full_name || 'User'}</Text>
              <Text style={styles.profileEmailText}>{user?.email || 'N/A'}</Text>
              <Text style={styles.profileRoleText}>
                {profile?.role?.replace('_', ' ')}
              </Text>

              <TouchableOpacity
                style={styles.profileSignOutButton}
                onPress={() => {
                  setProfileModalVisible(false);
                  handleSignOutPress();
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="log-out-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.profileSignOutText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Shipments List Details Modal ───────────────────────── */}
      <Modal
        visible={listModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setListModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {listModalType === 'pending'
                  ? `Pending Shipments (${pending.length})`
                  : `Received Today (${stats.receivedToday})`}
              </Text>
              <TouchableOpacity onPress={() => setListModalVisible(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color="#1A2B47" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              {listModalType === 'pending' ? (
                pending.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="checkmark-done-circle-outline" size={48} color="#9CA3AF" />
                    <Text style={{ color: '#9CA3AF', marginTop: 12 }}>No pending shipments.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 12, paddingVertical: 8 }}>
                    {pending.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.modalShipmentCard}
                        onPress={() => {
                          setListModalVisible(false);
                          openShipmentDetail(s.tracking_number, s);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.modalShipmentLeft}>
                          <Ionicons name="cube-outline" size={20} color="#00A3AD" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: '#1A2B47', fontSize: 15 }}>
                            {s.tracking_number}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {s.supplier_name || 'Unknown Supplier'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            Expected: {s.expected_arrival ? new Date(s.expected_arrival).toLocaleDateString() : 'N/A'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : (
                receivedToday.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <Ionicons name="time-outline" size={48} color="#9CA3AF" />
                    <Text style={{ color: '#9CA3AF', marginTop: 12 }}>No shipments received today.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 12, paddingVertical: 8 }}>
                    {receivedToday.map((s) => (
                      <TouchableOpacity
                        key={s.id}
                        style={styles.modalShipmentCard}
                        onPress={() => {
                          setListModalVisible(false);
                          openShipmentDetail(s.tracking_number, s);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.modalShipmentLeft, { backgroundColor: '#DEF7EC' }]}>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#0E9F6E" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: '#1A2B47', fontSize: 15 }}>
                            {s.tracking_number}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                            {s.supplier_name || 'Unknown Supplier'}
                          </Text>
                          <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            Received: {s.received_at ? new Date(s.received_at).toLocaleTimeString() : 'N/A'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InteractiveStatCard({ icon, iconColor, bg, label, value, onPress }: {
  icon: string; iconColor: string; bg: string; label: string; value: string; onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.statCard, { backgroundColor: bg, transform: [{ scale }] }]}>
        <Ionicons name={icon as any} size={28} color={iconColor} />
        <Text style={[typography.h1, { color: iconColor, marginTop: spacing.xs }]}>{value}</Text>
        <Text style={[typography.bodySmall, { marginTop: 2, textAlign: 'center' }]}>{label}</Text>
      </Animated.View>
    </TouchableWithoutFeedback>
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

// Custom Shipment Detail Bottom Sheet Modal Component
function ShipmentDetailSheet({
  visible,
  onClose,
  shipment,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  shipment: any | null;
  loading: boolean;
}) {
  if (!visible) return null;

  const items = shipment?.expected_items || [];
  const status = (shipment?.status || '').toLowerCase();
  const isReceived = status === 'received';

  const totalItems = items.length;
  const totalExpectedQty = items.reduce((sum: number, it: any) => sum + (it.expected_qty || it.quantity || 0), 0);
  const totalReceivedQty = items.reduce((sum: number, it: any) => sum + (it.received_qty ?? (isReceived ? (it.expected_qty || it.quantity || 0) : 0)), 0);

  // Status badge palette — full categorized set
  let badgeBg = '#F3F4F6';     // default gray
  let badgeText = '#6B7280';
  if (status === 'received') {
    badgeBg = palette.successLight; badgeText = palette.success;
  } else if (status === 'partial') {
    badgeBg = '#FFF3CD'; badgeText = '#B45309';
  } else if (status === 'qc hold' || status === 'qc_hold') {
    badgeBg = '#FFFBEB'; badgeText = '#92400E';
  } else if (status === 'discrepancy') {
    badgeBg = palette.dangerLight; badgeText = palette.danger;
  } else if (status === 'cancelled') {
    badgeBg = '#F3F4F6'; badgeText = '#6B7280';
  } else if (status === 'pending' || status === 'initialized' || status === 'scheduled') {
    badgeBg = palette.warningLight; badgeText = palette.warning;
  } else if (status === 'in-transit' || status === 'in_transit' || status === 'handed_to_freight') {
    badgeBg = palette.infoLight; badgeText = '#00A3AD';
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.sheetContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.sheetBackdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheetContent}>
          <View style={styles.sheetDragHandle} />

          <View style={styles.sheetHeader}>
            <Text style={[typography.h2, { marginBottom: 6, color: '#1A2B47' }]} numberOfLines={2}>
              {shipment?.supplier_name || 'Unknown Supplier'}
            </Text>
            <View style={styles.sheetRow}>
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.badgeText, { color: badgeText }]}>
                  {(shipment?.status || 'Pending').toUpperCase()}
                </Text>
              </View>
              <Text style={[typography.mono, { color: palette.textSecondary, fontSize: 12 }]}>
                {shipment?.tracking_number || shipment?.trackingNumber || 'No Tracking'}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={palette.primary} />
                <Text style={[typography.bodySmall, { marginTop: spacing.sm, color: palette.textSecondary }]}>Loading details...</Text>
              </View>
            ) : (
              <>
                {/* Meta Summary Box */}
                <View style={styles.sheetMetaList}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>PO Number:</Text>
                    <Text style={styles.metaValue}>{shipment?.po_no || shipment?.po_number || 'N/A'}</Text>
                  </View>
                  {shipment?.expected_arrival && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Expected Arrival:</Text>
                      <Text style={styles.metaValue}>{new Date(shipment.expected_arrival).toLocaleDateString()}</Text>
                    </View>
                  )}
                  {shipment?.received_at && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Received At:</Text>
                      <Text style={styles.metaValue}>{new Date(shipment.received_at).toLocaleString()}</Text>
                    </View>
                  )}
                  {shipment?.received_by && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Received By:</Text>
                      <Text style={styles.metaValue}>{shipment.received_by}</Text>
                    </View>
                  )}
                  {shipment?.notes && (
                    <View style={[styles.metaRow, { alignItems: 'flex-start' }]}>
                      <Text style={styles.metaLabel}>Notes:</Text>
                      <Text style={[styles.metaValue, { flex: 1, textAlign: 'right', flexWrap: 'wrap' }]}>{shipment.notes}</Text>
                    </View>
                  )}
                  {shipment?.created_at && (
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Date Created:</Text>
                      <Text style={styles.metaValue}>{new Date(shipment.created_at).toLocaleDateString()}</Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Total SKUs:</Text>
                    <Text style={styles.metaValue}>{totalItems}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Qty Received / Expected:</Text>
                    <Text style={[styles.metaValue, { color: isReceived ? palette.success : palette.warning }]}>
                      {totalReceivedQty} / {totalExpectedQty}
                    </Text>
                  </View>
                </View>

                {/* Expected items list */}
                <Text style={[typography.h3, { marginTop: spacing.lg, marginBottom: spacing.sm, color: '#1A2B47' }]}>
                  Expected Items ({totalItems})
                </Text>

                {items.length === 0 ? (
                  <View style={styles.emptyItemsContainer}>
                    <Text style={[typography.bodySmall, { color: palette.textMuted }]}>
                      No item list registered.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.itemsListContainer}>
                    {items.map((item: any, idx: number) => {
                      const expQty = item.expected_qty || item.quantity || 0;
                      // Use actual received_qty if available; fall back to expQty when fully received
                      const recQty = item.received_qty != null
                        ? item.received_qty
                        : (isReceived ? expQty : 0);

                      // Indicator Color — full palette
                      let indicatorColor = '#9CA3AF'; // Gray — not yet processed
                      if (recQty >= expQty && expQty > 0) {
                        indicatorColor = palette.success; // Green — fully received
                      } else if (recQty > 0 && recQty < expQty) {
                        indicatorColor = palette.warning; // Amber — partial
                      } else if (status === 'discrepancy') {
                        indicatorColor = palette.danger;  // Red — discrepancy
                      }

                      return (
                        <View key={idx} style={styles.sheetItemRow}>
                          <View style={[styles.itemIndicator, { backgroundColor: indicatorColor }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[typography.body, { fontWeight: '600' }]} numberOfLines={1}>
                              {item.product_name || item.item_name || 'Product'}
                            </Text>
                            <Text style={[typography.mono, { fontSize: 11, color: palette.textSecondary, marginTop: 1 }]}>
                              {item.sku || 'No SKU'}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[typography.body, { fontWeight: '700', color: recQty >= expQty && expQty > 0 ? palette.success : '#1A2B47' }]}>
                              {recQty} / {expQty}
                            </Text>
                            <Text style={{ fontSize: 10, color: palette.textMuted }}>
                              units
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.sheetCloseButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.sheetCloseButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logoutBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styling (Profile and Shipments list)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    padding: 24,
    shadowColor: '#1A2B47',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 16,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A2B47',
  },
  modalBody: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00A3AD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatarLargeText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
  },
  profileNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A2B47',
    marginBottom: 4,
  },
  profileEmailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  profileRoleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00A3AD',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 24,
    textTransform: 'uppercase',
  },
  profileSignOutButton: {
    flexDirection: 'row',
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  profileSignOutText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  modalShipmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  modalShipmentLeft: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  shipmentMeta: {
    fontSize: 13, color: palette.textSecondary, marginTop: 2
  },
  receiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.success,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    height: 36,
    ...shadow.card,
  },
  receiveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
  recentMeta: {
    fontSize: 12, color: palette.textSecondary, marginTop: 2
  },

  // Empty
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    padding: spacing.xl,
    marginHorizontal: spacing.lg,
    backgroundColor: palette.white, borderRadius: radius.lg,
    ...shadow.card,
  },

  // Bottom Sheet Custom Styles (Fix 4 & 5)
  sheetContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  sheetContent: {
    backgroundColor: palette.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '82%',
    ...shadow.card,
  },
  sheetDragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetHeader: {
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingBottom: spacing.md,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sheetBody: {
    marginBottom: spacing.md,
  },
  sheetMetaList: {
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    color: palette.textSecondary,
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 13,
    color: '#1A2B47',
    fontWeight: '700',
  },
  emptyItemsContainer: {
    padding: spacing.md,
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  itemsListContainer: {
    gap: spacing.sm,
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  itemIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sheetCloseButton: {
    backgroundColor: palette.primary,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  sheetCloseButtonText: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
