import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import LiveMap from '@/components/LiveMap';
import { useApp, type Ride } from '@/context/AppContext';
import { watchRide } from '@/services/rides';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { width, height } = Dimensions.get('window');

const SERVICES = [
  { id: 'standard', label: 'Standard', icon: 'bicycle' as const, price: '₵2.50/km' },
  { id: 'premium', label: 'Premium', icon: 'bicycle' as const, price: '₵4.00/km' },
  { id: 'bossu', label: 'Okada Bossu', icon: 'flash' as const, price: '₵5.00/km' },
];

const BIKES = [
  {
    id: 'standard',
    name: 'VELO Standard',
    type: 'Standard Bike',
    price: '₵15.00',
    period: 'per hour',
    seats: 1,
    eta: '5 min',
    rating: 4.8,
    photo: require('@/assets/images/bike-standard.png'),
  },
  {
    id: 'premium',
    name: 'VELO Premium',
    type: 'Premium Bike',
    price: '₵25.00',
    period: 'per hour',
    seats: 1,
    eta: '8 min',
    rating: 4.9,
    photo: require('@/assets/images/bike-premium.png'),
  },
  {
    id: 'bossu',
    name: 'Okada Bossu',
    type: 'Top-tier rider',
    price: '₵35.00',
    period: 'per hour',
    seats: 1,
    eta: '6 min',
    rating: 5.0,
    photo: require('@/assets/images/bike-premium.png'),
  },
];

// Bike id → the ride tier stored on the request. Premium/Bossu are the
// higher tiers a driver earns access to (see services/tiers.ts).
const rideTypeFor = (id: string): Ride['type'] =>
  id === 'standard' ? 'Standard' : id === 'bossu' ? 'Bossu' : 'Premium';

// Flat demo fare per tier (until distance-based pricing lands).
const fareFor = (id: string): number => (id === 'bossu' ? 85 : id === 'premium' ? 68 : 42);

