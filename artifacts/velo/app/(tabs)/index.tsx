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
import { watchRide, expireRide, REQUEST_TTL_MS } from '@/services/rides';
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

// Distance/time-based pricing model per tier: fare = base + perKm·km + perMin·min.
// (Estimated trip until live routing distance is wired in.)
const RATE: Record<Ride['type'], { base: number; perKm: number; perMin: number }> = {
  Standard: { base: 5, perKm: 2.5, perMin: 0.5 },
  Premium: { base: 8, perKm: 4.0, perMin: 0.7 },
  Bossu: { base: 12, perKm: 5.0, perMin: 0.9 },
};
const EST_KM = 6.4;
const EST_MIN = 16;
const estimateFare = (type: Ride['type']): number =>
  Math.round(RATE[type].base + RATE[type].perKm * EST_KM + RATE[type].perMin * EST_MIN);
const fareFor = (id: string): number => estimateFare(rideTypeFor(id));

type BookingState = 'idle' | 'confirm' | 'searching' | 'found';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, requestRide, cancelRide } = useApp();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState('standard');
  const [selectedBike, setSelectedBike] = useState(BIKES[0]);
  const [pickup, setPickup] = useState('Accra Mall, East Legon');
  const [destination, setDestination] = useState('Osu Oxford Street');
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [matchedRide, setMatchedRide] = useState<Ride | null>(null);
  const unwatchRef = React.useRef<(() => void) | null>(null);

  const isWeb = Platform.OS === 'web';
  const tabBarHeight = isWeb ? 84 : Math.max(insets.bottom, 8) + 66;

  useEffect(() => () => unwatchRef.current?.(), []);

  // Search timeout: if no driver accepts within the request TTL, stop searching,
  // expire the request (so no driver can still grab a ride the rider gave up on),
  // and let the rider try again — instead of an endless "Finding your rider…".
  useEffect(() => {
    if (bookingState !== 'searching' || !activeRideId) return;
    const t = setTimeout(() => {
      unwatchRef.current?.();
      unwatchRef.current = null;
      expireRide(activeRideId);
      setActiveRideId(null);
      setBookingState('idle');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('No drivers available', 'No driver picked up your request. Please try again in a moment.');
    }, REQUEST_TTL_MS);
    return () => clearTimeout(t);
  }, [bookingState, activeRideId]);

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

      {/* Floating route card — type pickup + destination directly (no modal) */}
      <View style={[styles.routeCard, { top: insets.top + 10 }]}>
        <View style={styles.routeRow}>
          <View style={styles.routeDotYellow} />
          <View style={styles.routeField}>
            <Text style={styles.routeLabel}>Pickup location</Text>
            <TextInput
              style={styles.routeInput}
              value={pickup}
              onChangeText={setPickup}
              placeholder="Set pickup point"
              placeholderTextColor="#71717A"
              returnKeyType="next"
            />
          </View>
          <Ionicons name="locate" size={18} color="#FFD000" />
        </View>
        <View style={styles.routeDivider} />
        <View style={styles.routeRow}>
          <View style={styles.routeDotRedSm} />
          <View style={styles.routeField}>
            <Text style={styles.routeLabel}>Where to?</Text>
            <TextInput
              style={styles.routeInput}
              value={destination}
              onChangeText={setDestination}
              placeholder="Enter destination"
              placeholderTextColor="#71717A"
              returnKeyType="done"
            />
          </View>
        </View>
      </View>

      {/* Bottom sheet — single VELO Standard vehicle card */}
      <View style={[styles.sheet, { paddingBottom: tabBarHeight + 12 }]}>
        <View style={styles.sheetHandle} />

        <View style={styles.vehicleTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bikeName}>{selectedBike.name}</Text>
            <View style={styles.fareRow}>
              <Text style={styles.farePrice}>₵{fareFor(selectedBike.id).toFixed(2)}</Text>
              <Text style={styles.fareSub}> est. fare</Text>
            </View>
            <Text style={styles.fareFormula}>Base ₵5 · ₵2.50/km · ₵0.50/min</Text>
          </View>
          <View style={styles.vehicleIcons}>
            <TouchableOpacity style={styles.roundIcon}>
              <Ionicons name="heart-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundIcon}>
              <Ionicons name="navigate-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.vehicleBody}>
          <View style={styles.vehicleChipsCol}>
            <View style={styles.vChip}>
              <Ionicons name="time-outline" size={14} color="#FFD000" />
              <Text style={styles.vChipText}>{selectedBike.eta} away</Text>
            </View>
            <View style={styles.vChip}>
              <Ionicons name="star" size={14} color="#FFD000" />
              <Text style={styles.vChipText}>{selectedBike.rating} rating</Text>
            </View>
            <View style={styles.vChip}>
              <Ionicons name="person-outline" size={14} color="#FFD000" />
              <Text style={styles.vChipText}>1 seat</Text>
            </View>
          </View>
          <Image source={selectedBike.photo} style={styles.vehicleImg} resizeMode="contain" />
        </View>

        <TouchableOpacity style={styles.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
          <Ionicons name="bicycle" size={18} color="#000000" />
          <Text style={styles.bookNowText}>Book {selectedBike.name}</Text>
        </TouchableOpacity>
      </View>

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
  // Floating route card (inline editable pickup + destination)
  routeCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(19,19,22,0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  routeDotYellow: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#FFD000' },
  routeDotRedSm: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#EF4444' },
  routeField: { flex: 1 },
  routeLabel: { fontSize: 11, color: '#71717A', fontWeight: '600', marginBottom: 1 },
  routeInput: { fontSize: 15, color: '#FFFFFF', fontWeight: '600', padding: 0 },
  routeDivider: { height: 1, backgroundColor: '#27272A', marginLeft: 23 },
  // Single vehicle card
  vehicleTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  fareRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
  farePrice: { fontSize: 26, fontWeight: '900', color: '#FFD000' },
  fareSub: { fontSize: 13, color: '#71717A', fontWeight: '600' },
  fareFormula: { fontSize: 11, color: '#71717A', marginTop: 2 },
  vehicleIcons: { flexDirection: 'row', gap: 8 },
  roundIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#2A2A2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  vehicleChipsCol: { gap: 8 },
  vChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1C1C1F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2A2A2D',
  },
  vChipText: { fontSize: 13, color: '#E4E4E7', fontWeight: '600' },
  vehicleImg: {
    width: 235,
    height: 150,
    marginRight: -18,
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
