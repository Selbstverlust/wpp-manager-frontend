import { io, Socket } from 'socket.io-client';

export interface RealtimeEnvelope {
  event: string;
  fullInstanceName: string;
  instanceName: string;
  ownerUserId: string;
  payload: any;
}

export function createMessagesRealtimeSocket(apiBaseUrl: string, token: string): Socket {
  const base = apiBaseUrl.replace(/\/$/, '');
  return io(`${base}/messages-realtime`, {
    transports: ['websocket'],
    auth: { token: `Bearer ${token}` },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1200,
    reconnectionDelayMax: 10000,
  });
}

