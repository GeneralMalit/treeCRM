"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const socket_io_1 = require("socket.io");
const app_1 = require("./app");
const env_1 = require("./config/env");
const realtime_1 = require("./services/realtime");
const httpServer = (0, node_http_1.createServer)(app_1.app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: env_1.env.frontendOrigin,
        credentials: true,
    },
});
(0, realtime_1.initializeRealtime)(io);
httpServer.listen(env_1.env.port, () => {
    console.log(`Backend listening on http://localhost:${env_1.env.port}`);
});
