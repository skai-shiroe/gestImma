import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { cors } from "@elysiajs/cors"; // Add this import
import { authRoutes } from "../src/routes/Auth/authRoutes";
import { importRoute } from "../src/routes/contribuables/importRoutes";
import { contribuableRoutes } from "./routes/contribuables/contribuableRoutes";
export { app }

const app = new Elysia()
  // Add CORS configuration
  .use(
    cors({
      origin: true, // Allow all origins (in production you might want to restrict this)
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 86400, // 24 hours
    })
  )
  // Configuration Swagger améliorée
  .use(
    swagger({
      documentation: {
        info: {
          title: "API Gestion Contribuables",
          version: "1.0.0",
          description: "API pour la gestion des contribuables",
        },
        tags: [
          { name: "Auth", description: "Authentification des utilisateurs" },
          { name: "Role", description: "Gestion des roles et permission" },
          { name: "Import", description: "Importation de fichiers Excel" },
          { name: "Contribuables", description: "Gestion des contribuables" },
        ],
      },
    })
  )

  // Routes
  .use(authRoutes)
  .use(importRoute)
  .use(contribuableRoutes)

  // Route de base
  .get("/", () => ({
    status: "API en fonctionnement",
    routes: ["/auth/login", "/import/excel", "/contribuables"],
    documentation: "/swagger",
  }))

  // Gestion des erreurs globale
  .onError(({ code, error }) => {
    console.error(`[${code}]`, error);
    return {
      error: "Une erreur est survenue",
      ...(process.env.NODE_ENV !== "production" && { details: error }),
    };
  });

app.listen(3000, ({ hostname, port }) => {
  console.log(`🦊 Serveur démarré sur http://${hostname}:${port}`);
  console.log(`📚 Documentation Swagger: http://${hostname}:${port}/swagger`);
});

export type App = typeof app;
