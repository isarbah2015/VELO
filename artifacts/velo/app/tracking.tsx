import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Svg, Rect, Path, Circle, Line } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '@/context/AppContext';

const { width, height } = Dimensions.get('window');

type Phase = 'arriving' | 'inProgress' | 'arrived';

const ARRIVAL_DURATION_MS = 25000; // 25 seconds simulates "4 min" ETA
const RIDE_DURATION_MS = 30000;    // 30 seconds simulates the ride

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TrackingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cancelRide, completeRide, getDefaultPayment } = useApp();
  const params = useLocalSearchParams<{
    rideId: string;
    from: string;
    to: string;
    type: string;
    price: string;
    driverName: string;
    driverRating: string;
  }>();
  const rideId = params.rideId;

  const from = params.from ?? 'Accra Mall, East Legon';
  const to = params.to ?? 'Osu Oxford Street';
  const rideType = (params.type ?? 'Standard') as 'Standard' | 'Premium' | 'Group';
  const price = parseFloat(params.price ?? '42');
  const driverName = params.driverName ?? 'Kofi M.';
  const driverRating = parseFloat(params.driverRating ?? '4.8');

  const [phase, setPhase] = useState<Phase>('arriving');
  const [etaSeconds, setEtaSeconds] = useState(240); // 4:00
  const [rideSeconds, setRideSeconds] = useState(0);
  const [driverPos, setDriverPos] = useState({ x: 60, y: height * 0.6 });
  const [rating, setRating] = useState(0);

  const mapW = width;
  const mapH = height * 0.55;
  const pickupX = mapW * 0.5;
  const pickupY = mapH * 0.45;
  const destX = mapW * 0.78;
  const destY = mapH * 0.28;

  const phaseRef = useRef<Phase>('arriving');
  const startRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Driver animation & timers
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const startPos = { x: 60, y: mapH * 0.75 };
    startRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;

      if (phaseRef.current === 'arriving') {
        const progress = Math.min(elapsed / ARRIVAL_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 2); // ease-out
        setDriverPos({
          x: startPos.x + (pickupX - startPos.x) * eased,
          y: startPos.y + (pickupY - startPos.y) * eased,
        });
        const remaining = Math.max(0, 240 - Math.floor(elapsed / 1000));
        setEtaSeconds(remaining);
        if (progress >= 1) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPhase('inProgress');
          phaseRef.current = 'inProgress';
          startRef.current = Date.now();
        }
      } else if (phaseRef.current === 'inProgress') {
        const rideElapsed = Date.now() - startRef.current;
        setRideSeconds(Math.floor(rideElapsed / 1000));
        if (rideElapsed >= RIDE_DURATION_MS) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPhase('arrived');
          phaseRef.current = 'arrived';
        }
      }
    }, 150);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const handleCancel = () => {
    Alert.alert('Cancel Ride', 'Are you sure you want to cancel this ride?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (rideId) await cancelRide(rideId);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const handleDone = async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const defaultPayment = getDefaultPayment();
    if (rideId) {
      await completeRide(rideId, {
        durationMin: Math.ceil(rideSeconds / 60) + 20,
        paymentMethod: defaultPayment?.name ?? 'MTN MoMo',
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const isWeb = Platform.OS === 'web';
  const topPad = insets.top + (isWeb ? 67 : 0);

  // Progress for inProgress route animation
  const rideProgress = phase === 'inProgress'
    ? Math.min(rideSeconds / (RIDE_DURATION_MS / 1000), 1)
    : phase === 'arrived' ? 1 : 0;

  const routeEndX = pickupX + (destX - pickupX) * rideProgress;
  const routeEndY = pickupY + (destY - pickupY) * rideProgress;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Map */}
      <View style={[styles.mapArea, { height: mapH, marginTop: topPad + 60 }]}>
        <TrackingMap
          width={mapW}
          height={mapH}
          phase={phase}
          driverPos={driverPos}
          pickupPos={{ x: pickupX, y: pickupY }}
          destPos={{ x: destX, y: destY }}
          routeEnd={{ x: routeEndX, y: routeEndY }}
        />
      </View>

      {/* Floating Header */}
      <View style={[styles.floatingHeader, { top: topPad + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (phase !== 'arrived') {
            handleCancel();
          } else {
            router.back();
          }
        }}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {phase === 'arriving' ? 'Driver on the way' : phase === 'inProgress' ? 'Ride in progress' : "You've arrived!"}
          </Text>
          <Text style={styles.headerSub}>{driverName} · {rideType} Bike</Text>
        </View>
        <TouchableOpacity style={styles.sosBtn}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Bottom Panel */}
      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, isWeb ? 34 : 8) + 16 }]}>

        {/* Phase: Arriving */}
        {phase === 'arriving' && (
          <ArrivingPanel
            etaSeconds={etaSeconds}
            driverName={driverName}
            driverRating={driverRating}
            onCancel={handleCancel}
          />
        )}

        {/* Phase: In Progress */}
        {phase === 'inProgress' && (
          <InProgressPanel
            from={from}
            to={to}
            rideSeconds={rideSeconds}
            driverName={driverName}
          />
        )}

        {/* Phase: Arrived */}
        {phase === 'arrived' && (
          <ArrivedPanel
            to={to}
            price={price}
            rideSeconds={rideSeconds + (RIDE_DURATION_MS / 1000)}
            driverName={driverName}
            driverRating={driverRating}
            rating={rating}
            setRating={setRating}
            onDone={handleDone}
          />
        )}
      </View>
    </View>
  );
}

