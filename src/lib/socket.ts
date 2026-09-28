import { io } from 'socket.io-client';
import { SOCKET_ORIGIN } from './apiBase';

export function createSocket(token: string) {
  return io(SOCKET_ORIGIN ?? '/', { auth: { token } });
}
