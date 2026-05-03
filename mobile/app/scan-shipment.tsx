import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getShipmentByTracking, markAsReceived, type Shipment } from '@/services/shipmentApi';
import { saveRecentScan } from '@/utils/recentScans';
import { cleanBarcode, isValidBarcode } from '@/utils/barcodeUtils';
import { palette, spacing, radius, shadow, typography } from '@/constants/design';


type ScanPhase = 'scan' | 'result' | 'success';

export default function ScanShipmentScreen() {
  const { prefill } = useLocalSearchParams<{ prefill?: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();

  const [phase, setPhase] = useState<ScanPhase>('scan');
  const [isScanning, setIsScanning] = useState(true);
  const [manualInput, setManualInput] = useState(prefill ?? '');
  const [showManual, setShowManual] = useState(!!prefill);

  const [trackingValue, setTrackingValue] = useState<string | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [markingReceived, setMarkingReceived] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  const successAnim = useRef(new Animated.Value(0)).current;

  // Auto-trigger search if prefill is provided
  useEffect(() => {
    if (prefill) {
      lookupShipment(prefill);
    }
  }, [prefill]);

  const lookupShipment = useCallback(async (tracking: string) => {
    const value = cleanBarcode(tracking);
    if (!value || !isValidBarcode(value)) {
      if (value) setLookupError('Invalid tracking format');
      return;
    }

    setIsScanning(false);
    setTrackingValue(value);
    setLookupError(null);
    setShipment(null);
    setMarkError(null);
    setPhase('result');
    setIsLoading(true);

    try {
      const data = await getShipmentByTracking(value);
      console.log('[SCAN] Shipment Found:', JSON.stringify(data, null, 2));
      if (!data) {
        setLookupError('Shipment not found. Check the tracking number and try again.');
      } else {
        setShipment(data);
        await saveRecentScan(data); // Save to history immediately
        Vibration.vibrate(50);
      }
    } catch (err: any) {
      console.error('[SCAN] Lookup Error:', err);
      setLookupError(err.message || 'Could not reach the server. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!isScanning || phase !== 'scan') return;
    if (result.data) {
      lookupShipment(result.data);
    }
  };

  const handleMarkReceived = async () => {
    if (!shipment) return;
    setMarkingReceived(true);
    setMarkError(null);
    try {
      const updated = await markAsReceived(shipment.id);
      console.log('[SCAN] Mark as Received Success:', updated);
      await saveRecentScan(updated);
      setShipment(updated);
      setPhase('success');
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 7,
      }).start();
      Vibration.vibrate([0, 80, 40, 80]);
    } catch (err: any) {
      console.error('[SCAN] Mark Received Error:', err);
      setMarkError(err.message || 'Failed to update shipment status.');
    } finally {
      setMarkingReceived(false);
    }
  };

  const handleReset = () => {
    setPhase('scan');
    setIsScanning(true);
    setTrackingValue(null);
    setShipment(null);
    setLookupError(null);
    setMarkError(null);
    setManualInput('');
    setShowManual(false);
    successAnim.setValue(0);
  };

  // ── Helper ──────────────────────────────────────────────────────────────────
  const isProcessable = (status: string) => {
    const s = status.toLowerCase();
    return s === 'pending' || s === 'initialized' || s === 'handed_to_freight' || s === 'in_transit' || s === 'scheduled';
  };

  // ── Permission states ───────────────────────────────────────────────────────
  if (!permission) {
    return <View style={styles.centered}><ActivityIndicator color={palette.primary} /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={60} color={palette.primary} />
        <Text style={[typography.h3, styles.mt16]}>Camera Access Needed</Text>
        <Text style={[typography.bodySmall, styles.mt8, styles.textCenter]}>
          Camera permission is required to scan shipment barcodes.
        </Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (phase === 'success' && shipment) {
    const scale = successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
    return (
      <View style={[styles.centered, { backgroundColor: palette.successLight }]}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={palette.success} />
          </View>
        </Animated.View>
        <Text style={[typography.h2, { color: palette.success, marginTop: spacing.lg }]}>
          Received!
        </Text>
        <Text style={[typography.body, styles.mt8, styles.textCenter]}>
          {shipment.tracking_number}
        </Text>
        {shipment.supplier_name && (
          <Text style={[typography.bodySmall, styles.textCenter, { marginTop: 4 }]}>
            {shipment.supplier_name}
          </Text>
        )}
        <TouchableOpacity style={[styles.btnPrimary, { marginTop: spacing.xl }]} onPress={handleReset}>
          <Ionicons name="scan-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnPrimaryText}>Scan Next</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnGhost} onPress={() => router.back()}>
          <Text style={styles.btnGhostText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Scan + Result ───────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Camera */}
      {phase === 'scan' && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "code128", "qr"],
          }}
        />
      )}

      {/* Dark background when showing result */}
      {phase !== 'scan' && <View style={styles.darkBg} />}

      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Shipment</Text>
        <TouchableOpacity onPress={() => setShowManual((v) => !v)} style={styles.headerBtn}>
          <Ionicons name={showManual ? 'camera-outline' : 'keypad-outline'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Scan overlay content */}
      {phase === 'scan' && (
        <View style={styles.scanContent}>
          {/* Viewfinder */}
          <View style={styles.viewfinderWrapper}>
            <View style={styles.viewfinder}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.viewfinderHint}>
              Point camera at barcode · EAN-13, Code-128, QR
            </Text>
          </View>

          {/* Manual input */}
          {showManual && (
            <View style={styles.manualCard}>
              <Text style={[typography.label, { color: palette.textMuted, marginBottom: spacing.sm }]}>
                Manual Entry
              </Text>
              <View style={styles.manualRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="Enter tracking number..."
                  placeholderTextColor={palette.textMuted}
                  value={manualInput}
                  onChangeText={setManualInput}
                  onSubmitEditing={() => lookupShipment(manualInput)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                <TouchableOpacity
                  style={styles.manualSearch}
                  onPress={() => lookupShipment(manualInput)}
                  disabled={!manualInput.trim()}
                >
                  <Ionicons name="search" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Result panel */}
      {phase === 'result' && (
        <ScrollView
          contentContainerStyle={styles.resultScroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Tracking badge */}
          <View style={styles.trackingBadge}>
            <Ionicons name="barcode-outline" size={16} color={palette.primary} style={{ marginRight: 6 }} />
            <Text style={styles.trackingBadgeText} numberOfLines={1}>{trackingValue}</Text>
          </View>

          {/* Loading */}
          {isLoading && (
            <View style={styles.resultCard}>
              <ActivityIndicator size="large" color={palette.primary} />
              <Text style={[typography.bodySmall, { marginTop: spacing.md }]}>
                Looking up shipment...
              </Text>
            </View>
          )}

          {/* Not found error */}
          {!isLoading && lookupError && (
            <View style={[styles.resultCard, styles.errorCard]}>
              <Ionicons name="alert-circle" size={40} color={palette.danger} />
              <Text style={[typography.h3, { color: palette.danger, marginTop: spacing.sm }]}>
                Not Found
              </Text>
              <Text style={[typography.bodySmall, styles.textCenter, { marginTop: spacing.sm }]}>
                {lookupError}
              </Text>
              <TouchableOpacity style={[styles.btnPrimary, { marginTop: spacing.lg }]} onPress={handleReset}>
                <Text style={styles.btnPrimaryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Shipment found */}
          {!isLoading && shipment && (
            <View style={styles.resultCard}>
              {/* Status badge */}
              <View style={[styles.statusBadge, statusBadgeStyle(shipment.status)]}>
                <Text style={[styles.statusBadgeText, statusTextStyle(shipment.status)]}>
                  {shipment.status.toUpperCase()}
                </Text>
              </View>

              <Text style={[typography.h2, { marginTop: spacing.md, textAlign: 'center' }]}>
                {shipment.supplier_name ?? 'Unknown Supplier'}
              </Text>

              {shipment.po_number && (
                <Text style={[typography.bodySmall, { marginTop: 4, textAlign: 'center' }]}>
                  PO # {shipment.po_number}
                </Text>
              )}

              <View style={styles.divider} />

              {/* Details grid */}
              <View style={styles.detailGrid}>
                <DetailRow
                  icon="cube-outline"
                  label="Items"
                  value={shipment.item_count ? `${shipment.item_count} units` : '—'}
                />
                <DetailRow
                  icon="calendar-outline"
                  label="Expected"
                  value={shipment.expected_arrival
                    ? new Date(shipment.expected_arrival).toLocaleDateString()
                    : '—'}
                />
                {shipment.received_at && (
                  <DetailRow
                    icon="checkmark-circle-outline"
                    label="Received"
                    value={new Date(shipment.received_at).toLocaleString()}
                  />
                )}
                {shipment.notes && (
                  <DetailRow icon="document-text-outline" label="Notes" value={shipment.notes} />
                )}
              </View>

              {/* Mark received error */}
              {markError && (
                <View style={styles.inlineError}>
                  <Ionicons name="warning-outline" size={14} color={palette.danger} />
                  <Text style={[typography.bodySmall, { color: palette.danger, marginLeft: 6 }]}>
                    {markError}
                  </Text>
                </View>
              )}

              {/* Actions */}
              {shipment.status.toLowerCase() !== 'received' ? (
                <TouchableOpacity
                  style={[styles.btnPrimary, { marginTop: spacing.lg }]}
                  onPress={handleMarkReceived}
                  disabled={markingReceived}
                >
                  {markingReceived ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.btnPrimaryText}>Mark as Received</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.alreadyReceived]}>
                  <Ionicons name="information-circle-outline" size={16} color={palette.textMuted} />
                  <Text style={[typography.bodySmall, { marginLeft: 6 }]}>
                    This shipment is already <Text style={{ fontWeight: '600' }}>{shipment.status}</Text>.
                  </Text>
                </View>
              )}

              <TouchableOpacity style={styles.btnGhost} onPress={handleReset}>
                <Text style={styles.btnGhostText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon as any} size={16} color={palette.primary} style={styles.detailIcon} />
      <View style={{ flex: 1 }}>
        <Text style={typography.label}>{label}</Text>
        <Text style={[typography.body, { marginTop: 2 }]}>{value}</Text>
      </View>
    </View>
  );
}

const statusBadgeStyle = (status: string) => ({
  backgroundColor:
    status.toLowerCase() === 'received' ? palette.successLight :
      isPendingStatus(status) ? palette.warningLight :
        palette.infoLight,
});

const statusTextStyle = (status: string) => ({
  color:
    status.toLowerCase() === 'received' ? palette.success :
      isPendingStatus(status) ? palette.warning :
        palette.info,
});

const isPendingStatus = (status: string) => {
  const s = status.toLowerCase();
  return s === 'pending' || s === 'initialized' || s === 'handed_to_freight' || s === 'scheduled';
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, backgroundColor: palette.bg },
  darkBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
  mt8: { marginTop: spacing.sm },
  mt16: { marginTop: spacing.md },
  textCenter: { textAlign: 'center' },
  headerBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerBtn: { padding: spacing.sm, borderRadius: radius.full },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600', letterSpacing: 0.3 },
  scanContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 120, paddingBottom: spacing.xl },
  viewfinderWrapper: { alignItems: 'center', width: '100%' },
  viewfinder: {
    width: 260, height: 180, position: 'relative',
    borderRadius: radius.md, marginBottom: spacing.md,
  },
  viewfinderHint: { color: 'rgba(255,255,255,0.8)', fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.xl },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
  manualCard: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xl,
    width: '88%',
    ...shadow.card,
  },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  manualInput: {
    flex: 1, height: 44, borderWidth: 1.5, borderColor: palette.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    fontSize: 15, color: palette.textPrimary, backgroundColor: palette.bg,
  },
  manualSearch: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  resultScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingBottom: spacing.xxl, paddingHorizontal: spacing.md },
  trackingBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.full, marginBottom: spacing.md,
    maxWidth: '90%',
  },
  trackingBadgeText: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  resultCard: {
    backgroundColor: palette.white, borderRadius: radius.xl,
    padding: spacing.lg, width: '100%', alignItems: 'center',
    ...shadow.modal,
  },
  errorCard: { borderWidth: 1.5, borderColor: palette.dangerLight },
  statusBadge: {
    paddingHorizontal: spacing.md, paddingVertical: 5,
    borderRadius: radius.full,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  divider: { width: '100%', height: 1, backgroundColor: palette.border, marginVertical: spacing.md },
  detailGrid: { width: '100%', gap: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: spacing.xs },
  detailIcon: { marginRight: spacing.sm, marginTop: 3 },
  inlineError: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: palette.dangerLight, borderRadius: radius.md,
    padding: spacing.sm, marginTop: spacing.md, width: '100%',
  },
  alreadyReceived: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: spacing.lg, paddingHorizontal: spacing.sm,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.primary, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    width: '100%', marginTop: spacing.sm,
    ...shadow.card,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { marginTop: spacing.md, paddingVertical: spacing.sm },
  btnGhostText: { color: palette.primary, fontSize: 15, fontWeight: '600' },
  successIcon: { width: 120, height: 120, borderRadius: 60, backgroundColor: palette.successLight, alignItems: 'center', justifyContent: 'center' },
});
