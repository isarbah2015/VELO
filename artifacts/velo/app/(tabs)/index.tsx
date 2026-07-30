import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import LiveMap from '@/components/LiveMap';
import { useApp, type Ride } from '@/context/AppContext';
import { watchRide } from '@/services/rides';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const SERVICES = [
  { id: 'standard', label: 'Standard', icon: 'bicycle' as const, price: '₵2.50/km' },
  { id: 'premium', label: 'Premium', icon: 'bicycle' as const, price: '₵4.00/km' },
  { id: 'group', label: 'Group', icon: 'people' as const, price: '₵3.50/km' },
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
  },
];

type BookingState = 'idle' | 'confirm' | 'searching' | 'found';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, requestRide, cancelRide } = useApp();
  const router = useRouter();
  const [selectedService, setSelectedService] = useState('standard');
  const [selectedBike, setSelectedBike] = useState(BIKES[0]);
  const [destination, setDestination] = useState('Osu Oxford Street');
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [liked, setLiked] = useState(false);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [matchedRide, setMatchedRide] = useState<Ride | null>(null);
  const unwatchRef = React.useRef<(() => void) | null>(null);

  const isWeb = Platform.OS === 'web';
  const tabBarHeight = isWeb ? 120 : Math.max(insets.bottom, 8) + 96;

  useEffect(() => () => unwatchRef.current?.(), []);

  const handleBookNow = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBookingState('confirm');
  };

  const handleConfirmRide = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBookingState('searching');
    const rideId = await requestRide({
      from: 'Accra Mall, East Legon',
      to: destination,
      type: selectedBike.id === 'standard' ? 'Standard' : 'Premium',
      price: 42,
    });
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
        from: 'Accra Mall, East Legon',
        to: destination,
        type: selectedBike.id === 'standard' ? 'Standard' : 'Premium',
        price: '42',
        driverName: matchedRide?.driverName ?? 'Your VELO driver',
        driverRating: '4.8',
      },
    });
  };

  const topPad = insets.top + (isWeb ? 67 : 0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 4 }]}>
          <View style={styles.locationRow}>
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>Current Location</Text>
              <View style={styles.locationNameRow}>
                <Ionicons name="location" size={16} color="#FFD000" />
                <Text style={styles.locationName} numberOfLines={1}>Accra Mall, East Legon</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.notifBtn}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>

          {/* Greeting */}
          <Text style={styles.greeting}>
            Good morning, {user?.name?.split(' ')[0] ?? 'Rider'} 👋
          </Text>
        </View>

        {/* Route Input Card */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <View style={styles.routeTextCol}>
              <Text style={styles.routeFieldLabel}>Pickup Location</Text>
              <Text style={styles.routeFieldValue} numberOfLines={1}>Accra Mall, East Legon</Text>
            </View>
            <TouchableOpacity style={styles.routeGpsBtn}>
              <Ionicons name="locate-outline" size={18} color="#FFD000" />
            </TouchableOpacity>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotRed]} />
            <View style={styles.routeTextCol}>
              <Text style={styles.routeFieldLabel}>Where to go?</Text>
              <Text style={styles.routeFieldValue} numberOfLines={1}>{destination}</Text>
            </View>
            <TouchableOpacity style={styles.routeGpsBtn}>
              <Ionicons name="add" size={20} color="#52525B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Map */}
        <View style={styles.mapContainer}>
          <LiveMap width={width - 32} height={180} mode="route" />
          <LinearGradient
            colors={['transparent', 'rgba(9,9,11,0.95)']}
            style={styles.mapGradientBottom}
          />
          <View style={styles.mapPinContainer}>
            <View style={styles.mapPin}>
              <Ionicons name="location" size={24} color="#FFD000" />
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ride Type</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.servicesScroll}
        >
          {SERVICES.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.serviceChip,
                selectedService === s.id && styles.serviceChipActive,
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedService(s.id);
                setSelectedBike(BIKES.find((b) => b.id === s.id) ?? BIKES[0]);
              }}
            >
              <Ionicons
                name={s.icon}
                size={16}
                color={selectedService === s.id ? '#000' : '#A1A1AA'}
              />
              <Text
                style={[
                  styles.serviceChipText,
                  selectedService === s.id && styles.serviceChipTextActive,
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Bike Card */}
        <View style={styles.bikeCard}>
          <View style={styles.bikeCardTop}>
            <View style={styles.bikeInfo}>
              <Text style={styles.bikeName}>{selectedBike.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.bikePrice}>{selectedBike.price}</Text>
                <Text style={styles.bikePeriod}>/{selectedBike.period}</Text>
              </View>
              <View style={styles.bikeFeatures}>
                <View style={styles.featurePill}>
                  <Ionicons name="shield-checkmark-outline" size={13} color="#A1A1AA" />
                  <Text style={styles.featurePillText}>Helmet</Text>
                </View>
                <View style={styles.featurePill}>
                  <Ionicons name="person-outline" size={13} color="#A1A1AA" />
                  <Text style={styles.featurePillText}>{selectedBike.seats} Seat</Text>
                </View>
                <View style={styles.featurePill}>
                  <Ionicons name="time-outline" size={13} color="#A1A1AA" />
                  <Text style={styles.featurePillText}>{selectedBike.eta}</Text>
                </View>
              </View>
            </View>
            <Image
              source={require('@/assets/images/bike-standard.png')}
              style={styles.bikeImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.bikeCardBottom}>
            <View style={styles.bikeActions}>
              <TouchableOpacity
                style={styles.bikeActionBtn}
                onPress={() => {
                  setLiked((v) => !v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={22}
                  color={liked ? '#EF4444' : '#71717A'}
                />
              </TouchableOpacity>
              <TouchableOpacity style={styles.bikeActionBtn}>
                <Ionicons name="share-social-outline" size={22} color="#71717A" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.bookNowBtn} onPress={handleBookNow} activeOpacity={0.85}>
              <Text style={styles.bookNowText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SOS Banner */}
        <TouchableOpacity style={styles.sosBanner} activeOpacity={0.8}>
          <View style={styles.sosBannerLeft}>
            <Ionicons name="alert-circle" size={22} color="#EF4444" />
            <View>
              <Text style={styles.sosBannerTitle}>Emergency SOS</Text>
              <Text style={styles.sosBannerSub}>One tap to alert contacts & services</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#52525B" />
        </TouchableOpacity>
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={bookingState !== 'idle'}
        transparent
        animationType="slide"
        onRequestClose={handleCloseBooking}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {bookingState === 'confirm' && (
              <ConfirmView
                bike={selectedBike}
                destination={destination}
                onConfirm={handleConfirmRide}
                onCancel={() => setBookingState('idle')}
              />
            )}
            {bookingState === 'searching' && <SearchingView />}
            {bookingState === 'found' && (
              <FoundView driverName={matchedRide?.driverName ?? 'Your VELO driver'} onClose={handleCloseBooking} onTrackRide={handleTrackRide} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ConfirmView({
  bike,
  destination,
  onConfirm,
  onCancel,
}: {
  bike: typeof BIKES[0];
  destination: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <View style={{ gap: 20 }}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>Confirm Your Ride</Text>

      <View style={styles.confirmRoute}>
        <View style={styles.confirmRouteRow}>
          <View style={[styles.routeDot, { width: 10, height: 10 }]} />
          <Text style={styles.confirmRouteText} numberOfLines={1}>Accra Mall, East Legon</Text>
        </View>
        <View style={styles.confirmRouteConnector} />
        <View style={styles.confirmRouteRow}>
          <View style={[styles.routeDot, styles.routeDotRed, { width: 10, height: 10 }]} />
          <Text style={styles.confirmRouteText} numberOfLines={1}>{destination}</Text>
        </View>
      </View>

      <View style={styles.confirmDetails}>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Ride Type</Text>
          <Text style={styles.confirmDetailValue}>{bike.name}</Text>
        </View>
        <View style={styles.confirmDetailRow}>
          <Text style={styles.confirmDetailLabel}>Est. Fare</Text>
          <Text style={[styles.confirmDetailValue, { color: '#FFD000' }]}>₵42.00</Text>
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

      <TouchableOpacity style={styles.bookNowBtn} onPress={onConfirm} activeOpacity={0.85}>
        <Text style={styles.bookNowText}>Confirm Ride</Text>
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

function FoundView({ driverName, onClose, onTrackRide }: { driverName: string; onClose: () => void; onTrackRide: () => void }) {
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
        <TouchableOpacity style={styles.contactBtn}>
          <Ionicons name="call-outline" size={22} color="#FFD000" />
          <Text style={styles.contactBtnText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactBtn}>
          <Ionicons name="chatbubble-outline" size={22} color="#FFD000" />
          <Text style={styles.contactBtnText}>Message</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactBtn}>
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
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationInfo: {
    gap: 2,
  },
  locationLabel: {
    fontSize: 11,
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  locationNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationName: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    maxWidth: 220,
  },
  notifBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1C1C1F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  notifDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: '#09090B',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  routeCard: {
    marginHorizontal: 20,
    backgroundColor: '#1C1C1F',
    borderRadius: 16,
    padding: 16,
    gap: 0,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
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
  routeTextCol: {
    flex: 1,
    gap: 2,
  },
  routeFieldLabel: {
    fontSize: 11,
    color: '#52525B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  routeFieldValue: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  routeGpsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginLeft: 24,
  },
  mapContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  mapGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  mapPinContainer: {
    position: 'absolute',
    top: '40%',
    left: '60%',
    transform: [{ translateX: -12 }, { translateY: -24 }],
  },
  mapPin: {
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeAll: {
    fontSize: 13,
    color: '#FFD000',
    fontWeight: '500',
  },
  servicesScroll: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  serviceChipActive: {
    backgroundColor: '#FFD000',
    borderColor: '#FFD000',
  },
  serviceChipText: {
    fontSize: 13,
    color: '#A1A1AA',
    fontWeight: '600',
  },
  serviceChipTextActive: {
    color: '#000000',
  },
  bikeCard: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  bikeCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  bikeInfo: {
    flex: 1,
    gap: 8,
  },
  bikeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  bikePrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFD000',
  },
  bikePeriod: {
    fontSize: 12,
    color: '#71717A',
  },
  bikeFeatures: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#252528',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featurePillText: {
    fontSize: 12,
    color: '#A1A1AA',
  },
  bikeImage: {
    width: 130,
    height: 90,
  },
  bikeCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bikeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bikeActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNowBtn: {
    backgroundColor: '#FFD000',
    borderRadius: 30,
    paddingHorizontal: 28,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNowText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  sosBanner: {
    marginHorizontal: 16,
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#EF444420',
  },
  sosBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sosBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sosBannerSub: {
    fontSize: 12,
    color: '#71717A',
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
    padding: 24,
    paddingBottom: 36,
    gap: 0,
    borderWidth: 1,
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
