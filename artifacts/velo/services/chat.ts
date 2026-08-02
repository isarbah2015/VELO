import {
  collection, doc, addDoc, updateDoc, query, orderBy, onSnapshot, serverTimestamp, type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

// Messages live under the ride they belong to (rides/{id}/messages), so a
// chat is automatically scoped to one trip and cleaned up with it.
export async function sendMessage(rideId: string, senderId: string, senderName: string, text: string) {
  const body = text.trim();
  if (!body) return;
  await addDoc(collection(db, 'rides', rideId, 'messages'), {
    senderId,
    senderName,
    text: body,
    createdAt: serverTimestamp(),
    // Client clock as a fallback so ordering/display works before the
    // serverTimestamp resolves on the local optimistic snapshot.
    clientAt: Date.now(),
  });
}

// Read receipts. Each side stamps the time it last viewed the chat onto the
// ride doc (chatReads.{uid}); the other side shows "Seen" on their latest
// message once that stamp passes the message's time. Kept on the ride doc
// (not per-message) so it's one cheap write per view, not one per message.
export async function markChatRead(rideId: string, uid: string) {
  try {
    await updateDoc(doc(db, 'rides', rideId), { [`chatReads.${uid}`]: Date.now() });
  } catch {
    // best-effort — a missed read stamp only means "Seen" shows a beat late
  }
}

export function watchChatReads(
  rideId: string,
  callback: (reads: Record<string, number>) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'rides', rideId),
    (snap) => callback((snap.data()?.chatReads as Record<string, number>) ?? {}),
    (err) => { console.warn('[watchChatReads] listener error:', (err as any).code ?? err.message); callback({}); }
  );
}

export function watchMessages(rideId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'rides', rideId, 'messages'), orderBy('clientAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            senderId: data.senderId,
            senderName: data.senderName,
            text: data.text,
            createdAt: data.clientAt ?? Date.now(),
          } as ChatMessage;
        })
      );
    },
    (err) => { console.warn('[watchMessages] listener error:', (err as any).code ?? err.message); callback([]); }
  );
}
