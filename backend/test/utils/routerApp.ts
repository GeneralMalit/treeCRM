import express, { type Router } from "express";

export function createRouterApp(router: Router) {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}
