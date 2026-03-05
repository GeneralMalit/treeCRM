import { createServer } from "node:http";
import { Server } from "socket.io";
import { app } from "./app";
import { env } from "./config/env";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: env.frontendOrigin,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.emit("connected", { message: "Socket.io connected to TreeCRM backend" });
});

httpServer.listen(env.port, () => {
  console.log(`Backend listening on http://localhost:${env.port}`);
});
