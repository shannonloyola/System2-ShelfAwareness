import { StyleSheet, Text, View, Button } from 'react-native';
import { useState, useEffect } from 'react';
import { Camera, useCameraDevice, useCodeScanner, useCameraPermission } from 'react-native-vision-camera';

export default function ScanStockScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scannedCode, setScannedCode] = useState<{ type: string; value: string } | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  // We explicitly handle the permission request immediately for seamless UX
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Code scanner configuration using Vision Camera
  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'code-128'],
    onCodeScanned: (codes) => {
      // Prevent rapid duplicate scans by pausing scanning once a code is detected
      if (!isScanning) return;
      if (codes.length > 0) {
        const firstCode = codes[0];
        if (firstCode.value && firstCode.type) {
          setIsScanning(false);
          setScannedCode({ type: firstCode.type, value: firstCode.value });
        }
      }
    }
  });

  // Handle missing camera device (e.g. simulator without camera support)
  if (device == null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>No Camera Device Found</Text>
        <Text style={styles.subtext}>Please run on a physical device.</Text>
      </View>
    );
  }
  
  // Handle permission states
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
      {/* UI Overlay */}
      <View style={styles.overlay}>
        {scannedCode ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Barcode Detected!</Text>
            <Text style={styles.resultText}>Type: {scannedCode.type}</Text>
            <Text style={styles.resultText}>Value: {scannedCode.value}</Text>
            <View style={styles.buttonContainer}>
              <Button title="Scan Again" onPress={() => {
                setScannedCode(null);
                setIsScanning(true);
              }} />
            </View>
          </View>
        ) : (
          <View style={styles.scanPrompt}>
            <Text style={styles.promptText}>Point camera at an EAN-13 or Code128 barcode</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    marginBottom: 10,
    fontSize: 18,
    fontWeight: 'bold',
  },
  subtext: {
    color: '#ccc',
    marginBottom: 20,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 50,
  },
  resultCard: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 16,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resultText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#555',
  },
  buttonContainer: {
    marginTop: 15,
    width: '100%',
  },
  scanPrompt: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  promptText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  }
});
