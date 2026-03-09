// --------------------------------------------------------------------------
// Socket.io client — single managed connection per session.
// --------------------------------------------------------------------------

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/**
 * Connect (or reconnect) the Socket.io client.
 *
 * @param token  JWT access token for authentication.
 * @param workspaceId  Current workspace ID sent as part of the auth payload.
 */
export function connectSocket(token: string, workspaceId: string): Socket {
  // Tear down any existing connection first.
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(window.location.origin, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    auth: {
      token,
      workspaceId,
    },
  });

  socket.on("connect", () => {
    console.log("[socket] connected", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("[socket] connect_error", err.message);
  });

  return socket;
}

/**
 * Return the current socket instance (may be null if not yet connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Gracefully disconnect and clear the socket reference.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
