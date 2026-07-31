import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '@/context/AppContext';
import { sendMessage, watchMessages, type ChatMessage } from '@/services/chat';

// Per-ride chat between rider and driver. Both open it from their live trip
// screen; messages stream in realtime from rides/{id}/messages.
export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useApp();
  const params = useLocalSearchParams<{ rideId: string; otherName?: string }>();
  const rideId = params.rideId;
  const otherName = params.otherName ?? 'Chat';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (!rideId) return;
    return watchMessages(rideId, (msgs) => {
      setMessages(msgs);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    });
  }, [rideId]);

  const handleSend = async () => {
    if (!user || !rideId || !text.trim()) return;
    const body = text.trim();
    setText('');
    await sendMessage(rideId, user.uid, user.name, body);
  };

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
          renderItem={({ item }) => {
            const mine = item.senderId === user?.uid;
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && { color: '#000' }]}>{item.text}</Text>
                </View>
              </View>
            );
          }}
        />

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
