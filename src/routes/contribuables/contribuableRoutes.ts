import { Elysia } from "elysia";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

type DateField = 'dateDepot' | 'dateArriveeImmat' | 'dateLivraisonSG' | 'dateRejet';

export const contribuableRoutes = new Elysia({ prefix: "/api" })
  .get("/contribuables", async ({ query, set }) => {
    try {
      // 1. Validation des paramètres
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
      const skip = (page - 1) * limit;

      // 2. Gestion du type de date
      const dateField = (query.dateType as DateField) || 'dateDepot';
      const validDateFields: DateField[] = [
        'dateDepot', 'dateArriveeImmat', 'dateLivraisonSG', 'dateRejet'
      ];

      if (!validDateFields.includes(dateField)) {
        set.status = 400;
        return {
          error: "Type de date invalide",
          validTypes: validDateFields
        };
      }

      // 3. Construction des filtres complets
      const filters: Prisma.ContribuableWhereInput = {
        // Filtres texte (insensibles à la casse)
        ...(query.nif && {
          nif: { contains: String(query.nif), mode: 'insensitive' }
        }),
        ...(query.raisonSociale && {
          raisonSociale: { contains: String(query.raisonSociale), mode: 'insensitive' }
        }),
        ...(query.centre && {
          centreGestionnaire: { contains: String(query.centre), mode: 'insensitive' }
        }),
        ...(query.documents && {
          documents: { contains: String(query.documents), mode: 'insensitive' }
        }),

        // Filtres booléens/numériques
        ...(query.aJour && { aJour: query.aJour === 'true' }),
        ...(query.rejet && { rejet: query.rejet === 'true' }),
        ...(query.quantiteMin && { quantite: { gte: Number(query.quantiteMin) } }),
        ...(query.quantiteMax && { quantite: { lte: Number(query.quantiteMax) } }),

        // Filtres de date dynamiques
        ...(query.dateDebut || query.dateFin ? {
          [dateField]: {
            ...(query.dateDebut && { gte: new Date(String(query.dateDebut)) }),
            ...(query.dateFin && { lte: new Date(String(query.dateFin)) })
          }
        } : {})
      };

      // 4. Requête optimisée
      const [contribuables, total] = await Promise.all([
        prisma.contribuable.findMany({
          where: filters,
          skip,
          take: limit,
          orderBy: { [dateField]: 'desc' },
          select: {
            id: true,
            nif: true,
            raisonSociale: true,
            aJour: true,
            dateDepot: true,
            dateArriveeImmat: true,
            dateLivraisonSG: true,
            dateRejet: true,
            centreGestionnaire: true,
            documents: true,
            quantite: true,
            rejet: true,
            observation: true
          }
        }),
        prisma.contribuable.count({ where: filters })
      ]);

      // 5. Formatage de la réponse
      return {
        success: true,
        filters: {
          dateField,
          ...query
        },
        data: contribuables.map(c => ({
          ...c,
          // Formatage des dates
          dateDepot: c.dateDepot?.toISOString().split('T')[0],
          dateArriveeImmat: c.dateArriveeImmat?.toISOString().split('T')[0],
          dateLivraisonSG: c.dateLivraisonSG?.toISOString().split('T')[0],
          dateRejet: c.dateRejet?.toISOString().split('T')[0],
          // Formatage des booléens
          aJour: c.aJour ? 'Oui' : 'Non',
          rejet: c.rejet ? 'Oui' : 'Non'
        })),
        pagination: {
          total,
          page,
          pageSize: limit,
          totalPages: Math.ceil(total / limit)
        }
      };

    } catch (error) {
      set.status = 500;
      return {
        success: false,
        message: "Erreur serveur",
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : String(error)
        })
      };
    }
  }, {
    detail: {
      tags: ['Contribuables'],
      summary: 'Lister les contribuables avec tous les filtres',
      description: 'Endpoint complet avec filtres sur texte, dates, booléens et numériques',
      parameters: [
        // Paramètres de pagination
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 }
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
        },

        // Filtres texte
        {
          name: 'nif',
          in: 'query',
          schema: { type: 'string' }
        },
        {
          name: 'raisonSociale',
          in: 'query',
          schema: { type: 'string' }
        },
        {
          name: 'centre',
          in: 'query',
          schema: { type: 'string' }
        },
        {
          name: 'documents',
          in: 'query',
          schema: { type: 'string' }
        },

        // Filtres booléens
        {
          name: 'aJour',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] }
        },
        {
          name: 'rejet',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] }
        },

        // Filtres numériques
        {
          name: 'quantiteMin',
          in: 'query',
          schema: { type: 'integer', minimum: 0 }
        },
        {
          name: 'quantiteMax',
          in: 'query',
          schema: { type: 'integer', minimum: 0 }
        },

        // Filtres dates
        {
          name: 'dateType',
          in: 'query',
          schema: { 
            type: 'string',
            enum: ['dateDepot', 'dateArriveeImmat', 'dateLivraisonSG', 'dateRejet'],
            default: 'dateDepot'
          }
        },
        {
          name: 'dateDebut',
          in: 'query',
          schema: { type: 'string', format: 'date' }
        },
        {
          name: 'dateFin',
          in: 'query',
          schema: { type: 'string', format: 'date' }
        }
      ],
      responses: {
        200: {
          description: 'Liste filtrée des contribuables',
          content: {
            'application/json': {
              example: {
                success: true,
                filters: {
                  dateField: 'dateDepot',
                  nif: '123',
                  aJour: 'true',
                  quantiteMin: 5
                },
                data: [
                  {
                    id: 1,
                    nif: "123456789",
                    raisonSociale: "ENTREPRISE TEST",
                    aJour: "Oui",
                    dateDepot: "2023-01-01",
                    dateArriveeImmat: "2023-01-05",
                    dateLivraisonSG: "2023-01-10",
                    dateRejet: null,
                    centreGestionnaire: "CENTRE PRINCIPAL",
                    documents: "DOC1,DOC2",
                    quantite: 10,
                    rejet: "Non",
                    observation: "Aucune"
                  }
                ],
                pagination: {
                  total: 1,
                  page: 1,
                  pageSize: 10,
                  totalPages: 1
                }
              }
            }
          }
        }
      }
    }
  });