function TrackingMap({
  width, height, phase, driverPos, pickupPos, destPos, routeEnd,
}: {
  width: number; height: number; phase: Phase;
  driverPos: { x: number; y: number };
  pickupPos: { x: number; y: number };
  destPos: { x: number; y: number };
  routeEnd: { x: number; y: number };
}) {
  const bW = width / 5;
  const bH = height / 5;
  const rW = 14;

  return (
    <Svg width={width} height={height}>
      <Rect fill="#0C0D10" width={width} height={height} />

      {/* City grid */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2, 3, 4].map((row) => (
          <Rect
            key={`b-${col}-${row}`}
            x={col * bW + rW / 2}
            y={row * bH + rW / 2}
            width={bW - rW}
            height={bH - rW}
            fill="#13131A"
            rx={6}
          />
        ))
      )}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={`hr-${i}`} x={0} y={i * bH - rW / 2} width={width} height={rW} fill="#1A1B22" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Rect key={`vr-${i}`} x={i * bW - rW / 2} y={0} width={rW} height={height} fill="#1A1B22" />
      ))}

      {/* Arriving: dashed guide from driver to pickup */}
      {phase === 'arriving' && (
        <Path
          d={`M ${driverPos.x} ${driverPos.y} L ${pickupPos.x} ${pickupPos.y}`}
          stroke="#FFD000"
          strokeWidth={3}
          strokeDasharray="8,6"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* InProgress / Arrived: solid route from pickup toward destination */}
      {(phase === 'inProgress' || phase === 'arrived') && (
        <>
          <Path
            d={`M ${pickupPos.x} ${pickupPos.y} L ${destPos.x} ${destPos.y}`}
            stroke="#27272A"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d={`M ${pickupPos.x} ${pickupPos.y} L ${routeEnd.x} ${routeEnd.y}`}
            stroke="#4DB8FF"
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Pickup marker */}
      <Circle cx={pickupPos.x} cy={pickupPos.y} r={16} fill="#FFD000" opacity={0.2} />
      <Circle cx={pickupPos.x} cy={pickupPos.y} r={8} fill="#FFD000" />

      {/* Destination marker */}
      {(phase === 'inProgress' || phase === 'arrived') && (
        <>
          <Circle cx={destPos.x} cy={destPos.y} r={20} fill="#EF4444" opacity={0.2} />
          <Circle cx={destPos.x} cy={destPos.y} r={10} fill="#EF4444" />
          <Circle cx={destPos.x} cy={destPos.y} r={4} fill="#FFF" />
        </>
      )}

      {/* Driver marker */}
      {phase === 'arriving' && (
        <>
          <Circle cx={driverPos.x} cy={driverPos.y} r={22} fill="#FFD000" opacity={0.2} />
          <Circle cx={driverPos.x} cy={driverPos.y} r={16} fill="#FFD000" />
          <Circle cx={driverPos.x} cy={driverPos.y} r={10} fill="#09090B" />
        </>
      )}

      {/* In-progress: rider position (moves along route) */}
      {phase === 'inProgress' && (
        <>
          <Circle cx={routeEnd.x} cy={routeEnd.y} r={20} fill="#4DB8FF" opacity={0.25} />
          <Circle cx={routeEnd.x} cy={routeEnd.y} r={13} fill="#4DB8FF" />
          <Circle cx={routeEnd.x} cy={routeEnd.y} r={6} fill="#09090B" />
        </>
      )}
    </Svg>
  );
}

