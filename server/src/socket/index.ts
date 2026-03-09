import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyAccessToken } from "../lib/jwt";

let io: Server | null = null;

export function setupSocketIO(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*" },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;
    const workspaceId = socket.handshake.query.workspaceId as string;

    if (!token || !workspaceId) {
      return next(new Error("Auth obrigatório"));
    }

    try {
      const payload = verifyAccessToken(token);
      (socket as any).userId = payload.userId;
      (socket as any).workspaceId = workspaceId;
      socket.join(`workspace:${workspaceId}`);
      next();
    } catch {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket conectado: ${(socket as any).userId} [ws:${(socket as any).workspaceId}]`);
    socket.on("disconnect", () => {
      console.log(`Socket desconectado: ${(socket as any).userId}`);
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

// Helpers para emitir eventos
export function emitToWorkspace(workspaceId: string, event: string, data: any) {
  io?.to(`workspace:${workspaceId}`).emit(event, data);
}
