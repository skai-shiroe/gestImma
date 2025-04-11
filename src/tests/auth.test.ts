import { describe, expect, it, beforeAll, afterAll } from "bun:test";
import { app } from "../index";
import { prisma } from "../lib/prisma";
  // Variables pour stocker les données de test
  let testServer: ReturnType<typeof app.listen>;
  let testPort: number;
  let testUserEmail = `test-${Date.now()}@example.com`;
  let testUserId: string;
  let accessToken: string;
  let refreshToken: string;

  // Configuration du serveur de test
  beforeAll(async () => {
    // Démarrer le serveur sur un port aléatoire
    testServer = app.listen(0, ({ port }) => {
      testPort = port;
      console.log(`Test server running on port ${port}`);
    });
  
    // Attendre un peu pour s'assurer que le serveur est démarré et le port est assigné
    await new Promise(resolve => setTimeout(resolve, 100));
  
    // Nettoyer la base de données de test avant de commencer
    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    });
  
    // S'assurer que le rôle User existe
    const userRole = await prisma.role.findUnique({
      where: { name: "User" }
    });
  
    if (!userRole) {
      await prisma.role.create({
        data: {
          name: "User",
          description: "Utilisateur standard"
        }
      });
    }
  });

  afterAll(async () => {
    // Nettoyer après les tests
    await prisma.user.deleteMany({
      where: { email: testUserEmail }
    });

    // Fermer le serveur
    testServer.stop();

    // Fermer la connexion Prisma
    await prisma.$disconnect();
  });

  describe("Tests d'authentification", () => {
    it("Devrait créer un nouvel utilisateur", async () => {
      const response = await fetch(`http://localhost:${testPort}/api/auth/sign-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test User",
          email: testUserEmail,
          password: "Password123!",
          isAdult: true
        })
      });

      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.message).toBe("Account created successfully");
      expect(data.data.user.email).toBe(testUserEmail);

      testUserId = data.data.user.id;
      });    it("Ne devrait pas créer un utilisateur avec un email existant", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-up`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User Duplicate",
        email: testUserEmail,
        password: "Password123!",
        isAdult: true
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(409); // Conflict
    expect(data.message).toContain("already exists");
  });  
  it("Devrait se connecter avec l'utilisateur créé", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: "Password123!"
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toBe("Sig-in successfully");
    
    // Récupérer les tokens pour les tests suivants
    accessToken = data.data.accessToekn;
    refreshToken = data.data.refreshToken;
    
    // Vérifier que les cookies sont définis
    expect(response.headers.get("set-cookie")).toBeTruthy();
  });
  
  it("Ne devrait pas se connecter avec un mot de passe incorrect", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: "WrongPassword123!"
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.message).toContain("incorrect");
  });
  
  it("Ne devrait pas se connecter avec un email inexistant", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nonexistent@example.com",
        password: "Password123!"
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.message).toContain("incorrect");
  });
  
  it("Devrait récupérer le profil de l'utilisateur connecté", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/me`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.data.user.email).toBe(testUserEmail);
  });
  
  it("Ne devrait pas accéder au profil sans token", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/me`);
    
    expect(response.status).toBe(401);
  });
  
  it("Devrait rafraîchir le token d'accès", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/refresh`, {
      method: "POST",
      headers: {
        "Cookie": `refreshToken=${refreshToken}`
      }
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toBe("Access token generated successfully");
    expect(data.data.accessToken).toBeTruthy();
    
    // Mettre à jour le token pour les tests suivants
    const oldAccessToken = accessToken;
    accessToken = data.data.accessToken;
    
    // Vérifier que le nouveau token est différent
    expect(accessToken).not.toBe(oldAccessToken);
  });
  
  it("Ne devrait pas rafraîchir le token sans refreshToken", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/refresh`, {
      method: "POST"
    });
    
    expect(response.status).toBe(401);
  });
  
  it("Devrait modifier le profil de l'utilisateur", async () => {
    const newName = "Updated Test User";
    
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/modify-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        name: newName
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toBe("Profil mis à jour avec succès");
    expect(data.data.user.name).toBe(newName);
  });
  
  it("Devrait changer le mot de passe de l'utilisateur", async () => {
    const newPassword = "NewPassword123!";
    
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        oldPassword: "Password123!",
        newPassword: newPassword
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toBe("Mot de passe mis à jour avec succès");
    
    // Vérifier que le nouveau mot de passe fonctionne
    const loginResponse = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail,
        password: newPassword
      })
    });
    
    expect(loginResponse.status).toBe(200);
  });
  
  it("Ne devrait pas changer le mot de passe avec un ancien mot de passe incorrect", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        oldPassword: "WrongPassword",
        newPassword: "AnotherPassword123!"
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.message).toContain("incorrect");
  });
  
  it("Devrait déconnecter l'utilisateur", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toBe("Logout successfully");
  });
  
  it("Ne devrait pas accéder aux ressources protégées après déconnexion", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/me`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    
    expect(response.status).not.toBe(200);
  });
  
  it("Devrait initier la réinitialisation du mot de passe", async () => {
    const response = await fetch(`http://localhost:${testServer.server?.port}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserEmail
      })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.message).toContain("e-mail de réinitialisation");
    
    // Récupérer le token de réinitialisation directement depuis la base de données pour le test suivant
    const user = await prisma.user.findUnique({
      where: { email: testUserEmail },
      select: { resetPasswordToken: true }
    });
    
    expect(user?.resetPasswordToken).toBeTruthy();
    
    // Pour le test suivant
    const resetToken = user?.resetPasswordToken;
    
    // Tester la réinitialisation du mot de passe
    if (resetToken) {
      const resetResponse = await fetch(`http://localhost:${testServer.server?.port}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword: "ResetPassword123!"
        })
      });
      
      const resetData = await resetResponse.json();
      expect(resetResponse.status).toBe(200);
      expect(resetData.message).toContain("réinitialisé avec succès");
      
      // Vérifier que le nouveau mot de passe fonctionne
      const loginResponse = await fetch(`http://localhost:${testServer.server?.port}/api/auth/sign-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testUserEmail,
          password: "ResetPassword123!"
        })
      });
      
      expect(loginResponse.status).toBe(200);
    }
  });});
