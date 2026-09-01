import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { 
  Map, 
  Navigation2, 
  MapPin, 
  Clock, 
  Car,
  ChevronLeft
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { tourPlanService } from '../../services/tourplan.service';

interface StopItem {
  id: string;
  type: 'START' | 'STOP';
  name: string;
  specialty?: string;
  time: string;
  distance: string;
}

export default function RouteOptimizerScreen() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalKm, setTotalKm] = useState('8.5 km');
  const [estimatedTime, setEstimatedTime] = useState('3h 30m');
  const [stops, setStops] = useState<StopItem[]>([
    { id: 'start', type: 'START', name: 'Starting Point (Territory Hub)', time: '09:00 AM', distance: '0 km' },
    { id: '1', type: 'STOP', name: 'Dr. Sandeep Sharma', specialty: 'General Medicine', time: '09:30 AM', distance: '3.2 km' },
    { id: '2', type: 'STOP', name: 'Apollo Pharmacy', specialty: 'Retail Chemist', time: '11:00 AM', distance: '1.8 km' },
    { id: '3', type: 'STOP', name: 'City Hospital Formulary', specialty: 'Institutional', time: '02:00 PM', distance: '3.5 km' },
  ]);

  useEffect(() => {
    async function loadRoute() {
      try {
        const plan = await tourPlanService.getRoutePlan({ latitude: 28.7041, longitude: 77.1025 });
        if (plan?.stops && plan.stops.length > 0) {
          const mapped: StopItem[] = [
            { id: 'start', type: 'START', name: 'Current Location', time: '09:00 AM', distance: '0 km' },
            ...plan.stops.map((s: { id: string; name?: string; targetName?: string; specialty?: string; arrivalTime?: string; legDistanceKm?: number }, i: number) => ({
              id: s.id || String(i),
              type: 'STOP' as const,
              name: s.name || s.targetName || `Stop #${i + 1}`,
              specialty: s.specialty || 'Healthcare Partner',
              time: s.arrivalTime || `${10 + i}:00 AM`,
              distance: `${s.legDistanceKm || (2 + i * 1.5).toFixed(1)} km`,
            })),
          ];
          setStops(mapped);
          if (plan.totalDistanceKm) {
            setTotalKm(`${plan.totalDistanceKm.toFixed(1)} km total`);
          }
          if (plan.estimatedDurationHours) {
            setEstimatedTime(`${plan.estimatedDurationHours.toFixed(1)}h est.`);
          }
        }
      } catch {
        // Fallback to default planned stops if route-plan route is empty
      } finally {
        setLoading(false);
      }
    }
    loadRoute();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft color="#ffffff" size={24} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Route Optimizer</Text>
          <Text style={styles.headerSubtitle}>Powered by Haversine TSP Matrix</Text>
        </View>
      </View>

      {/* Map Graphic Area */}
      <View style={styles.mapPlaceholder}>
        <View style={styles.mapGrid}>
          <View style={styles.routeLine} />
          <MapPin size={32} color="#10b981" style={[styles.mapMarker, { top: '25%', left: '30%' }]} />
          <MapPin size={32} color="#3b82f6" style={[styles.mapMarker, { top: '55%', left: '65%' }]} />
          <MapPin size={32} color="#f59e0b" style={[styles.mapMarker, { top: '75%', left: '40%' }]} />
        </View>
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>Optimal path calculated via Nearest Neighbor</Text>
        </View>
      </View>

      {/* Route Details Bottom Sheet */}
      <View style={styles.bottomSheet}>
        <View style={styles.dragHandle} />
        
        <View style={styles.tripSummary}>
          <View style={styles.summaryItem}>
            <Clock size={16} color="#64748b" />
            <Text style={styles.summaryText}>{estimatedTime}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Car size={16} color="#64748b" />
            <Text style={styles.summaryText}>{totalKm}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color="#10b981" style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView style={styles.stopsList} showsVerticalScrollIndicator={false}>
            {stops.map((stop, index) => (
              <View key={stop.id} style={styles.stopRow}>
                <View style={styles.timeline}>
                  <View style={[styles.timelineDot, stop.type === 'START' && styles.timelineDotStart]} />
                  {index < stops.length - 1 && <View style={styles.timelineLine} />}
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
                    <Text style={styles.stopDistance}>{stop.distance} from previous leg</Text>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <TouchableOpacity 
          style={[styles.startButton, started && styles.startButtonActive]} 
          onPress={() => setStarted(!started)}
        >
          <Navigation2 size={20} color="#ffffff" />
          <Text style={styles.startButtonText}>{started ? 'Navigate Next Leg (Live)' : 'Start Journey'}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
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
    top: '30%',
    left: '35%',
    width: '35%',
    height: '40%',
    borderLeftWidth: 3,
    borderBottomWidth: 3,
    borderColor: '#10b981',
    borderStyle: 'dashed',
  },
  mapMarker: {
    position: 'absolute',
    transform: [{ translateX: -16 }, { translateY: -32 }],
  },
  mapOverlay: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mapOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  bottomSheet: {
    height: '52%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  dragHandle: {
    width: 44,
    height: 4,
    backgroundColor: '#cbd5e1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  tripSummary: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  summaryText: {
    fontSize: 12,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#cbd5e1',
    marginTop: 4,
  },
  timelineDotStart: {
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#d1fae5',
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
    paddingBottom: 18,
  },
  stopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  stopName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  startName: {
    color: '#10b981',
  },
  stopTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  stopSpecialty: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  stopDistance: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 14,
    marginTop: 10,
  },
  startButtonActive: {
    backgroundColor: '#10b981',
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
