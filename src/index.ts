import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "./route";

export const app = new Elysia()
  .use(swagger())
  .use(authRoutes)
  .get("/", () => "Dashbord")
  .listen(3000);
  console.log('Swagger UI disponible sur http://localhost:3000/swagger')