function ArrivingPanel({
  etaSeconds, driverName, driverRating, onCancel,
}: {
  etaSeconds: number; driverName: string; driverRating: number;
  onCancel: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.driverRow}>
        <View style={styles.driverAvatar}>
          <Ionicons name="person" size={28} color="#FFD000" />
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driverName}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={13} color="#FFD000" />
            <Text style={styles.ratingText}>{driverRating} rating</Text>
          </View>
        </View>
        <View style={styles.etaBox}>
          <Text style={styles.etaTime}>{formatTime(etaSeconds)}</Text>
          <Text style={styles.etaLabel}>ETA</Text>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={[styles.statusStep, styles.statusStepActive]}>
          <Ionicons name="bicycle" size={14} color="#000" />
          <Text style={styles.statusStepText}>On the way</Text>
        </View>
        <View style={styles.statusLine} />
        <View style={styles.statusStep}>
          <Ionicons name="navigate" size={14} color="#52525B" />
          <Text style={[styles.statusStepText, { color: '#52525B' }]}>Riding</Text>
        </View>
        <View style={styles.statusLine} />
        <View style={styles.statusStep}>
          <Ionicons name="flag" size={14} color="#52525B" />
          <Text style={[styles.statusStepText, { color: '#52525B' }]}>Arrived</Text>
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

      <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
        <Text style={styles.cancelBtnText}>Cancel Ride</Text>
      </TouchableOpacity>
    </View>
  );
}

function InProgressPanel({
  from, to, rideSeconds, driverName,
}: {
  from: string; to: string; rideSeconds: number; driverName: string;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.inProgressHeader}>
        <View style={styles.timerBox}>
          <Text style={styles.timerValue}>{formatTime(rideSeconds)}</Text>
          <Text style={styles.timerLabel}>Ride time</Text>
        </View>
        <View style={styles.statusBadgeGreen}>
          <Ionicons name="radio-button-on" size={10} color="#22C55E" />
          <Text style={styles.statusBadgeText}>In Progress</Text>
        </View>
      </View>

      <View style={styles.routeMini}>
        <View style={styles.routeMiniRow}>
          <View style={styles.dotYellow} />
          <Text style={styles.routeMiniText} numberOfLines={1}>{from}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeMiniRow}>
          <View style={styles.dotRed} />
          <Text style={styles.routeMiniText} numberOfLines={1}>{to}</Text>
        </View>
      </View>

      <View style={styles.statusBar}>
        <View style={[styles.statusStep, styles.statusStepDone]}>
          <Ionicons name="bicycle" size={14} color="#22C55E" />
          <Text style={[styles.statusStepText, { color: '#22C55E' }]}>On the way</Text>
        </View>
        <View style={[styles.statusLine, { backgroundColor: '#22C55E' }]} />
        <View style={[styles.statusStep, styles.statusStepActive]}>
          <Ionicons name="navigate" size={14} color="#000" />
          <Text style={styles.statusStepText}>Riding</Text>
        </View>
        <View style={styles.statusLine} />
        <View style={styles.statusStep}>
          <Ionicons name="flag" size={14} color="#52525B" />
          <Text style={[styles.statusStepText, { color: '#52525B' }]}>Arrived</Text>
        </View>
      </View>

      <View style={styles.safetyNote}>
        <Ionicons name="shield-checkmark" size={16} color="#22C55E" />
        <Text style={styles.safetyNoteText}>Your ride is being tracked • Stay safe</Text>
      </View>
    </View>
  );
}

