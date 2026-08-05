import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  Animated,
  Easing
} from 'react-native';
import { 
  ScanLine, 
  Camera, 
  CheckCircle2,
  AlertTriangle,
  Receipt
} from 'lucide-react-native';

export default function SmartReceiptScannerScreen() {
  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'SUCCESS' | 'FRAUD_ALERT'>('IDLE');
  
  // Animation value for the scanner line
  const scanLinePos = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (scanState === 'SCANNING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLinePos, {
            toValue: 300,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLinePos, {
            toValue: 0,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Simulate AI processing
      setTimeout(() => {
        setScanState('FRAUD_ALERT'); // Trigger fraud for demonstration
      }, 3500);
    }
  }, [scanState]);

  const handleScan = () => {
    setScanState('SCANNING');
  };

  const handleReset = () => {
    setScanState('IDLE');
    scanLinePos.setValue(0);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Smart Receipt Scanner</Text>
        <Text style={styles.headerSubtitle}>AI-powered OCR and audit checks</Text>
      </View>

      <View style={styles.cameraContainer}>
        {scanState === 'IDLE' ? (
          <TouchableOpacity style={styles.cameraPlaceholder} onPress={handleScan}>
            <Camera size={48} color="#94a3b8" />
            <Text style={styles.cameraText}>Tap to Scan Receipt</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.scanningArea}>
            {/* Mock Receipt Image */}
            <View style={styles.mockReceipt}>
              <Receipt size={64} color="#cbd5e1" style={styles.receiptIcon} />
              <View style={styles.receiptLine} />
              <View style={styles.receiptLine} />
              <View style={styles.receiptLineShort} />
              <View style={styles.receiptLineTotal} />
            </View>

            {/* Scanner Line Overlay */}
            {scanState === 'SCANNING' && (
              <Animated.View 
                style={[
                  styles.scannerLine, 
                  { transform: [{ translateY: scanLinePos }] }
                ]} 
              >
                <ScanLine color="#3b82f6" size={32} />
              </Animated.View>
            )}

            {/* AI Overlay Message */}
            {scanState === 'SCANNING' && (
              <View style={styles.scanningBadge}>
                <Text style={styles.scanningBadgeText}>AI is analyzing document...</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Result Card */}
      <View style={styles.resultContainer}>
        {scanState === 'SUCCESS' && (
          <View style={[styles.resultCard, styles.resultSuccess]}>
            <CheckCircle2 size={24} color="#10b981" />
            <View style={styles.resultContent}>
              <Text style={styles.resultTitle}>Receipt Verified</Text>
              <Text style={styles.resultData}>Date: 2026-08-03</Text>
              <Text style={styles.resultData}>Amount: ₹4,500.00</Text>
              <TouchableOpacity style={styles.submitBtn} onPress={handleReset}>
                <Text style={styles.submitBtnText}>Submit Claim</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {scanState === 'FRAUD_ALERT' && (
          <View style={[styles.resultCard, styles.resultAlert]}>
            <AlertTriangle size={24} color="#ef4444" />
            <View style={styles.resultContent}>
              <Text style={[styles.resultTitle, { color: '#ef4444' }]}>Anomaly Detected!</Text>
              <Text style={styles.resultData}>Hash collision: This exact receipt image was submitted by MR Arjun Mehta on 2026-07-15.</Text>
              <Text style={styles.resultData}>Action: Submission blocked.</Text>
              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#ef4444' }]} onPress={handleReset}>
                <Text style={styles.submitBtnText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {scanState === 'IDLE' && (
          <View style={styles.instructionCard}>
            <Text style={styles.instructionText}>
              Ensure the merchant name, date, and total amount are clearly visible. The AI audit engine will automatically reject duplicate uploads.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    padding: 24,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 24,
    backgroundColor: '#e2e8f0',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  scanningArea: {
    flex: 1,
    backgroundColor: '#334155', // dark background simulating camera view
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockReceipt: {
    width: 200,
    height: 280,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  receiptIcon: {
    alignSelf: 'center',
    marginBottom: 24,
  },
  receiptLine: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 12,
  },
  receiptLineShort: {
    height: 8,
    width: '60%',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 32,
  },
  receiptLineTotal: {
    height: 12,
    width: '40%',
    alignSelf: 'flex-end',
    backgroundColor: '#cbd5e1',
    borderRadius: 6,
  },
  scannerLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  scanningBadge: {
    position: 'absolute',
    bottom: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanningBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultContainer: {
    padding: 24,
    minHeight: 200,
  },
  instructionCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  instructionText: {
    color: '#64748b',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
  },
  resultSuccess: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  resultAlert: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  resultContent: {
    marginLeft: 16,
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#065f46',
    marginBottom: 8,
  },
  resultData: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 4,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
