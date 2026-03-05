const { createServer } = require("node:http");
const { Server } = require("socket.io");
const { app } = require("./app");
const { env } = require("./config/env");

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

