import { User, UserRole } from '@prisma/client';
import { ROLE_PERMISSIONS } from '../lib/roles';

export const checkPermission = (requiredPermission: string) => {
  return async ({ user, set }: { user: User; set: any }) => {
    if (!user) {
      set.status = 'Unauthorized';
      throw new Error('Utilisateur non authentifié');
    }

    // Ici, on utilise user.role comme clé pour accéder à ROLE_PERMISSIONS
    const userPermissions = ROLE_PERMISSIONS[user.role as UserRole];

    if (!userPermissions || !userPermissions.includes(requiredPermission)) {
      set.status = 'Forbidden';
      throw new Error('Permission refusée');
    }
  };
};