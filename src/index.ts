import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { authRoutes } from "../src/routes/Auth/authRoutes";
import { importRoute } from "../src/routes/contribuables/importRoutes";
import { contribuableRoutes } from "./routes/contribuables/contribuableRoutes";

const app = new Elysia()
  // Configuration Swagger améliorée
  .use(swagger({
    documentation: {
      info: {
        title: "API Gestion Contribuables",
        version: "1.0.0",
        description: "API pour la gestion des contribuables"
      },
      tags: [
        { name: "Auth", description: "Authentification des utilisateurs" },
        { name: "Import", description: "Importation de fichiers Excel" },
        { name: "Contribuables", description: "Gestion des contribuables" }
      ]
    }
  }))
  
  // Routes
  .use(authRoutes)
  .use(importRoute)
  .use(contribuableRoutes)
  
  // Route de base
  .get("/", () => ({
    status: "API en fonctionnement",
    routes: [
      "/auth/login",
      "/import/excel",
      "/contribuables"
    ],
    documentation: "/swagger"
  }))
  
  // Gestion des erreurs globale
  .onError(({ code, error }) => {
    console.error(`[${code}]`, error);
    return {
      error: "Une erreur est survenue",
      ...(process.env.NODE_ENV !== 'production' && { details: error })
    };
  });

app.listen(3000, ({ hostname, port }) => {
  console.log(`🦊 Serveur démarré sur http://${hostname}:${port}`);
  console.log(`📚 Documentation Swagger: http://${hostname}:${port}/swagger`);
});

export type App = typeof app;