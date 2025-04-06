import { prisma } from "../lib/prisma";

export const checkPermission = (requiredPermission: string) => {
  return async ({ user, set }: { user: any; set: any }) => {
    if (!user) {
      set.status = "Unauthorized";
      throw new Error("Utilisateur non authentifié");
    }

    // Récupérer les permissions de l'utilisateur en fonction de son rôle
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        roleId: user.roleId,
        isActive: true,
      },
      include: {
        permission: true,
      },
    });

    const userPermissions = rolePermissions.map((rp) => rp.permission.name);

    // Vérifier si l'utilisateur a la permission requise
    if (!userPermissions.includes(requiredPermission)) {
      set.status = "Forbidden";
      throw new Error("Permission refusée");
    }
  };
};