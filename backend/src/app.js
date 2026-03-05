const express = require("express");
const cors = require("cors");
const { env } = require("./config/env");
const { systemRouter } = require("./routes/systemRoutes");

const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.use(systemRouter);

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = { app };

