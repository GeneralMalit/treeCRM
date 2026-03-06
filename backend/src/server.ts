import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app";
import { env } from "./config/env";
import { initializeRealtime } from "./services/realtime";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.frontendOrigin,
    credentials: true,
  },
});

initializeRealtime(io);

httpServer.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
