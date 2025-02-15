import { Elysia, t } from "elysia";
import { loginBodySchema, signupBodySchema } from "./schema";
import { prisma } from "./lib/prisma";
import { reverseGeocodingAPI } from "./lib/geoapify";
import { jwt } from "@elysiajs/jwt";
import {
  ACCESS_TOKEN_EXP,
  JWT_NAME,
  REFRESH_TOKEN_EXP,
} from "./config/constant";
import { getExpTimestamp } from "./lib/util";
import { authPlugin } from "./plugin";
import { UserRole } from "@prisma/client";

export const authRoutes = new Elysia({ prefix: "api/auth" })
  .use(
    jwt({
      name: JWT_NAME,
      secret: Bun.env.JWT_SECRET!,
    })
  )
// inscription
  .post(
    "/sign-up",
    async ({ body }) => {
      // hash password
      const password = await Bun.password.hash(body.password, {
        algorithm: "bcrypt",
        cost: 10,
      });

      // fetch user location from lat & lon
      let location: any;
      if (body.location) {
        const [lat, lon] = body.location;
        location = await reverseGeocodingAPI(lat, lon);
      }
      const user = await prisma.user.create({
        data: {
          ...body,
          password,
          location,
        },
      });
      return {
        message: "Account created successfully",
        data: {
          user,
        },
      };
    },
    {
      body: signupBodySchema,
      error({ code, set, body }) {
        // handle duplicate email error throw by prisma
        // P2002 duplicate field erro code
        if ((code as unknown) === "P2002") {
          set.status = "Conflict";
          return {
            name: "Error",
            message: `The email address provided ${body.email} already exists`,
          };
        }
      },
    }
  )

// connexion
  .post(
    "/sign-in",
    async ({ body, jwt, cookie: { accessToken, refreshToken }, set }) => {
      // match user email
      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: {
          id: true,
          email: true,
          password: true,
        },
      });

      if (!user) {
        set.status = "Bad Request";
        throw new Error(
          "The email address or password you entered is incorrect"
        );
      }

      // match password
      const matchPassword = await Bun.password.verify(
        body.password,
        user.password,
        "bcrypt"
      );
      if (!matchPassword) {
        set.status = "Bad Request";
        throw new Error(
          "The email address or password you entered is incorrect"
        );
      }

      // create access token
      const accessJWTToken = await jwt.sign({
        sub: user.id,
        exp: getExpTimestamp(ACCESS_TOKEN_EXP),
      });
      accessToken.set({
        value: accessJWTToken,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_EXP,
        path: "/",
      });

      // create refresh token
      const refreshJWTToken = await jwt.sign({
        sub: user.id,
        exp: getExpTimestamp(REFRESH_TOKEN_EXP),
      });
      refreshToken.set({
        value: refreshJWTToken,
        httpOnly: true,
        maxAge: REFRESH_TOKEN_EXP,
        path: "/",
      });

      // set user profile as online
      const updatedUser = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          isOnline: true,
          refreshToken: refreshJWTToken,
        },
      });

      return {
        message: "Sig-in successfully",
        data: {
          user: updatedUser,
          accessToekn: accessJWTToken,
          refreshToken: refreshJWTToken,
        },
      };
    },
    {
      body: loginBodySchema,
    }
  )

// refresh token
  .post(
    "/refresh",
    async ({ cookie: { accessToken, refreshToken }, jwt, set }) => {
      if (!refreshToken.value) {
        // handle error for refresh token is not available
        set.status = "Unauthorized";
        throw new Error("Refresh token is missing");
      }
      // get refresh token from cookie
      const jwtPayload = await jwt.verify(refreshToken.value);
      if (!jwtPayload) {
        // handle error for refresh token is tempted or incorrect
        set.status = "Forbidden";
        throw new Error("Refresh token is invalid");
      }

      // get user from refresh token
      const userId = jwtPayload.sub;

      // verify user exists or not
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });

      if (!user) {
        // handle error for user not found from the provided refresh token
        set.status = "Forbidden";
        throw new Error("Refresh token is invalid");
      }
      // create new access token
      const accessJWTToken = await jwt.sign({
        sub: user.id,
        exp: getExpTimestamp(ACCESS_TOKEN_EXP),
      });
      accessToken.set({
        value: accessJWTToken,
        httpOnly: true,
        maxAge: ACCESS_TOKEN_EXP,
        path: "/",
      });

      // create new refresh token
      const refreshJWTToken = await jwt.sign({
        sub: user.id,
        exp: getExpTimestamp(REFRESH_TOKEN_EXP),
      });
      refreshToken.set({
        value: refreshJWTToken,
        httpOnly: true,
        maxAge: REFRESH_TOKEN_EXP,
        path: "/",
      });

      // set refresh token in db
      await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          refreshToken: refreshJWTToken,
        },
      });

      return {
        message: "Access token generated successfully",
        data: {
          accessToken: accessJWTToken,
          refreshToken: refreshJWTToken,
        },
      };
    }
  )

