import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./route";

const app = new Elysia()
  .use(swagger())
  .use(authRoutes)
  .get("/", () => "e-school api v0")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