type BookingState = 'idle' | 'confirm' | 'searching' | 'found';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, requestRide, cancelRide } = useApp();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState('standard');
  const [selectedBike, setSelectedBike] = useState(BIKES[0]);
  const [pickup, setPickup] = useState('Accra Mall, East Legon');
  const [destination, setDestination] = useState('Osu Oxford Street');
  const [editLocations, setEditLocations] = useState(false);
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [matchedRide, setMatchedRide] = useState<Ride | null>(null);
  const unwatchRef = React.useRef<(() => void) | null>(null);

  const isWeb = Platform.OS === 'web';
  const tabBarHeight = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  useEffect(() => () => unwatchRef.current?.(), []);

  const handleBookNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBookingState('confirm');
  };

  const handleConfirmRide = async (scheduledFor?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const base = {
      from: pickup,
      to: destination,
      type: rideTypeFor(selectedBike.id),
      price: fareFor(selectedBike.id),
    };

    // Scheduled rides are created for later — no live search now. They land
    // in the request pool at their time and show in the rider's trips list.
    if (scheduledFor) {
      await requestRide({ ...base, scheduledFor });
      setBookingState('idle');
      const when = new Date(scheduledFor).toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' });
      Alert.alert('Ride scheduled', `Your ${base.type} ride is booked for ${when}. We'll match a driver then.`);
      return;
    }

    setBookingState('searching');
    const rideId = await requestRide(base);
    setActiveRideId(rideId);
    unwatchRef.current = watchRide(rideId, (ride) => {
      if (ride?.driverId) {
        setMatchedRide(ride);
        setBookingState('found');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  };

  const handleCloseBooking = () => {
    if (bookingState === 'searching' && activeRideId) {
      cancelRide(activeRideId);
    }
    unwatchRef.current?.();
    unwatchRef.current = null;
    setActiveRideId(null);
    setMatchedRide(null);
    setBookingState('idle');
  };

  const handleTrackRide = () => {
    unwatchRef.current?.();
    unwatchRef.current = null;
    setBookingState('idle');
    router.push({
      pathname: '/tracking',
      params: {
        rideId: activeRideId ?? '',
        from: pickup,
        to: destination,
        type: rideTypeFor(selectedBike.id),
        price: String(fareFor(selectedBike.id)),
        driverName: matchedRide?.driverName ?? 'Your VELO driver',
        driverRating: String(matchedRide?.driverRating ?? '4.8'),
        driverPhone: matchedRide?.driverPhone ?? '',
      },
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Full-page live map background (real map with the pickup→dest route) */}
      <View style={StyleSheet.absoluteFill}>
        <LiveMap width={width} height={height} mode="route" />
      </View>

      {/* Top floating: location pill + bell (no greeting) */}
      <View style={[styles.topBar, { top: insets.top + (isWeb ? 14 : 6) }]}>
        <TouchableOpacity style={styles.locPill} activeOpacity={0.85} onPress={() => setEditLocations(true)}>
          <Ionicons name="location" size={15} color="#FFD000" />
          <Text style={styles.locPillText} numberOfLines={1}>{pickup}</Text>
          <Ionicons name="chevron-down" size={15} color="#71717A" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.bell}>
          <Ionicons name="notifications-outline" size={20} color="#FFFFFF" />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      {/* Bottom sheet — search, ride types, selected bike */}
      <View style={[styles.sheet, { paddingBottom: tabBarHeight + 12 }]}>
        <View style={styles.sheetHandle} />

        <TouchableOpacity style={styles.searchBar} activeOpacity={0.85} onPress={() => setEditLocations(true)}>
          <View style={styles.searchIcon}>
            <Ionicons name="search" size={16} color="#000000" />
          </View>
          <Text style={styles.searchText} numberOfLines={1}>{destination}</Text>
          <Ionicons name="pencil" size={16} color="#52525B" />
        </TouchableOpacity>

        <View style={styles.chipsRow}>
          {SERVICES.map((s) => {
            const active = selectedService === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedService(s.id);
                  setSelectedBike(BIKES.find((b) => b.id === s.id) ?? BIKES[0]);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{s.label}</Text>
                <Text style={[styles.chipPrice, active && styles.chipPriceActive]}>{s.price}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.bikeRow}>
          <View style={styles.bikeMeta}>
            <Text style={styles.bikeName}>{selectedBike.name}</Text>
            <View style={styles.bikeStats}>
              <Ionicons name="time-outline" size={13} color="#A1A1AA" />
              <Text style={styles.bikeStatText}>{selectedBike.eta}</Text>
              <Ionicons name="star" size={13} color="#FFD000" style={{ marginLeft: 8 }} />
              <Text style={styles.bikeStatText}>{selectedBike.rating}</Text>
            </View>
            <View style={styles.priceRow}>
              <Text style={styles.bikePrice}>{selectedBike.price}</Text>
              <Text style={styles.bikePeriod}> /hr</Text>
            </View>
          </View>
          <Image source={selectedBike.photo} style={styles.bikeImg} resizeMode="contain" />
        </View>

        <TouchableOpacity style={styles.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
          <Ionicons name="bicycle" size={18} color="#000000" />
          <Text style={styles.bookNowText}>Book {selectedBike.name}</Text>
        </TouchableOpacity>
      </View>

      {/* Edit pickup + destination */}
      <LocationEditModal
        visible={editLocations}
        pickup={pickup}
        destination={destination}
        onSave={(p, d) => { setPickup(p); setDestination(d); setEditLocations(false); }}
        onClose={() => setEditLocations(false)}
      />

      {/* Booking Modal */}
      <Modal
        visible={bookingState !== 'idle'}
        transparent
        animationType="slide"
        onRequestClose={handleCloseBooking}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
            {bookingState === 'confirm' && (
              <ConfirmView
                bike={selectedBike}
                pickup={pickup}
                destination={destination}
                onConfirm={handleConfirmRide}
                onCancel={() => setBookingState('idle')}
              />
            )}
            {bookingState === 'searching' && <SearchingView />}
            {bookingState === 'found' && (
              <FoundView
                driverName={matchedRide?.driverName ?? 'Your VELO driver'}
                driverPhone={matchedRide?.driverPhone}
                rideId={activeRideId}
                pickup={pickup}
                destination={destination}
                onClose={handleCloseBooking}
                onTrackRide={handleTrackRide}
                onMessage={() => {
                  setBookingState('idle');
                  router.push({
                    pathname: '/chat',
                    params: { rideId: activeRideId ?? '', otherName: matchedRide?.driverName ?? 'Driver' },
                  });
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LocationEditModal({
  visible,
  pickup,
  destination,
  onSave,
  onClose,
}: {
  visible: boolean;
  pickup: string;
  destination: string;
  onSave: (pickup: string, destination: string) => void;
  onClose: () => void;
}) {
  const [p, setP] = useState(pickup);
  const [d, setD] = useState(destination);

  // Re-sync fields whenever the sheet reopens with the current values.
  useEffect(() => {
    if (visible) { setP(pickup); setD(destination); }
  }, [visible, pickup, destination]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { gap: 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Set your route</Text>

          <View style={styles.locField}>
            <View style={[styles.routeDot, { width: 10, height: 10 }]} />
            <TextInput
              style={styles.locInput}
              value={p}
              onChangeText={setP}
              placeholder="Pickup location"
              placeholderTextColor="#52525B"
              returnKeyType="next"
            />
          </View>
          <View style={styles.locField}>
            <View style={[styles.routeDot, styles.routeDotRed, { width: 10, height: 10 }]} />
            <TextInput
              style={styles.locInput}
              value={d}
              onChangeText={setD}
              placeholder="Where to?"
              placeholderTextColor="#52525B"
              returnKeyType="done"
              onSubmitEditing={() => p.trim() && d.trim() && onSave(p.trim(), d.trim())}
            />
          </View>

          <TouchableOpacity
            style={[styles.bookNowBtn, (!p.trim() || !d.trim()) && { opacity: 0.5 }]}
            disabled={!p.trim() || !d.trim()}
            onPress={() => onSave(p.trim(), d.trim())}
            activeOpacity={0.85}
          >
            <Text style={styles.bookNowText}>Save route</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const SCHEDULE_OPTIONS: { label: string; minutes: number }[] = [
  { label: 'Now', minutes: 0 },
  { label: '+30m', minutes: 30 },
  { label: '+1h', minutes: 60 },
  { label: '+2h', minutes: 120 },
];

function ConfirmView({
  bike,
  pickup,
  destination,
  onConfirm,
  onCancel,
}: {
  bike: typeof BIKES[0];
  pickup: string;
  destination: string;
  onConfirm: (scheduledFor?: string) => void;
  onCancel: () => void;
}) {
  const [scheduleMin, setScheduleMin] = useState(0);
  const scheduled = scheduleMin > 0;

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>Confirm Your Ride</Text>

      <View style={styles.confirmRoute}>
        <View style={styles.confirmRouteRow}>
          <View style={[styles.routeDot, { width: 10, height: 10 }]} />
          <Text style={styles.confirmRouteText} numberOfLines={1}>{pickup}</Text>
        </View>
        <View style={styles.confirmRouteConnector} />
        <View style={styles.confirmRouteRow}>
          <View style={[styles.routeDot, styles.routeDotRed, { width: 10, height: 10 }]} />
          <Text style={styles.confirmRouteText} numberOfLines={1}>{destination}</Text>
        </View>
      </View>

      {/* Schedule for later */}
      <View style={{ gap: 10 }}>
        <Text style={styles.scheduleLabel}>When</Text>
        <View style={styles.scheduleRow}>
          {SCHEDULE_OPTIONS.map((o) => {
            const active = scheduleMin === o.minutes;
            return (
              <TouchableOpacity
                key={o.label}
                style={[styles.scheduleChip, active && styles.scheduleChipActive]}
                onPress={() => { Haptics.selectionAsync(); setScheduleMin(o.minutes); }}
                activeOpacity={0.85}
              >
                <Text style={[styles.scheduleChipText, active && styles.scheduleChipTextActive]}>{o.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.confirmDetails}>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Ride Type</Text>
          <Text style={styles.confirmDetailValue}>{bike.name}</Text>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Est. Fare</Text>
          <Text style={[styles.confirmDetailValue, { color: '#FFD000' }]}>₵{fareFor(bike.id).toFixed(2)}</Text>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Driver ETA</Text>
          <Text style={styles.confirmDetailValue}>{bike.eta}</Text>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Payment</Text>
          <Text style={styles.confirmDetailValue}>MTN MoMo</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.bookNowBtn}
        onPress={() => onConfirm(scheduled ? new Date(Date.now() + scheduleMin * 60000).toISOString() : undefined)}
        activeOpacity={0.85}
      >
        <Text style={styles.bookNowText}>{scheduled ? 'Schedule Ride' : 'Confirm Ride'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function SearchingView() {
  return (
    <View style={{ alignItems: 'center', gap: 20, paddingVertical: 24 }}>
      <View style={styles.sheetHandle} />
      <ActivityIndicator size="large" color="#FFD000" />
      <Text style={styles.sheetTitle}>Finding your rider...</Text>
      <Text style={styles.sheetSubtitle}>Connecting you with a nearby VELO rider</Text>
    </View>
  );
}

function FoundView({
  driverName,
  driverPhone,
  rideId,
  pickup,
  destination,
  onClose,
  onTrackRide,
  onMessage,
}: {
  driverName: string;
  driverPhone?: string | null;
  rideId?: string | null;
  pickup: string;
  destination: string;
  onClose: () => void;
  onTrackRide: () => void;
  onMessage: () => void;
}) {
  const handleCall = () => {
    const num = (driverPhone || '').replace(/\s/g, '');
    if (!num) {
      Alert.alert('No number yet', "Your driver's phone number isn't available yet.");
      return;
    }
    Linking.openURL(`tel:${num}`).catch(() => Alert.alert('Cannot place call', 'Calling is not available on this device.'));
  };

  const handleShare = () => {
    Share.share({
      message: `I'm on a VELO ride with ${driverName} from ${pickup} to ${destination}. Track me on VELO.`,
    }).catch(() => {});
  };

  return (
    <View style={{ gap: 20 }}>
      <View style={styles.sheetHandle} />
      <View style={styles.foundHeader}>
        <View style={styles.foundAvatar}>
          <Ionicons name="person" size={32} color="#FFD000" />
        </View>
        <View>
          <Text style={styles.sheetTitle}>Driver Found!</Text>
          <Text style={styles.sheetSubtitle}>{driverName} is on his way</Text>
        </View>
      </View>

      <View style={styles.confirmDetails}>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Rating</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="star" size={14} color="#FFD000" />
            <Text style={styles.confirmDetailValue}>4.9</Text>
          </View>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Bike Plate</Text>
          <Text style={styles.confirmDetailValue}>GR-4521-22</Text>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>ETA</Text>
          <Text style={[styles.confirmDetailValue, { color: '#22C55E' }]}>4 min away</Text>
        </View>
      </View>

      <View style={styles.contactRow}>
        <TouchableOpacity style={styles.contactBtn} onPress={handleCall} activeOpacity={0.8}>
          <Ionicons name="call-outline" size={22} color="#FFD000" />
          <Text style={styles.contactBtnText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactBtn} onPress={onMessage} activeOpacity={0.8}>
          <Ionicons name="chatbubble-outline" size={22} color="#FFD000" />
          <Text style={styles.contactBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactBtn} onPress={handleShare} activeOpacity={0.8}>
          <Ionicons name="share-social-outline" size={22} color="#FFD000" />
          <Text style={styles.contactBtnText}>Share</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.bookNowBtn} onPress={onTrackRide} activeOpacity={0.85}>
        <Text style={styles.bookNowText}>Track My Ride</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
        <Text style={styles.cancelBtnText}>Skip Tracking</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  scheduleLabel: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
  },
  scheduleChipActive: {
    borderColor: '#FFD000',
    backgroundColor: 'rgba(255,208,0,0.12)',
  },
  scheduleChipText: {
    color: '#A1A1AA',
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleChipTextActive: {
    color: '#FFD000',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(28,28,31,0.96)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  locPillText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28,28,31,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  bellDot: {
    position: 'absolute',
    top: 11,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#131316',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#131316',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
    borderTopWidth: 1,
    borderColor: '#27272A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 24,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  searchIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFD000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  chipActive: {
    backgroundColor: '#FFD000',
    borderColor: '#FFD000',
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chipLabelActive: {
    color: '#000000',
  },
  chipPrice: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  chipPriceActive: {
    color: 'rgba(0,0,0,0.65)',
  },
  bikeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bikeMeta: {
    flex: 1,
    gap: 5,
  },
  bikeName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bikeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bikeStatText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  bikePrice: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFD000',
  },
  bikePeriod: {
    fontSize: 12,
    color: '#71717A',
  },
  bikeImg: {
    width: 158,
    height: 104,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFD000',
  },
  routeDotRed: {
    backgroundColor: '#EF4444',
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD000',
    borderRadius: 16,
    height: 54,
  },
  bookNowText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#131316',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 0,
    borderTopWidth: 1,
    borderColor: '#27272A',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: '#71717A',
  },
  confirmRoute: {
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    gap: 0,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  confirmRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  confirmRouteConnector: {
    width: 1,
    height: 16,
    backgroundColor: '#3F3F46',
    marginLeft: 5,
  },
  confirmRouteText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  confirmDetails: {
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  confirmDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confirmDetailLabel: {
    fontSize: 14,
    color: '#71717A',
  },
  confirmDetailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 15,
    color: '#71717A',
  },
  locField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
  },
  locInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    height: '100%',
  },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  foundAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD000',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 12,
  },
  contactBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  contactBtnText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
  },
});
