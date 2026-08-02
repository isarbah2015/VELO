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

// Short clock label for a message time (e.g. 3:07 PM).
const timeLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' });

// Per-ride chat between rider and driver. Both open it from their live trip
// screen; messages stream in realtime from rides/{id}/messages.
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, role } = useApp();
  const params = useLocalSearchParams<{ rideId: string; otherName?: string }>();
  const rideId = params.rideId;
  const otherName = params.otherName ?? 'Chat';

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

  // Subscribe to read stamps, and mark this chat read whenever new messages
  // arrive while it's open (so the other side sees "Seen" promptly).
  useEffect(() => {
    if (!rideId) return;
    return watchChatReads(rideId, setReads);
  }, [rideId]);

  useEffect(() => {
    if (rideId && user) markChatRead(rideId, user.uid);
  }, [rideId, user, messages.length]);

  // The other party's last-read time — used to badge "Seen" on my latest
  // message once they've read past it.
  const otherReadAt = useMemo(() => {
    const otherId = Object.keys(reads).find((k) => k !== user?.uid);
    return otherId ? reads[otherId] : 0;
  }, [reads, user?.uid]);

  // Index of my last message that the other side has already seen.
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{otherName}</Text>
          <Text style={styles.headerSub}>Ride chat</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={40} color="#3F3F46" />
              <Text style={styles.emptyText}>Say hello 👋</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && { color: '#000' }]}>{item.text}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaTime}>{timeLabel(item.createdAt)}</Text>
                    {mine && index === lastSeenMineIdx && <Text style={styles.metaSeen}>· Seen</Text>}
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Quick replies — one-tap canned messages for fast coordination. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
          keyboardShouldPersistTaps="handled"
        >
          {quickReplies.map((q) => (
            <TouchableOpacity key={q} style={styles.quickChip} onPress={() => send(q)} activeOpacity={0.85}>
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

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
          >
            <Ionicons name="arrow-up" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#18181B',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#71717A' },
  listContent: { padding: 16, gap: 8, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { color: '#52525B', fontSize: 15 },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: '#FFD000', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#1C1C1F', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: '#FFFFFF', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, paddingHorizontal: 4 },
  metaTime: { fontSize: 10, color: '#52525B' },
  metaSeen: { fontSize: 10, color: '#FFD000', fontWeight: '600' },
  quickRow: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  quickChip: {
    backgroundColor: '#1C1C1F',
    borderWidth: 1,
    borderColor: '#3F3F46',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  quickChipText: { color: '#E4E4E7', fontSize: 13, fontWeight: '600' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#18181B',
  },
  input: {
    flex: 1, maxHeight: 120, backgroundColor: '#1C1C1F', borderRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: '#FFFFFF',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFD000',
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
