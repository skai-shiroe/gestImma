import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Ajouter les rôles initiaux
  await prisma.role.createMany({
    data: [
      { id: '1', name: 'User', description: 'Utilisateur standard' },
      { id: '2', name: 'User2', description: 'Utilisateur avec des permissions supplémentaires' },
      { id: '3', name: 'User3', description: 'Utilisateur avec des permissions premium' },
      { id: '4', name: 'User4', description: 'Utilisateur avec des permissions avancées' },
      { id: '5', name: 'Admin', description: 'Administrateur avec des permissions étendues' },
      { id: '6', name: 'SuperAdmin', description: 'Super administrateur avec un accès total' },
    ],
  });

  console.log('Rôles initiaux ajoutés avec succès');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });