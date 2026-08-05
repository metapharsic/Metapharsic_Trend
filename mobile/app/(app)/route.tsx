import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity,
  ScrollView
} from 'react-native';
import { 
  Map, 
  Navigation2, 
  MapPin,
  Clock,
  Car
} from 'lucide-react-native';

const OPTIMIZED_STOPS = [
  { id: '1', type: 'START', name: 'Current Location', time: '09:00 AM', distance: '0 km' },
  { id: '2', type: 'STOP', name: 'Dr. Ananya Sharma', specialty: 'Cardiologist', time: '09:20 AM', distance: '4.2 km' },
  { id: '3', type: 'STOP', name: 'Apollo Pharmacy', specialty: 'Retail', time: '10:15 AM', distance: '1.8 km' },
  { id: '4', type: 'STOP', name: 'Dr. Vikram Singh', specialty: 'General', time: '11:45 AM', distance: '5.5 km' },
];

export default function RouteOptimizerScreen() {
  const [started, setStarted] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Route Optimizer</Text>
        <Text style={styles.headerSubtitle}>Powered by Haversine Matrix</Text>
      </View>

      {/* Mock Map Area */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid}>
          {/* Simulated route line */}
          <View style={styles.routeLine} />
          <MapPin size={32} color="#ef4444" style={[styles.mapMarker, { top: '20%', left: '30%' }]} />
          <MapPin size={32} color="#3b82f6" style={[styles.mapMarker, { top: '50%', left: '60%' }]} />
          <MapPin size={32} color="#3b82f6" style={[styles.mapMarker, { top: '80%', left: '40%' }]} />
        </View>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>Optimal path calculated. Saved 14.2 km.</Text>
        </View>
      </View>

      {/* Route Details */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        
        <View style={styles.tripSummary}>
          <View style={styles.summaryItem}>
            <Clock size={16} color="#64748b" />
            <Text style={styles.summaryText}>4h 15m est.</Text>
          </View>
          <View style={styles.summaryItem}>
            <Car size={16} color="#64748b" />
            <Text style={styles.summaryText}>11.5 km total</Text>
          </View>
        </View>

        <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
          {OPTIMIZED_STOPS.map((stop, index) => (
            <View key={stop.id} style={styles.stopRow}>
              <View style={styles.timeline}>
                <View style={[styles.timelineDot, stop.type === 'START' && styles.timelineDotStart]} />
                {index < OPTIMIZED_STOPS.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.stopContent}>
                <View style={styles.stopHeader}>
                  <Text style={[styles.stopName, stop.type === 'START' && styles.startName]}>
                    {stop.name}
                  </Text>
                  <Text style={styles.stopTime}>{stop.time}</Text>
                </View>
                {stop.specialty && (
                  <Text style={styles.stopSpecialty}>{stop.specialty}</Text>
                )}
                {stop.distance !== '0 km' && (
                  <Text style={styles.stopDistance}>{stop.distance} from previous</Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity 
          style={[styles.startButton, started && styles.startButtonActive]} 
          onPress={() => setStarted(!started)}
        >
          <Navigation2 size={20} color="#ffffff" />
          <Text style={styles.startButtonText}>{started ? 'Navigate to Next Stop' : 'Start Journey'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 24,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  mapGrid: {
    flex: 1,
    opacity: 0.5,
    backgroundColor: '#0f172a',
  },
  routeLine: {
    position: 'absolute',
    top: '35%',
    left: '35%',
    width: '30%',
    height: '30%',
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
  },
  mapMarker: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -32 }],
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  mapOverlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bottomSheet: {
    height: '50%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandle: {
    width: 48,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  tripSummary: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  stopsList: {
    flex: 1,
  },
  stopRow: {
    flexDirection: 'row',
  },
  timeline: {
    alignItems: 'center',
    width: 24,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#cbd5e1',
    marginTop: 4,
  },
  timelineDotStart: {
    backgroundColor: '#3b82f6',
    borderWidth: 3,
    borderColor: '#dbeafe',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 4,
  },
  stopContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 24,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  startName: {
    color: '#3b82f6',
  },
  stopTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
  },
  stopSpecialty: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  stopDistance: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  startButton: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  startButtonActive: {
    backgroundColor: '#10b981',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
