import React, { useState, useRef, useEffect } from 'react';
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
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { palette, spacing, radius, shadow, typography } from '@/constants/design';
import { cleanBarcode } from '@/utils/barcodeUtils';
import { resolveQRCode } from '../utils/qrRouter';
import * as Haptics from 'expo-haptics';
import { API_CONFIG } from '../../config';

export default function StockLookupScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [binResult, setBinResult] = useState<{ zone: string; aisle: string; bin: string; products: any[]; fallback?: boolean } | null>(null);

  const inputRef = useRef<TextInput>(null);

  // Auto-focus search input when the tab becomes focused
  useFocusEffect(
    React.useCallback(() => {
      // Small timeout to guarantee DOM/Native view has rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }, [])
  );

  const handleBinLookup = async (zone: string, aisle: string, bin: string) => {
    setIsLoading(true);
    setError(null);
    setProduct(null);
    setBinResult(null);
    setIsScanning(false);

    try {
      const baseUrl = API_CONFIG.PRODUCT_CATALOG_URL;
      const response = await fetch(`${baseUrl}/products?bin=${zone}-${aisle}-${bin}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch bin stock: ${response.status}`);
      }

      const json = await response.json();
      const list = json.data ?? json ?? [];
      
      setBinResult({
        zone,
        aisle,
        bin,
        products: Array.isArray(list) ? list : [],
        fallback: false
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      console.warn('[STOCK_LOOKUP] Bin search endpoint failed, using fallback:', err);
      setBinResult({
        zone,
        aisle,
        bin,
        products: [],
        fallback: true
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    const cleanedQuery = query.trim();
    if (!cleanedQuery) return;

    const route = resolveQRCode(cleanedQuery);
    if (route.type === 'bin') {
      handleBinLookup(route.zone, route.aisle, route.bin);
      return;
    }
    if (route.type === 'shipment') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      alert("This is a shipment QR. Use the Warehouse tab to receive it.");
      resetLookup();
      return;
    }
    if (route.type === 'order') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      alert(`This is an outbound order QR. Order: ${route.orderNo}`);
      resetLookup();
      return;
    }

    const searchVal = route.type === 'product' ? route.query : route.raw;
    const cleaned = cleanBarcode(searchVal);
    if (!cleaned) return;

    setIsLoading(true);
    setError(null);
    setProduct(null);
    setBinResult(null);
    setIsScanning(false);

    try {
      // Connect to the active product-catalog-service (Port 4003)
      const baseUrl = API_CONFIG.PRODUCT_CATALOG_URL;
      const response = await fetch(`${baseUrl}/products?search=${encodeURIComponent(cleaned)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stock: ${response.status}`);
      }

      const json = await response.json();
      const list = json.data ?? [];

      // Check if we got an exact or closest match
      if (list.length === 0) {
        setError('SKU not found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Vibration.vibrate(100);
      } else {
        // Find exact SKU/barcode or grab first match
        const matched = list.find(
          (item: any) =>
            item.sku?.toLowerCase() === cleaned.toLowerCase() ||
            item.barcode === cleaned
        ) || list[0];

        setProduct(matched);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Vibration.vibrate(50);
      }
    } catch (err: any) {
      console.error('[STOCK_LOOKUP] Search Error:', err);
      setError('Connection failed. Could not reach server.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (!isScanning) return;
    if (result.data) {
      const data = result.data.trim();
      const route = resolveQRCode(data);

      if (route.type === 'product') {
        setSearchQuery(route.query);
        handleSearch(route.query);
      } else if (route.type === 'bin') {
        setSearchQuery(`BIN:${route.zone}-${route.aisle}-${route.bin}`);
        handleBinLookup(route.zone, route.aisle, route.bin);
      } else if (route.type === 'shipment') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        alert("This is a shipment QR. Use the Warehouse tab to receive it.");
        setIsScanning(false);
      } else if (route.type === 'order') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        alert(`This is an outbound order QR. Order: ${route.orderNo}`);
        setIsScanning(false);
      } else {
        // unknown
        setSearchQuery(route.raw);
        handleSearch(route.raw);
      }
    }
  };

  const triggerScanMode = () => {
    setError(null);
    setProduct(null);
    setBinResult(null);
    setIsScanning(true);
  };

  const resetLookup = () => {
    setSearchQuery('');
    setProduct(null);
    setBinResult(null);
    setError(null);
    setIsScanning(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  };

  // Render camera scanner full screen if scanning is active
  if (isScanning) {
    if (!permission) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={palette.primary} />
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={60} color={palette.primary} />
          <Text style={[typography.h3, styles.mt16]}>Camera Access Needed</Text>
          <Text style={[typography.bodySmall, styles.mt8, styles.textCenter]}>
            Camera permission is required to scan SKU barcodes.
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
            <Text style={styles.btnPrimaryText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={() => setIsScanning(false)}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scannerRoot}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "code128", "qr"],
          }}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <Text style={styles.scannerHint}>Align product barcode inside frame</Text>
          <TouchableOpacity style={styles.btnScannerClose} onPress={() => setIsScanning(false)}>
            <Ionicons name="close-circle" size={54} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLowStock = product ? Number(product.inventory_on_hand ?? 0) <= 15 : false;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Stock Lookup</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Search bar row */}
        <View style={styles.searchRow}>
          <View style={styles.inputContainer}>
            <Ionicons name="search-outline" size={20} color={palette.textMuted} style={styles.searchIcon} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Scan or enter SKU..."
              placeholderTextColor={palette.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => handleSearch(searchQuery)}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={18} color={palette.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={triggerScanMode} activeOpacity={0.8}>
            <Ionicons name="barcode-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Loading Spinner */}
        {isLoading && (
          <View style={styles.centerSpinner}>
            <ActivityIndicator size="large" color={palette.primary} />
            <Text style={[typography.bodySmall, { marginTop: spacing.md }]}>Querying catalog...</Text>
          </View>
        )}

        {/* Error / Not Found card */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={48} color={palette.danger} />
            <Text style={[typography.h3, { color: palette.danger, marginTop: spacing.sm }]}>{error}</Text>
            <Text style={[typography.bodySmall, styles.textCenter, { marginTop: spacing.xs }]}>
              Double check the barcode or manual input and try again.
            </Text>
            <TouchableOpacity style={styles.btnRetry} onPress={resetLookup}>
              <Text style={styles.btnRetryText}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Result Card */}
        {product && (
          <View style={styles.resultCard}>
            {/* Header / SKU Badge */}
            <View style={styles.skuBadge}>
              <Text style={styles.skuBadgeText}>{product.sku}</Text>
            </View>

            <Text style={styles.productName}>{product.product_name}</Text>

            {/* Large Quantity Display */}
            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Stock On Hand</Text>
              <Text style={styles.qtyValue}>{product.inventory_on_hand}</Text>
              <Text style={styles.unitLabel}>{product.unit ?? 'pcs'}</Text>
            </View>

            {/* Indicators Grid */}
            <View style={styles.indicatorGrid}>
              {/* Location Badge */}
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <Ionicons name="location-outline" size={18} color={palette.primary} />
                  <Text style={styles.detailLabel}>Location</Text>
                </View>
                <Text style={styles.detailValue}>{product.warehouse_location || 'Not Assigned'}</Text>
              </View>

              {/* Reserved Badge (Amber) */}
              {product.reserved_stock > 0 && (
                <View style={[styles.detailCard, styles.cardReserved]}>
                  <View style={styles.detailHeader}>
                    <Ionicons name="time-outline" size={18} color={palette.warning} />
                    <Text style={[styles.detailLabel, { color: palette.warning }]}>Reserved</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: palette.warning }]}>
                    {product.reserved_stock} units
                  </Text>
                </View>
              )}

              {/* Low Stock Warning (Red) */}
              {isLowStock && (
                <View style={[styles.detailCard, styles.cardLowStock]}>
                  <View style={styles.detailHeader}>
                    <Ionicons name="warning-outline" size={18} color={palette.danger} />
                    <Text style={[styles.detailLabel, { color: palette.danger }]}>Status Alert</Text>
                  </View>
                  <Text style={[styles.detailValue, { color: palette.danger }]}>
                    Low Stock Warning
                  </Text>
                </View>
              )}
            </View>

            {/* Clear Button */}
            <TouchableOpacity style={styles.btnReset} onPress={resetLookup}>
              <Ionicons name="refresh-outline" size={16} color={palette.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnResetText}>Lookup Another</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Bin Result Card */}
        {binResult && (
          <View style={styles.resultCard}>
            {/* Header / Bin Location Badge */}
            <View style={[styles.skuBadge, { backgroundColor: palette.primary }]}>
              <Text style={styles.skuBadgeText}>BIN LOCATION</Text>
            </View>

            {/* Header Title with Shelf Icon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Ionicons name="layers-outline" size={24} color={palette.primary} />
              <Text style={styles.productName}>Bin Location</Text>
            </View>

            {/* Large Bin Identifier Display */}
            <View style={styles.qtyContainer}>
              <Text style={styles.qtyLabel}>Location Coordinates</Text>
              <Text style={[styles.qtyValue, { fontSize: 32 }]}>
                {binResult.zone}-{binResult.aisle}-{binResult.bin}
              </Text>
              <Text style={styles.unitLabel}>Zone {binResult.zone} · Aisle {binResult.aisle} · Bin {binResult.bin}</Text>
            </View>

            {/* Products List or Fallback Message */}
            {binResult.fallback ? (
              <View style={[styles.detailCard, styles.cardReserved, { marginBottom: spacing.lg, width: '100%' }]}>
                <View style={styles.detailHeader}>
                  <Ionicons name="information-circle-outline" size={18} color={palette.warning} />
                  <Text style={[styles.detailLabel, { color: palette.warning }]}>Status</Text>
                </View>
                <Text style={[styles.detailValue, { color: palette.warning }]}>
                  Bin location scanned. Stock details coming soon.
                </Text>
              </View>
            ) : (
              <View style={{ width: '100%', gap: spacing.sm, marginBottom: spacing.lg }}>
                <Text style={[typography.label, { color: palette.textSecondary, marginBottom: 4 }]}>
                  Assigned Products
                </Text>
                {binResult.products && binResult.products.length > 0 ? (
                  binResult.products.map((p: any, idx: number) => (
                    <View key={idx} style={styles.detailCard}>
                      <View style={styles.detailHeader}>
                        <Ionicons name="cube-outline" size={16} color={palette.primary} />
                        <Text style={styles.detailValue}>{p.product_name || p.name}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={[typography.bodySmall, { fontFamily: 'monospace' }]}>{p.sku}</Text>
                        <Text style={[typography.bodySmall, { fontWeight: '700' }]}>
                          {p.inventory_on_hand} {p.unit || 'pcs'}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={[styles.detailCard, { alignItems: 'center', paddingVertical: spacing.md }]}>
                    <Ionicons name="alert-circle-outline" size={24} color={palette.textMuted} />
                    <Text style={[typography.bodySmall, { color: palette.textMuted, marginTop: 4 }]}>
                      No products assigned to this bin
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Clear Button */}
            <TouchableOpacity style={styles.btnReset} onPress={resetLookup}>
              <Ionicons name="refresh-outline" size={16} color={palette.primary} style={{ marginRight: 6 }} />
              <Text style={styles.btnResetText}>Lookup Another</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  mt8: { marginTop: spacing.sm },
  mt16: { marginTop: spacing.md },
  textCenter: { textAlign: 'center' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg, padding: spacing.xl },
  centerSpinner: { marginTop: 60, alignItems: 'center' },
  
  // Header bar
  headerBar: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: palette.white,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: palette.textPrimary },

  // Content
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  // Search Row
  searchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderWidth: 1.5,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
    ...shadow.card,
  },
  searchIcon: { marginRight: 6 },
  input: { flex: 1, fontSize: 16, color: palette.textPrimary, height: '100%' },
  clearBtn: { padding: 4 },
  scanBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },

  // Buttons
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: palette.primary, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: spacing.xl,
    width: '100%', marginTop: spacing.md,
    ...shadow.card,
  },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnGhost: { marginTop: spacing.md, paddingVertical: spacing.sm },
  btnGhostText: { color: palette.primary, fontSize: 15, fontWeight: '600' },

  // Error Card
  errorCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.dangerLight,
    marginTop: spacing.xl,
    ...shadow.card,
  },
  btnRetry: {
    marginTop: spacing.lg,
    backgroundColor: palette.danger,
    paddingVertical: 10,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  btnRetryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Scanner Mode
  scannerRoot: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  viewfinder: {
    width: 260, height: 260, position: 'relative',
    borderRadius: radius.md, marginBottom: spacing.xl,
  },
  scannerHint: { color: '#fff', fontSize: 15, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full },
  btnScannerClose: { position: 'absolute', bottom: 50 },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: '#fff', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 8 },

  // Result Card
  resultCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    ...shadow.card,
  },
  skuBadge: {
    alignSelf: 'flex-start',
    backgroundColor: palette.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  skuBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  productName: { fontSize: 20, fontWeight: '700', color: palette.textPrimary, marginBottom: spacing.md },
  
  // Qty Large Card
  qtyContainer: {
    alignItems: 'center',
    backgroundColor: palette.bg,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  qtyLabel: { fontSize: 12, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  qtyValue: { fontSize: 44, fontWeight: '700', color: palette.primary, marginVertical: 4 },
  unitLabel: { fontSize: 14, fontWeight: '600', color: palette.textSecondary },

  // Detail Badge Grid
  indicatorGrid: { gap: spacing.sm, marginBottom: spacing.lg },
  detailCard: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  detailLabel: { fontSize: 12, fontWeight: '600', color: palette.textSecondary, textTransform: 'uppercase' },
  detailValue: { fontSize: 15, fontWeight: '700', color: palette.textPrimary },
  
  cardReserved: {
    backgroundColor: palette.warningLight,
    borderColor: palette.warning,
  },
  cardLowStock: {
    backgroundColor: palette.dangerLight,
    borderColor: palette.danger,
  },

  // Reset
  btnReset: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: palette.primary,
    borderRadius: radius.md,
  },
  btnResetText: { color: palette.primary, fontSize: 15, fontWeight: '700' },
});
