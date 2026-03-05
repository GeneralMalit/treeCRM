import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { authRouter } from "./routes/authRoutes";
import { protectedRouter } from "./routes/protectedRoutes";
import { systemRouter } from "./routes/systemRoutes";

export const app = express();

app.use(
  cors({
    origin: env.frontendOrigin,
    credentials: true,
  }),
);
app.use(express.json());

app.use(systemRouter);
app.use("/auth", authRouter);
app.use(protectedRouter);

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});
