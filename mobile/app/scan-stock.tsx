import { StyleSheet, Text, View, Button, ActivityIndicator, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';

export default function ScanStockScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  
  const [scannedCode, setScannedCode] = useState<{ type: string; value: string } | null>(null);
  const [stockResult, setStockResult] = useState<{ available: number; reserved: number; threshold: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [manualSku, setManualSku] = useState('');

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const fetchStock = async (sku: string) => {
    setIsLoading(true);
    setError(null);
    setStockResult(null);
    try {
      const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';
      const response = await fetch(`${baseUrl}/products/${sku}/stock`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stock: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Handle the different expected response shapes
      const available = data.available ?? data.availableStock ?? data.available_count ?? 0;
      const reserved = data.reserved ?? data.reservedStock ?? data.reserved_count ?? 0;
      const threshold = data.reorderPoint ?? data.reorder_point ?? data.lowStockThreshold ?? data.low_stock_threshold ?? 10;
      
      setStockResult({ available, reserved, threshold });
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching stock');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSearch = () => {
    if (manualSku.trim()) {
      setIsScanning(false);
      setScannedCode({ type: 'Manual Input', value: manualSku.trim() });
      fetchStock(manualSku.trim());
    }
  };

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'code-128'],
    onCodeScanned: (codes) => {
      // Prevent rapid duplicate scans
      if (!isScanning) return;
      if (codes.length > 0) {
        const firstCode = codes[0];
        if (firstCode.value && firstCode.type) {
          setIsScanning(false);
          setScannedCode({ type: firstCode.type, value: firstCode.value });
          fetchStock(firstCode.value);
        }
      }
    }
  });

  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No Camera Device Found</Text>
        <Text style={styles.subtext}>Please run on a physical device.</Text>
      </View>
    );
  }
  
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Camera Permission Required</Text>
        <Text style={styles.subtext}>We need your permission to use the camera to scan barcodes.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isScanning}
        codeScanner={codeScanner}
      />
      <View style={styles.overlay}>
        {scannedCode ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>SKU Lookup Result</Text>
            <Text style={styles.resultText}>SKU: {scannedCode.value} ({scannedCode.type})</Text>
            
            <View style={styles.stockContainer}>
              {isLoading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#0a7ea4" />
                  <Text style={styles.statusText}>Fetching stock...</Text>
                </View>
              )}
              
              {error && <Text style={[styles.statusText, styles.errorText]}>{error}</Text>}
              
              {stockResult && (
                <View style={styles.stockResult}>
                  <Text style={styles.stockText}>Available: <Text style={styles.boldText}>{stockResult.available}</Text></Text>
                  <Text style={styles.stockText}>Reserved: <Text style={styles.boldText}>{stockResult.reserved}</Text></Text>
                  
                  {stockResult.available <= stockResult.threshold && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>Low Stock</Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.buttonContainer}>
              <Button title="Scan Again" onPress={() => {
                setScannedCode(null);
                setStockResult(null);
                setError(null);
                setManualSku('');
                setIsScanning(true);
              }} />
            </View>
          </View>
        ) : (
          <View style={styles.scanPromptContainer}>
            <View style={styles.scanPrompt}>
              <Text style={styles.promptText}>Point camera at an EAN-13 or Code128 barcode</Text>
            </View>
            <View style={styles.manualInputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Or enter SKU manually..."
                value={manualSku}
                onChangeText={setManualSku}
                onSubmitEditing={handleManualSearch}
                autoCapitalize="none"
              />
              <Button title="Search" onPress={handleManualSearch} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  text: { color: '#fff', marginBottom: 10, fontSize: 18, fontWeight: 'bold' },
  subtext: { color: '#ccc', marginBottom: 20, fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 50 },
  resultCard: { backgroundColor: 'white', padding: 24, borderRadius: 16, width: '85%', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  resultTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: '#333' },
  resultText: { fontSize: 14, marginBottom: 15, color: '#555' },
  stockContainer: { width: '100%', minHeight: 60, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', borderRadius: 8, padding: 12, marginBottom: 15 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 16, color: '#555' },
  errorText: { color: '#d32f2f', textAlign: 'center' },
  stockResult: { width: '100%', alignItems: 'center' },
  stockText: { fontSize: 16, color: '#333', marginVertical: 2 },
  boldText: { fontWeight: 'bold', fontSize: 18 },
  badge: { backgroundColor: '#ff4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginTop: 10 },
  badgeText: { color: 'white', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  buttonContainer: { width: '100%' },
  scanPromptContainer: { width: '100%', alignItems: 'center' },
  scanPrompt: { backgroundColor: 'rgba(0,0,0,0.7)', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 20 },
  promptText: { color: 'white', fontSize: 16, fontWeight: '500' },
  manualInputContainer: { backgroundColor: 'white', padding: 10, borderRadius: 12, marginTop: 15, width: '85%', flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  input: { flex: 1, height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, marginRight: 10, fontSize: 16 }
});
