import { Elysia, t } from "elysia";
import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";
import { differenceInDays } from "date-fns"; 

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
            observation: true,
            nombreJoursTraitement: true

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
          rejet: c.rejet ? 'Oui' : 'Non',
          // Formatage du nombre de jours de traitement (optionnel)
          nombreJoursTraitement: c.nombreJoursTraitement !== null ? c.nombreJoursTraitement : 'N/A'
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
      summary: 'list contribuable',
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
                    observation: "Aucune",
                    nombreJoursTraitement: 5  // Ajout dans l'exemple
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
  })
// Route de mise à jour améliorée
.put("/contribuables/:id", async ({ params, body, set }) => {
  try {
    const { id } = params;
    
    // Validation de l'ID
    if (!id) {
      set.status = 400;
      return {
        success: false,
        message: "ID invalide"
      };
    }
    
    // Reste du code...
    
  } catch (error) {
    console.error("Erreur lors de la mise à jour:", error);
    set.status = 500;
    return {
      success: false,
      message: "Erreur lors de la mise à jour du contribuable",
      error: error instanceof Error ? error.message : "Erreur inconnue"
    };
  }
}, {
  // Définition du schéma du corps pour la validation
  body: t.Object({
    nif: t.Optional(t.String()),
    raisonSociale: t.Optional(t.String()),
    centreGestionnaire: t.Optional(t.String()),
    documents: t.Optional(t.String()),
    aJour: t.Optional(t.Boolean()),
    rejet: t.Optional(t.Boolean()),
    quantite: t.Optional(t.Number()),
    dateDepot: t.Optional(t.String()),
    dateArriveeImmat: t.Optional(t.String()),
    dateLivraisonSG: t.Optional(t.String()),
    dateRejet: t.Optional(t.String()),
    motifRejet: t.Optional(t.String()),
  }),
  // Ajoutez cette propriété detail avec le tag Contribuables
  detail: {
    tags: ['Contribuables'],
    summary: 'Mettre à jour un contribuable',
    description: 'Permet de modifier les informations d\'un contribuable existant'
  }
})
.get("/contribuables/stats", async ({ set }) => {
  try {
    // Récupérer les statistiques générales
    const [
      totalContribuables,
      totalAJour,
      totalRejets,
      totalEnAttente,
      moyenneJoursTraitement,
      statsParCentre,
      statsParMois
    ] = await Promise.all([
      // Nombre total de contribuables
      prisma.contribuable.count(),
      
      // Nombre de contribuables à jour
      prisma.contribuable.count({
        where: { aJour: true }
      }),
      
      // Nombre de rejets
      prisma.contribuable.count({
        where: { rejet: true }
      }),
      
      // Nombre de dossiers en attente (ni à jour, ni rejetés)
      prisma.contribuable.count({
        where: { 
          aJour: false,
          rejet: false
        }
      }),
      
      // Moyenne des jours de traitement (pour les dossiers traités)
      prisma.contribuable.aggregate({
        _avg: {
          nombreJoursTraitement: true
        },
        where: {
          nombreJoursTraitement: { not: null }
        }
      }),
      
      // Statistiques par centre gestionnaire
      prisma.$queryRaw`
        SELECT 
          "centreGestionnaire", 
          COUNT(*) as "total",
          SUM(CASE WHEN "aJour" = true THEN 1 ELSE 0 END) as "aJour",
          SUM(CASE WHEN "rejet" = true THEN 1 ELSE 0 END) as "rejets",
          AVG("nombreJoursTraitement") as "moyenneTraitement"
        FROM "Contribuable"
        WHERE "centreGestionnaire" IS NOT NULL
        GROUP BY "centreGestionnaire"
        ORDER BY "total" DESC
      `,
      
      // Statistiques par mois (pour l'année en cours)
      prisma.$queryRaw`
        SELECT 
          EXTRACT(MONTH FROM "dateDepot") as "mois",
          COUNT(*) as "total",
          SUM(CASE WHEN "aJour" = true THEN 1 ELSE 0 END) as "aJour",
          SUM(CASE WHEN "rejet" = true THEN 1 ELSE 0 END) as "rejets",
          AVG("nombreJoursTraitement") as "moyenneTraitement"
        FROM "Contribuable"
        WHERE 
          "dateDepot" IS NOT NULL AND
          EXTRACT(YEAR FROM "dateDepot") = EXTRACT(YEAR FROM CURRENT_DATE)
        GROUP BY EXTRACT(MONTH FROM "dateDepot")
        ORDER BY "mois"
      `
    ]);
    
    // Calculer les pourcentages
    const pourcentageAJour = totalContribuables > 0 ? (totalAJour / totalContribuables) * 100 : 0;
    const pourcentageRejets = totalContribuables > 0 ? (totalRejets / totalContribuables) * 100 : 0;
    const pourcentageEnAttente = totalContribuables > 0 ? (totalEnAttente / totalContribuables) * 100 : 0;
    
    // Récupérer les statistiques de délai de traitement
    const statsDelais = await prisma.contribuable.groupBy({
      by: ['nombreJoursTraitement'],
      _count: {
        id: true
      },
      where: {
        nombreJoursTraitement: { not: null }
      },
      orderBy: {
        nombreJoursTraitement: 'asc'
      }
    });
    
    // Catégoriser les délais de traitement
    const delaisTraitement = {
      moins3Jours: 0,
      entre3Et7Jours: 0,
      entre7Et14Jours: 0,
      plus14Jours: 0
    };
    
    statsDelais.forEach(stat => {
      const jours = stat.nombreJoursTraitement as number;
      const count = stat._count.id;
      
      if (jours < 3) delaisTraitement.moins3Jours += count;
      else if (jours < 7) delaisTraitement.entre3Et7Jours += count;
      else if (jours < 14) delaisTraitement.entre7Et14Jours += count;
      else delaisTraitement.plus14Jours += count;
    });
    
    // Formater les noms des mois pour les statistiques mensuelles
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    
    // Helper function to convert BigInt to Number
    const sanitizeData = (data: any): any => {
      if (data === null || data === undefined) return data;
      
      if (typeof data === 'bigint') {
        return Number(data);
      }
      
      if (Array.isArray(data)) {
        return data.map(item => sanitizeData(item));
      }
      
      if (typeof data === 'object') {
        const result: any = {};
        for (const key in data) {
          result[key] = sanitizeData(data[key]);
        }
        return result;
      }
      
      return data;
    };
    
    // Sanitize the raw query results
    const sanitizedStatsParCentre = sanitizeData(statsParCentre);
    const sanitizedStatsParMois = sanitizeData(statsParMois);
    
    // Format the month stats after sanitizing
    const statsParMoisFormatted = Array.isArray(sanitizedStatsParMois) 
      ? sanitizedStatsParMois.map((stat: any) => ({
          ...stat,
          moisNom: moisNoms[Number(stat.mois) - 1],
          moyenneTraitement: stat.moyenneTraitement ? Number(stat.moyenneTraitement.toFixed(1)) : null
        }))
      : [];
    
    return {
      success: true,
      data: {
        general: {
          totalContribuables,
          totalAJour,
          totalRejets,
          totalEnAttente,
          pourcentageAJour: Number(pourcentageAJour.toFixed(1)),
          pourcentageRejets: Number(pourcentageRejets.toFixed(1)),
          pourcentageEnAttente: Number(pourcentageEnAttente.toFixed(1)),
          moyenneJoursTraitement: moyenneJoursTraitement._avg.nombreJoursTraitement 
            ? Number(moyenneJoursTraitement._avg.nombreJoursTraitement.toFixed(1)) 
            : null
        },
        delaisTraitement,
        parCentre: sanitizedStatsParCentre,
        parMois: statsParMoisFormatted
      }
    };
    
  } catch (error) {
    console.error("Erreur lors de la récupération des statistiques:", error);
    set.status = 500;
    return {
      success: false,
      message: "Erreur lors de la récupération des statistiques",
      error: error instanceof Error ? error.message : "Erreur inconnue"
    };
  }
}, {
  detail: {
    tags: ['Contribuables'],
    summary: 'stats contribuable',
    description: 'Fournit des statistiques détaillées sur les contribuables, incluant les totaux, pourcentages, délais de traitement, et répartition par centre et par mois',
    responses: {
      200: {
        description: 'Statistiques des contribuables',
        content: {
          'application/json': {
            example: {
              success: true,
              data: {
                general: {
                  totalContribuables: 1250,
                  totalAJour: 850,
                  totalRejets: 150,
                  totalEnAttente: 250,
                  pourcentageAJour: 68.0,
                  pourcentageRejets: 12.0,
                  pourcentageEnAttente: 20.0,
                  moyenneJoursTraitement: 5.3
                },
                delaisTraitement: {
                  moins3Jours: 320,
                  entre3Et7Jours: 430,
                  entre7Et14Jours: 180,
                  plus14Jours: 70
                },
                parCentre: [
                  {
                    centreGestionnaire: "CENTRE PRINCIPAL",
                    total: 450,
                    aJour: 300,
                    rejets: 50,
                    moyenneTraitement: 4.8
                  }
                ],
                parMois: [
                  {
                    mois: 1,
                    moisNom: "Janvier",
                    total: 120,
                    aJour: 80,
                    rejets: 15,
                    moyenneTraitement: 5.2
                  }
                ]
              }
            }
          }
        }
      },
      500: {
        description: 'Erreur serveur',
        content: {
          'application/json': {
            example: {
              success: false,
              message: "Erreur lors de la récupération des statistiques",
              error: "Détails de l'erreur"
            }
          }
        }
      }
    }
  }
})