// deconnexion
  .use(authPlugin)
  .post("/logout", async ({ cookie: { accessToken, refreshToken }, user }) => {
    // remove refresh token and access token from cookies
    accessToken.remove();
    refreshToken.remove();

    // remove refresh token from db & set user online status to offline
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        isOnline: false,
        refreshToken: null,
      },
    });
    return {
      message: "Logout successfully",
    };
  })

// update user information
  .use(authPlugin)
  .put(
    "/modify-profile",
    async ({ body, user, set }) => {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: body.name,
          email: body.email,
          location: body.location,
          isAdult: body.isAdult,
        },
      });

      return {
        message: "Profil mis à jour avec succès",
        data: {
          user: updatedUser,
        },
      };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ maxLength: 60, minLength: 1 })),
        email: t.Optional(t.String({ format: "email" })),
        location: t.Optional(t.Tuple([t.Number(), t.Number()])),
        isAdult: t.Optional(t.Boolean()),
      }),
    }
  );

// changer mot de passe
authRoutes.put(
  "/change-password",
  async ({ body, user, set }) => {
    // Vérifier l'ancien mot de passe
    const matchPassword = await Bun.password.verify(
      body.oldPassword,
      user.password,
      "bcrypt"
    );

    if (!matchPassword) {
      set.status = "Bad Request";
      throw new Error("Ancien mot de passe incorrect");
    }

    // Hacher le nouveau mot de passe
    const hashedPassword = await Bun.password.hash(body.newPassword, {
      algorithm: "bcrypt",
      cost: 10,
    });

    // Mettre à jour le mot de passe
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return {
      message: "Mot de passe mis à jour avec succès",
    };
  },
  {
    body: t.Object({
      oldPassword: t.String(),
      newPassword: t.String({ minLength: 8 }),
    }),
  }
);

// mise a jour du role (ADMIN)
authRoutes.put(
  "/users/:id/role",
  async ({ params, body, user, set }) => {
    // Vérifie que l'utilisateur connecté est un Admin
    if (user.role !== "Admin") {
      set.status = "Forbidden";
      throw new Error("Seul un administrateur peut modifier le rôle d'un utilisateur");
    }

    // Met à jour le rôle de l'utilisateur cible
    const updatedUser = await prisma.user.update({
      where: { id: params.id },
      data: { role: body.role },
    });

    return {
      message: "Rôle de l'utilisateur mis à jour avec succès",
      data: {
        user: updatedUser,
      },
    };
  },
  {
    body: t.Object({
      role: t.Enum(UserRole),
    }),
  }
);

// activation/desactivation user (ADMIN)
authRoutes
  .put(
    "/users/:id/status",
    async ({ params, body, user, set }) => {
      // Vérifie que l'utilisateur connecté est un Admin
      if (user.role !== "Admin") {
        set.status = "Forbidden"; // Statut HTTP 403
        throw new Error("Seul un administrateur peut modifier le statut d'un utilisateur");
      }
  
      // Met à jour le statut isActive de l'utilisateur cible
      const updatedUser = await prisma.user.update({
        where: { id: params.id },
        data: { isActive: body.isActive },
      });

      return {
        message: "Statut de l'utilisateur mis à jour avec succès",
        data: {
          user: updatedUser,
        },
      };
    },
    {
      body: t.Object({
        isActive: t.Boolean(),
      }),
    }
  )

// afficher info user
  .get("/me", ({ user }) => {
    return {
      message: "Fetch current user",
      data: {
        user,
      },
    };
  })

//Récupération de Tous les Utilisateurs (Admin)
authRoutes.get("/allusers", async ({ user, set }) => {

   // Vérifie que l'utilisateur connecté est un Admin
   if (user.role !== "Admin") {
    set.status = "Forbidden"; // Statut HTTP 403
    throw new Error("Seul un administrateur peut récupérer la liste des utilisateurs");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      isOnline: true,
      createdAt: true,
    },
  });

  return {
    message: "Liste des utilisateurs récupérée avec succès",
    data: {
      users,
    },
  };
})

// Récupération de l'utilisateur par ID (Admin)
authRoutes.get("/users/:id", async ({ params, user, set }) => {
    // Vérifie que l'utilisateur connecté est un Admin
    if (user.role !== "Admin") {
      set.status = "Forbidden"; // Statut HTTP 403
      throw new Error("Seul un administrateur peut récupérer les informations d'un utilisateur");
    }

  const userData = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      isOnline: true,
      createdAt: true,
    },
  });

  if (!userData) {
    throw new Error("Utilisateur non trouvé");
  }

  return {
    message: "Utilisateur récupéré avec succès",
    data: {
      user:userData,
    },
  };
})

// supprimer son compte
authRoutes.delete("/delete", async ({ user }) => {
  await prisma.user.delete({
    where: { id: user.id },
  });

  return {
    message: "Compte supprimé avec succès",
  };
});



