import { io } from 'socket.io-client';

let socket = null;

/** Lazily creates a single shared socket connection for the app's lifetime. */
export function getSocket() {
  if (!socket) {
    const url = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    socket = io(url, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}
