import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/api$/, '')
  : undefined;

export function createSocket(token: string) {
  return io(SOCKET_URL ?? '/', { auth: { token } });
}
