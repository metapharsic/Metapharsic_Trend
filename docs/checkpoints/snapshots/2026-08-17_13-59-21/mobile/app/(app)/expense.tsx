import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  Animated, 
  Easing,
  ActivityIndicator,
  Alert
} from 'react-native';
import { 
  ScanLine, 
  Camera, 
  CheckCircle2, 
  AlertTriangle, 
  Receipt,
  ChevronLeft
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { expenseService } from '../../services/expense.service';

export default function SmartReceiptScannerScreen() {
  const router = useRouter();
  const [scanState, setScanState] = useState<'IDLE' | 'SCANNING' | 'SCANNED' | 'SUCCESS' | 'FRAUD_ALERT'>('IDLE');
  const [amount, setAmount] = useState('450');
  const [category, setCategory] = useState<'TRAVEL' | 'DA' | 'HOTEL' | 'MISC'>('TRAVEL');
  const [description, setDescription] = useState('Daily local travel & fuel allowance');
  const [submitting, setSubmitting] = useState(false);
  
  const scanLinePos = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (scanState === 'SCANNING') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLinePos, {
            toValue: 200,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLinePos, {
            toValue: 0,
            duration: 1200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        ])
      ).start();

      const timer = setTimeout(() => {
        setScanState('SCANNED');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [scanState, scanLinePos]);

  const handleScan = () => {
    setScanState('SCANNING');
  };

  const handleReset = () => {
    setScanState('IDLE');
    scanLinePos.setValue(0);
  };

  const handleSubmitClaim = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid expense amount");
      return;
    }

    setSubmitting(true);
    try {
      await expenseService.submitClaim({
        amount: numAmount,
        category,
        date: new Date().toISOString().split('T')[0],
        description,
      });
      setScanState('SUCCESS');
      Alert.alert("Success", "Expense claim submitted for ASM approval.");
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const msg = errorObj?.response?.data?.error?.message || "Failed to submit expense claim";
      if (msg.includes("Duplicate") || msg.includes("hash")) {
        setScanState('FRAUD_ALERT');
      } else {
        Alert.alert("Submission Error", msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft color="#0f172a" size={24} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Smart Expense Scanner</Text>
            <Text style={styles.headerSubtitle}>AI OCR and Duplicate Detection</Text>
          </View>
        </View>

        <View style={styles.cameraContainer}>
          {scanState === 'IDLE' ? (
            <TouchableOpacity style={styles.cameraPlaceholder} onPress={handleScan}>
              <Camera size={44} color="#94a3b8" />
              <Text style={styles.cameraText}>Tap to Scan Bill / Receipt</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.scanningArea}>
              <View style={styles.mockReceipt}>
                <Receipt size={48} color="#cbd5e1" style={styles.receiptIcon} />
                <View style={styles.receiptLine} />
                <View style={styles.receiptLineShort} />
                <View style={styles.receiptLineTotal} />
              </View>

              {scanState === 'SCANNING' && (
                <Animated.View 
                  style={[
                    styles.scannerLine, 
                    { transform: [{ translateY: scanLinePos }] }
                  ]} 
                >
                  <ScanLine color="#10b981" size={32} />
                </Animated.View>
              )}

              {scanState === 'SCANNING' && (
                <View style={styles.scanningBadge}>
                  <Text style={styles.scanningBadgeText}>AI is auditing receipt hash...</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Claim Input Form */}
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>Claim Details</Text>

          <View style={styles.categoryRow}>
            {(['TRAVEL', 'DA', 'HOTEL', 'MISC'] as const).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryTab, category === cat && styles.categoryTabActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryTabText, category === cat && styles.categoryTabTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Claim Amount (₹)</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g. 450"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description / Purpose</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. Travel to Hauz Khas clinics"
            />
          </View>

          {scanState === 'SUCCESS' ? (
            <View style={styles.successBanner}>
              <CheckCircle2 size={20} color="#10b981" />
              <Text style={styles.successText}>Claim submitted successfully!</Text>
            </View>
          ) : scanState === 'FRAUD_ALERT' ? (
            <View style={styles.fraudBanner}>
              <AlertTriangle size={20} color="#ef4444" />
              <Text style={styles.fraudText}>Duplicate bill detected. Submission blocked.</Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
              onPress={handleSubmitClaim}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit for ASM Approval</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  cameraContainer: {
    height: 180,
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  scanningArea: {
    flex: 1,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockReceipt: {
    width: 140,
    height: 140,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  receiptIcon: {
    marginBottom: 8,
  },
  receiptLine: {
    width: '80%',
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginBottom: 4,
  },
  receiptLineShort: {
    width: '50%',
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginBottom: 6,
  },
  receiptLineTotal: {
    width: '70%',
    height: 6,
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  scannerLine: {
    position: 'absolute',
    left: '30%',
    width: 40,
  },
  scanningBadge: {
    position: 'absolute',
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scanningBadgeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryTab: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    alignItems: 'center',
  },
  categoryTabActive: {
    backgroundColor: '#10b981',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  categoryTabTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  submitBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  successText: {
    color: '#065f46',
    fontWeight: '600',
    fontSize: 13,
  },
  fraudBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  fraudText: {
    color: '#991b1b',
    fontWeight: '600',
    fontSize: 13,
  },
});
