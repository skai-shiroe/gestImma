import { Elysia, t } from "elysia";
import { loginBodySchema, signupBodySchema } from "../../schema";
import { prisma } from "../../lib/prisma";
//import { reverseGeocodingAPI } from "../lib/geoapify";
import { jwt } from "@elysiajs/jwt";
import {
  ACCESS_TOKEN_EXP,
  JWT_NAME,
  REFRESH_TOKEN_EXP,
} from "../../config/constant";
import { getExpTimestamp } from "../../lib/util";
import { authPlugin } from "../../plugin";
import { sendResetPasswordEmail } from "../../lib/email";
import { v4 as uuidv4 } from "uuid";
import { addHours } from "date-fns";
import { checkPermission } from "../../middleware/permissionMiddleware";
import { PERMISSIONS } from "../../lib/permissions";


export const authRoutes = new Elysia({ prefix: "api/auth" })
  .use(
    jwt({
      name: JWT_NAME,
      secret: Bun.env.JWT_SECRET!,
    })
  )



      // // inscription
      // .post(
      //   "/sign-up",
      //   async ({ body }) => {
      //     // Trouver l'ID du rôle "User"
      //     const userRole = await prisma.role.findUnique({
      //       where: { name: "User" },
      //     });

      //     if (!userRole) {
      //       throw new Error("Rôle User non trouvé");
      //     }

      //     // Hash du mot de passe
      //     const password = await Bun.password.hash(body.password, {
      //       algorithm: "bcrypt",
      //       cost: 10,
      //     });

      //     // Création de l'utilisateur avec un rôle par défaut
      //     const user = await prisma.user.create({
      //       data: {
      //         ...body,
      //         password,
      //         roleId: userRole.id, // Utilisation de roleId
      //       },
      //     });

      //     return {
      //       message: "Account created successfully",
      //       data: {
      //         user,
      //       },
      //     };
      //   },
      //   {
      //     body: signupBodySchema,
      //     error({ code, set, body }) {
      //       if ((code as unknown) === "P2002") {
      //         set.status = "Conflict";
      //         return {
      //           name: "Error",
      //           message: `The email address provided ${body.email} already exists`,
      //         };
      //       }
      //     },
      //   }
      // )

      // // connexion
      //   .post(
      //     "/sign-in",
      //     async ({ body, jwt, cookie: { accessToken, refreshToken }, set }) => {
      //       // match user email
      //       const user = await prisma.user.findUnique({
      //         where: { email: body.email },
      //         select: {
      //           id: true,
      //           email: true,
      //           password: true,
      //         },
      //       });

      //       if (!user) {
      //         set.status = "Bad Request";
      //         throw new Error(
      //           "The email address or password you entered is incorrect"
      //         );
      //       }

      //       // match password
      //       const matchPassword = await Bun.password.verify(
      //         body.password,
      //         user.password,
      //         "bcrypt"
      //       );
      //       if (!matchPassword) {
      //         set.status = "Bad Request";
      //         throw new Error(
      //           "The email address or password you entered is incorrect"
      //         );
      //       }

      //       // create access token
      //       const accessJWTToken = await jwt.sign({
      //         sub: user.id,
      //         exp: getExpTimestamp(ACCESS_TOKEN_EXP),
      //       });
      //       accessToken.set({
      //         value: accessJWTToken,
      //         httpOnly: true,
      //         maxAge: ACCESS_TOKEN_EXP,
      //         path: "/",
      //       });

      //       // create refresh token
      //       const refreshJWTToken = await jwt.sign({
      //         sub: user.id,
      //         exp: getExpTimestamp(REFRESH_TOKEN_EXP),
      //       });
      //       refreshToken.set({
      //         value: refreshJWTToken,
      //         httpOnly: true,
      //         maxAge: REFRESH_TOKEN_EXP,
      //         path: "/",
      //       });

      //       // set user profile as online
      //       const updatedUser = await prisma.user.update({
      //         where: {
      //           id: user.id,
      //         },
      //         data: {
      //           isOnline: true,
      //           refreshToken: refreshJWTToken,
      //         },
      //       });

      //       return {
      //         message: "Sig-in successfully",
      //         data: {
      //           user: updatedUser,
      //           accessToekn: accessJWTToken,
      //           refreshToken: refreshJWTToken,
      //         },
      //       };
      //     },
      //     {
      //       body: loginBodySchema,
      //     }
      //   )

      // // refresh token
      //   .post(
      //     "/refresh",
      //     async ({ cookie: { accessToken, refreshToken }, jwt, set }) => {
      //       if (!refreshToken.value) {
      //         // handle error for refresh token is not available
      //         set.status = "Unauthorized";
      //         throw new Error("Refresh token is missing");
      //       }
      //       // get refresh token from cookie
      //       const jwtPayload = await jwt.verify(refreshToken.value);
      //       if (!jwtPayload) {
      //         // handle error for refresh token is tempted or incorrect
      //         set.status = "Forbidden";
      //         throw new Error("Refresh token is invalid");
      //       }

      //       // get user from refresh token
      //       const userId = jwtPayload.sub;

      //       // verify user exists or not
      //       const user = await prisma.user.findUnique({
      //         where: {
      //           id: userId,
      //         },
      //       });

      //       if (!user) {
      //         // handle error for user not found from the provided refresh token
      //         set.status = "Forbidden";
      //         throw new Error("Refresh token is invalid");
      //       }
      //       // create new access token
      //       const accessJWTToken = await jwt.sign({
      //         sub: user.id,
      //         exp: getExpTimestamp(ACCESS_TOKEN_EXP),
      //       });
      //       accessToken.set({
      //         value: accessJWTToken,
      //         httpOnly: true,
      //         maxAge: ACCESS_TOKEN_EXP,
      //         path: "/",
      //       });

      //       // create new refresh token
      //       const refreshJWTToken = await jwt.sign({
      //         sub: user.id,
      //         exp: getExpTimestamp(REFRESH_TOKEN_EXP),
      //       });
      //       refreshToken.set({
      //         value: refreshJWTToken,
      //         httpOnly: true,
      //         maxAge: REFRESH_TOKEN_EXP,
      //         path: "/",
      //       });

      //       // set refresh token in db
      //       await prisma.user.update({
      //         where: {
      //           id: user.id,
      //         },
      //         data: {
      //           refreshToken: refreshJWTToken,
      //         },
      //       });

      //       return {
      //         message: "Access token generated successfully",
      //         data: {
      //           accessToken: accessJWTToken,
      //           refreshToken: refreshJWTToken,
      //         },
      //       };
      //     }
      //   )

      // // deconnexion
      //   .use(authPlugin)
      //   .post("/logout", async ({ cookie: { accessToken, refreshToken }, user }) => {
      //     // remove refresh token and access token from cookies
      //     accessToken.remove();
      //     refreshToken.remove();

      //     // remove refresh token from db & set user online status to offline
      //     await prisma.user.update({
      //       where: {
      //         id: user.id,
      //       },
      //       data: {
      //         isOnline: false,
      //         refreshToken: null,
      //       },
      //     });
      //     return {
      //       message: "Logout successfully",
      //     };
      //   })

      // // update user information
      //   .use(authPlugin)
      //   .put(
      //     "/modify-profile",
      //     async ({ body, user, set }) => {
      //       const updatedUser = await prisma.user.update({
      //         where: { id: user.id },
      //         data: {
      //           name: body.name,
      //           email: body.email,
      //           isAdult: body.isAdult,
      //         },
      //       });

      //       return {
      //         message: "Profil mis à jour avec succès",
      //         data: {
      //           user: updatedUser,
      //         },
      //       };
      //     },
      //     {
      //       body: t.Object({
      //         name: t.Optional(t.String({ maxLength: 60, minLength: 1 })),
      //         email: t.Optional(t.String({ format: "email" })),
      //         isAdult: t.Optional(t.Boolean()),
      //       }),
      //       beforeHandle: checkPermission(PERMISSIONS.UPDATE_OWN_PROFILE),
      //     }
      //   );

      // // changer mot de passe
      // authRoutes.put(
      //   "/change-password",
      //   async ({ body, user, set }) => {
      //     // Vérifier l'ancien mot de passe
      //     const matchPassword = await Bun.password.verify(
      //       body.oldPassword,
      //       user.password,
      //       "bcrypt"
      //     );

      //     if (!matchPassword) {
      //       set.status = "Bad Request";
      //       throw new Error("Ancien mot de passe incorrect");
      //     }

      //     // Hacher le nouveau mot de passe
      //     const hashedPassword = await Bun.password.hash(body.newPassword, {
      //       algorithm: "bcrypt",
      //       cost: 10,
      //     });

      //     // Mettre à jour le mot de passe
      //     await prisma.user.update({
      //       where: { id: user.id },
      //       data: { password: hashedPassword },
      //     });

      //     return {
      //       message: "Mot de passe mis à jour avec succès",
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       oldPassword: t.String(),
      //       newPassword: t.String({ minLength: 8 }),
      //     }),
      //     beforeHandle: checkPermission(PERMISSIONS.UPDATE_OWN_PASSWORD),
      //   }
      // )

      // // afficher info user
      // .get(
      //   "/me",
      //   ({ user }) => {
      //     return {
      //       message: "Informations de l'utilisateur récupérées avec succès",
      //       data: {
      //         user,
      //       },
      //     };
      //   },
      //   {
      //     beforeHandle: checkPermission(PERMISSIONS.READ_OWN_PROFILE),
      //   }
      // )

      // //Récupération de Tous les Utilisateurs (Admin)
      // .get(
      //   "/allusers",
      //   async ({ user, set }) => {
      //     // Récupérer l'utilisateur avec son rôle (vérification si le rôle existe)
      //     const currentUser = await prisma.user.findUnique({
      //       where: { id: user.id },
      //       include: { Role: true },  // Inclut le rôle dans la réponse
      //     });

      //     // Vérification du rôle de l'utilisateur (Admin ou SuperAdmin uniquement)
      //     if (currentUser?.Role?.name !== "Admin" && currentUser?.Role?.name !== "SuperAdmin") {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un administrateur peut récupérer la liste des utilisateurs");
      //     }

      //     // Récupérer la liste des utilisateurs
      //     const users = await prisma.user.findMany({
      //       select: {
      //         id: true,
      //         name: true,
      //         email: true,
      //         isOnline: true,
      //         createdAt: true,
      //       },
      //     });

      //     // Retourner la réponse avec la liste des utilisateurs
      //     return {
      //       message: "Liste des utilisateurs récupérée avec succès",
      //       data: {
      //         users,
      //       },
      //     };
      //   },
      //   {
      //     // Avant le traitement de la requête, vérifier la permission d'accès
      //     beforeHandle: checkPermission(PERMISSIONS.READ_ALL_USERS),
      //   }
      // );


      // // Récupération de l'utilisateur par ID (Admin)
      // authRoutes.get("/users/:id", async ({ params, user, set }) => {
      //   // Vérifie que l'utilisateur connecté a un rôle Admin ou SuperAdmin
      //   const currentUser = await prisma.user.findUnique({
      //     where: { id: user.id },
      //     include: { Role: true },  // Inclut le rôle de l'utilisateur
      //   });

      //   // Vérification des rôles Admin ou SuperAdmin
      //   if (currentUser?.Role?.name !== "Admin" && currentUser?.Role?.name !== "SuperAdmin") {
      //     set.status = "Forbidden"; // Statut HTTP 403
      //     throw new Error("Seul un administrateur peut récupérer les informations d'un utilisateur");
      //   }

      //   // Récupération des données de l'utilisateur par son ID
      //   const userData = await prisma.user.findUnique({
      //     where: { id: params.id },
      //     select: {
      //       id: true,
      //       name: true,
      //       email: true,
      //       isOnline: true,
      //       createdAt: true,
      //     },
      //   });

      //   // Vérification si l'utilisateur existe
      //   if (!userData) {
      //     throw new Error("Utilisateur non trouvé");
      //   }

      //   return {
      //     message: "Utilisateur récupéré avec succès",
      //     data: {
      //       user: userData,
      //     },
      //   };
      // },
      // {
      //   // Vérification des permissions avant de traiter la requête
      //   beforeHandle: checkPermission(PERMISSIONS.READ_USER),
      // }
      // );


      // // supprimer son compte
      // authRoutes.delete("/delete", async ({ user }) => {
      //   await prisma.user.delete({
      //     where: { id: user.id },
      //   });

      //   return {
      //     message: "Compte supprimé avec succès",
      //   };
      // },

      // );

      // // mot de passe oublie | Envoie un email.
      // authRoutes.post(
      //   "/forgot-password",
      //   async ({ body, set }) => {
      //     const { email } = body;

      //     // Vérifie si l'utilisateur existe
      //     const user = await prisma.user.findUnique({
      //       where: { email },
      //     });

      //     if (!user) {
      //       set.status = "Not Found";
      //       throw new Error("Aucun utilisateur trouvé avec cet e-mail.");
      //     }

      //     // Génère un token de réinitialisation
      //     const resetToken = uuidv4();
      //     const resetTokenExpires = addHours(new Date(), 1); // Token valide pendant 1 heure

      //     // Enregistre le token dans la base de données
      //     await prisma.user.update({
      //       where: { id: user.id },
      //       data: {
      //         resetPasswordToken: resetToken,
      //         resetPasswordExpires: resetTokenExpires,
      //       },
      //     });

      //     // Envoie un e-mail avec le lien de réinitialisation
      //     await sendResetPasswordEmail(user.email, resetToken);

      //     return {
      //       message: "Un e-mail de réinitialisation a été envoyé.",
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       email: t.String({ format: "email" }),
      //     }),
      //   }
      // )

      // // reinitialiser mot de passe
      // authRoutes.post(
      //   "/reset-password",
      //   async ({ body, set }) => {
      //     const { token, newPassword } = body;

      //     // Trouve l'utilisateur avec le token valide
      //     const user = await prisma.user.findFirst({
      //       where: {
      //         resetPasswordToken: token,
      //         resetPasswordExpires: { gt: new Date() }, // Vérifie que le token n'a pas expiré
      //       },
      //     });

      //     if (!user) {
      //       set.status = "Bad Request";
      //       throw new Error("Token invalide ou expiré.");
      //     }

      //     // Hache le nouveau mot de passe
      //     const hashedPassword = await Bun.password.hash(newPassword, {
      //       algorithm: "bcrypt",
      //       cost: 10,
      //     });

      //     // Met à jour le mot de passe et efface le token
      //     await prisma.user.update({
      //       where: { id: user.id },
      //       data: {
      //         password: hashedPassword,
      //         resetPasswordToken: null,
      //         resetPasswordExpires: null,
      //       },
      //     });

      //     return {
      //       message: "Mot de passe réinitialisé avec succès.",
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       token: t.String(), // Token de réinitialisation
      //       newPassword: t.String({ minLength: 8 }), // Nouveau mot de passe
      //     }),
      //   }
      // )
      // // ---------------------------------------------------------------------------------------------------------------------------------------
      // // creation de role
      // .post(
      //   "/roles",
      //   async ({ body, user, set }) => {
      //     // Récupère l'utilisateur connecté et son rôle
      //     const currentUser = await prisma.user.findUnique({
      //       where: { id: user.id },
      //       include: { Role: true },  // Inclut le rôle de l'utilisateur
      //     });

      //     // Vérifie que l'utilisateur est un SuperAdmin
      //     if (currentUser?.Role?.name !== "SuperAdmin") {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un SuperAdmin peut créer un rôle");
      //     }

      //     // Crée un nouveau rôle
      //     const role = await prisma.role.create({
      //       data: {
      //         name: body.name,
      //         description: body.description,
      //       },
      //     });

      //     return {
      //       message: "Rôle créé avec succès",
      //       data: {
      //         role,
      //       },
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       name: t.String(),
      //       description: t.Optional(t.String()),
      //     }),
      //     beforeHandle: checkPermission(PERMISSIONS.CREATE_ROLE),
      //   }
      // )


      // // ATTRIBUER PERMISSION
      // .post(
      //   "/roles/:roleId/permissions",
      //   async ({ params, body, user, set }) => {
      //     // Récupère l'utilisateur connecté et son rôle
      //     const currentUser = await prisma.user.findUnique({
      //       where: { id: user.id },
      //       include: { Role: true },  // Inclut le rôle de l'utilisateur
      //     });

      //     // Vérifie que l'utilisateur est un SuperAdmin
      //     if (currentUser?.Role?.name !== "SuperAdmin") {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un SuperAdmin peut attribuer une permission à un rôle");
      //     }

      //     // Attribue la permission au rôle
      //     const rolePermission = await prisma.rolePermission.create({
      //       data: {
      //         roleId: params.roleId,
      //         permissionId: body.permissionId,
      //         isActive: body.isActive,
      //       },
      //     });

      //     return {
      //       message: "Permission attribuée avec succès",
      //       data: {
      //         rolePermission,
      //       },
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       permissionId: t.String(),
      //       isActive: t.Boolean(),
      //     }),
      //     beforeHandle: checkPermission(PERMISSIONS.ASSIGN_PERMISSION),
      //   }
      // )


      // // RECUPERER TOUS LES ROLES
      // .get(
      //   "/roles",
      //   async ({ user, set }) => {
      //     // Récupère l'utilisateur connecté et son rôle
      //     const currentUser = await prisma.user.findUnique({
      //       where: { id: user.id },
      //       include: { Role: true }, // Inclut la relation avec le rôle de l'utilisateur
      //     });

      //     // Vérifie que l'utilisateur connecté est un SuperAdmin
      //     if (currentUser?.Role?.name !== "SuperAdmin") {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un SuperAdmin peut récupérer la liste des rôles");
      //     }

      //     // Récupère la liste des rôles
      //     const roles = await prisma.role.findMany();

      //     return {
      //       message: "Liste des rôles récupérée avec succès",
      //       data: {
      //         roles,
      //       },
      //     };
      //   },
      //   {
      //     beforeHandle: checkPermission(PERMISSIONS.READ_ALL_ROLES),
      //   }
      // )


      // // RECUPERER TOUS LES PERMISSIONS D UN ROLE SPECIFIQUE
      // .get(
      //   "/roles/:roleId/permissions",
      //   async ({ params, user, set }) => {
      //     // Récupère l'utilisateur connecté et son rôle
      //     const currentUser = await prisma.user.findUnique({
      //       where: { id: user.id },
      //       include: { Role: true }, // Inclut la relation avec le rôle de l'utilisateur
      //     });

      //     // Vérifie que l'utilisateur connecté est un SuperAdmin
      //     if (currentUser?.Role?.name !== "SuperAdmin") {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un SuperAdmin peut récupérer les permissions d'un rôle");
      //     }

      //     // Récupère les permissions du rôle spécifié
      //     const permissions = await prisma.rolePermission.findMany({
      //       where: {
      //         roleId: params.roleId,
      //       },
      //       include: {
      //         permission: true, // Inclut les détails de la permission associée
      //       },
      //     });

      //     return {
      //       message: "Permissions du rôle récupérées avec succès",
      //       data: {
      //         permissions,
      //       },
      //     };
      //   },
      //   {
      //     beforeHandle: checkPermission(PERMISSIONS.READ_ROLE_PERMISSIONS),
      //   }
      // )


      // // mise a jour du role (ADMIN)
      // authRoutes.put(
      //   "/users/:id/role",
      //   async ({ params, body, user, set }) => {
      //     // Vérifie que l'utilisateur connecté est un Admin ou SuperAdmin
      //     const adminRole = await prisma.role.findUnique({
      //       where: { name: "Admin" },
      //     });
      //     const superAdminRole = await prisma.role.findUnique({
      //       where: { name: "SuperAdmin" },
      //     });

      //     if (user.roleId !== adminRole?.id && user.roleId !== superAdminRole?.id) {
      //       set.status = "Forbidden";
      //       throw new Error("Seul un administrateur peut modifier le rôle d'un utilisateur");
      //     }

      //     // Vérifie que le rôle fourni existe dans la base de données
      //     const targetRole = await prisma.role.findUnique({
      //       where: { name: body.role },
      //     });

      //     if (!targetRole) {
      //       set.status = "Bad Request";
      //       throw new Error("Rôle invalide");
      //     }

      //     // Met à jour le rôle de l'utilisateur cible
      //     const updatedUser = await prisma.user.update({
      //       where: { id: params.id },
      //       data: { roleId: targetRole.id },
      //     });

      //     return {
      //       message: "Rôle de l'utilisateur mis à jour avec succès",
      //       data: {
      //         user: updatedUser,
      //       },
      //     };
      //   },
      //   {
      //     body: t.Object({
      //       role: t.String(), // Validation basée sur une chaîne de caractères
      //     }),
      //   }
      // )

      // // activation/desactivation user (ADMIN)
      // authRoutes
      //   .put(
      //     "/users/:id/status",
      //     async ({ params, body, user, set }) => {
      //       // Récupère l'utilisateur connecté et son rôle
      //       const currentUser = await prisma.user.findUnique({
      //         where: { id: user.id },
      //         include: { Role: true }, // Inclut la relation avec le rôle de l'utilisateur
      //       });

      //       // Vérifie que l'utilisateur connecté est un Admin ou SuperAdmin
      //       if (currentUser?.Role?.name !== "Admin" && currentUser?.Role?.name !== "SuperAdmin") {
      //         set.status = "Forbidden"; // Statut HTTP 403
      //         throw new Error("Seul un administrateur peut modifier le statut d'un utilisateur");
      //       }

      //       // Met à jour le statut isActive de l'utilisateur cible
      //       const updatedUser = await prisma.user.update({
      //         where: { id: params.id },
      //         data: { isActive: body.isActive },
      //       });

      //       return {
      //         message: "Statut de l'utilisateur mis à jour avec succès",
      //         data: {
      //           user: updatedUser,
      //         },
      //       };
      //     },
      //     {
      //       body: t.Object({
      //         isActive: t.Boolean(),
      //       }),
      //       beforeHandle: checkPermission(PERMISSIONS.UPDATE_USER_STATUS),
      //     }
      //   )
