import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { sendMessage, watchMessages, markChatRead, watchChatReads, type ChatMessage } from '@/services/chat';

// Canned one-tap messages, tuned per role so a driver and rider each get the
// phrases they actually reach for during pickup coordination.
const QUICK_REPLIES: Record<'driver' | 'rider', string[]> = {
  driver: ["I'm on my way", "I've arrived", '2 minutes away', 'Where exactly are you?'],
  rider: ["I'm coming out", 'Please wait a moment', "I'm at the pickup point", 'Call me'],
};

const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' });

// Whether two consecutive messages are far enough apart in time to warrant a
// fresh timestamp separator (5 min) — keeps a rapid back-and-forth uncluttered.
const GAP_MS = 5 * 60 * 1000;

// Per-ride chat between rider and driver. Both open it from their live trip
// screen; messages stream in realtime from rides/{id}/messages.
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useApp();
  const params = useLocalSearchParams<{ rideId: string; otherName?: string }>();
  const rideId = params.rideId;
  const otherName = params.otherName ?? 'Chat';
  const initial = (otherName.trim()[0] ?? '?').toUpperCase();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [reads, setReads] = useState<Record<string, number>>({});
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!rideId) return;
    return watchMessages(rideId, (msgs) => {
      setMessages(msgs);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
  }, [rideId]);

  useEffect(() => {
    if (!rideId) return;
    return watchChatReads(rideId, setReads);
  }, [rideId]);

  useEffect(() => {
    if (rideId && user) markChatRead(rideId, user.uid);
  }, [rideId, user, messages.length]);

  const otherReadAt = useMemo(() => {
    const otherId = Object.keys(reads).find((k) => k !== user?.uid);
    return otherId ? reads[otherId] : 0;
  }, [reads, user?.uid]);

  const lastSeenMineIdx = useMemo(() => {
    let idx = -1;
    messages.forEach((m, i) => {
      if (m.senderId === user?.uid && m.createdAt <= otherReadAt) idx = i;
    });
    return idx;
  }, [messages, otherReadAt, user?.uid]);

  const send = async (body: string) => {
    const trimmed = body.trim();
    if (!user || !rideId || !trimmed) return;
    Haptics.selectionAsync();
    await sendMessage(rideId, user.uid, user.name, trimmed);
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await send(body);
  };

  const quickReplies = QUICK_REPLIES[role === 'driver' ? 'driver' : 'rider'];

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header — a transparent floating row, no bar/border, so the chat is one
          continuous full page. */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{otherName}</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSub}>On your trip</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="call" size={20} color="#FFD000" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <FlatList
          ref={listRef}
          style={styles.list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.systemPill}>
              <Ionicons name="lock-closed" size={11} color="#71717A" />
              <Text style={styles.systemText}>Messages are just for this ride</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles" size={30} color="#FFD000" />
              </View>
              <Text style={styles.emptyTitle}>Say hello 👋</Text>
              <Text style={styles.emptyText}>Coordinate your pickup with {otherName.split(' ')[0]}.</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.uid;
            const prev = messages[index - 1];
            const showTime = !prev || item.createdAt - prev.createdAt > GAP_MS;
            const grouped = prev && prev.senderId === item.senderId && !showTime;
            return (
              <>
                {showTime && <Text style={styles.timeSep}>{timeLabel(item.createdAt)}</Text>}
                <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs, { marginTop: grouped ? 2 : 8 }]}>
                  <View
                    style={[
                      styles.bubble,
                      mine ? styles.bubbleMine : styles.bubbleTheirs,
                      mine && !grouped && styles.tailMine,
                      !mine && !grouped && styles.tailTheirs,
                    ]}
                  >
                    <Text style={[styles.bubbleText, mine && { color: '#000' }]}>{item.text}</Text>
                  </View>
                </View>
                {mine && index === lastSeenMineIdx && <Text style={styles.seen}>Seen</Text>}
              </>
            );
          }}
        />

        {/* Quick replies — a fixed-height horizontal row of one-tap phrases. */}
        <View style={styles.quickWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
            keyboardShouldPersistTaps="handled"
          >
            {quickReplies.map((q) => (
              <TouchableOpacity key={q} style={styles.quickChip} onPress={() => send(q)} activeOpacity={0.8}>
                <Text style={styles.quickChipText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor="#52525B"
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingBottom: 10,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#000' },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' },
  headerSub: { fontSize: 12, color: '#A1A1AA' },

  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8, flexGrow: 1 },
  systemPill: {
    alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#141417', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
    marginBottom: 12,
  },
  systemText: { fontSize: 11, color: '#71717A', fontWeight: '500' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,208,0,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  emptyText: { color: '#71717A', fontSize: 14, textAlign: 'center', maxWidth: 240, lineHeight: 20 },

  timeSep: { alignSelf: 'center', color: '#52525B', fontSize: 11, fontWeight: '600', marginVertical: 10 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22 },
  bubbleMine: { backgroundColor: '#FFD000' },
  bubbleTheirs: { backgroundColor: '#1C1C20' },
  tailMine: { borderBottomRightRadius: 6 },
  tailTheirs: { borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, color: '#F4F4F5', lineHeight: 21 },
  seen: { alignSelf: 'flex-end', color: '#71717A', fontSize: 11, fontWeight: '600', marginTop: 3, marginRight: 4 },

  quickWrap: {},
  quickRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: 'center' },
  quickChip: {
    backgroundColor: '#1C1C20', borderWidth: 1, borderColor: '#2A2A30',
    borderRadius: 999, paddingHorizontal: 15, height: 36, justifyContent: 'center',
  },
  quickChipText: { color: '#E4E4E7', fontSize: 13, fontWeight: '600' },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: '#09090B',
  },
  input: {
    flex: 1, maxHeight: 120, minHeight: 44, backgroundColor: '#161619', borderWidth: 1, borderColor: '#26262B',
    borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontSize: 15, color: '#FFFFFF',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
});