function ArrivedPanel({
  to, price, rideSeconds, driverName, driverRating, rating, setRating, onDone,
}: {
  to: string; price: number; rideSeconds: number; driverName: string;
  driverRating: number; rating: number;
  setRating: (r: number) => void; onDone: () => void;
}) {
  return (
    <View style={styles.panel}>
      <View style={styles.arrivedHeader}>
        <View style={styles.arrivedIconWrap}>
          <Ionicons name="checkmark-circle" size={36} color="#22C55E" />
        </View>
        <View>
          <Text style={styles.arrivedTitle}>You've arrived!</Text>
          <Text style={styles.arrivedSub}>{to}</Text>
        </View>
      </View>

      <View style={styles.fareCard}>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Fare Charged</Text>
          <Text style={styles.fareAmount}>₵{price.toFixed(2)}</Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Duration</Text>
          <Text style={styles.fareValue}>{formatTime(Math.floor(rideSeconds))}</Text>
        </View>
        <View style={styles.fareRow}>
          <Text style={styles.fareLabel}>Payment</Text>
          <Text style={styles.fareValue}>MTN MoMo</Text>
        </View>
      </View>

      <View style={styles.rateSection}>
        <Text style={styles.rateSectionTitle}>Rate {driverName}</Text>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((s) => (
            <TouchableOpacity key={s} onPress={() => {
              setRating(s);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}>
              <Ionicons
                name={s <= rating ? 'star' : 'star-outline'}
                size={32}
                color={s <= rating ? '#FFD000' : '#3F3F46'}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}>
        <Text style={styles.doneBtnText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  mapArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  floatingHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(19,19,22,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  headerCenter: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#71717A',
  },
  sosBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#131316',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  panel: {
    padding: 20,
    gap: 16,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  driverAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#252528',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD000',
  },
  driverInfo: {
    flex: 1,
    gap: 4,
  },
  driverName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    color: '#A1A1AA',
  },
  etaBox: {
    alignItems: 'center',
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  etaTime: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFD000',
  },
  etaLabel: {
    fontSize: 11,
    color: '#71717A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  statusStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#252528',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusStepActive: {
    backgroundColor: '#FFD000',
  },
  statusStepDone: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  statusStepText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  statusLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#27272A',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  contactBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  contactBtnText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
  inProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timerBox: {
    gap: 2,
  },
  timerValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timerLabel: {
    fontSize: 12,
    color: '#71717A',
  },
  statusBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22C55E',
  },
  routeMini: {
    backgroundColor: '#1C1C1F',
    borderRadius: 12,
    padding: 14,
    gap: 0,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  routeMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  routeConnector: {
    width: 2,
    height: 12,
    backgroundColor: '#3F3F46',
    marginLeft: 4,
  },
  dotYellow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD000',
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  routeMiniText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    flex: 1,
  },
  safetyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(34,197,94,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  safetyNoteText: {
    fontSize: 13,
    color: '#22C55E',
    flex: 1,
  },
  arrivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  arrivedIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  arrivedTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  arrivedSub: {
    fontSize: 13,
    color: '#71717A',
  },
  fareCard: {
    backgroundColor: '#1C1C1F',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  fareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fareLabel: {
    fontSize: 13,
    color: '#71717A',
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFD000',
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rateSection: {
    gap: 12,
    alignItems: 'center',
  },
  rateSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stars: {
    flexDirection: 'row',
    gap: 8,
  },
  doneBtn: {
    backgroundColor: '#FFD000',
    borderRadius: 14,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
});
