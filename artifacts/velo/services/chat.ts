import {
  collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, type Unsubscribe,
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

export function watchMessages(rideId: string, callback: (msgs: ChatMessage[]) => void): Unsubscribe {
  const q = query(collection(db, 'rides', rideId, 'messages'), orderBy('clientAt', 'asc'));
  return onSnapshot(q, (snap) => {
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
  });
}
