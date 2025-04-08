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
    
    // Vérification si le contribuable existe
    const existingContribuable = await prisma.contribuable.findUnique({
      where: { id: id }
    });
    
    if (!existingContribuable) {
      set.status = 404;
      return {
        success: false,
        message: "Contribuable non trouvé"
      };
    }
    
    // Préparation de l'objet de données avec uniquement les champs fournis
    const updateData: any = {};
    
    // Ne mettre à jour que les champs qui sont explicitement fournis dans le corps de la requête
    if ('nif' in body && body.nif !== undefined) updateData.nif = body.nif;
    if ('raisonSociale' in body && body.raisonSociale !== undefined) updateData.raisonSociale = body.raisonSociale;
    if ('centreGestionnaire' in body && body.centreGestionnaire !== undefined) updateData.centreGestionnaire = body.centreGestionnaire;
    if ('documents' in body && body.documents !== undefined) updateData.documents = body.documents;
    if ('motifRejet' in body && body.motifRejet !== undefined) updateData.motifRejet = body.motifRejet;
    
    // Gestion des champs booléens
    if ('aJour' in body && body.aJour !== undefined) updateData.aJour = body.aJour;
    if ('rejet' in body && body.rejet !== undefined) updateData.rejet = body.rejet;
    
    // Gestion des champs numériques
    if ('quantite' in body && body.quantite !== undefined) updateData.quantite = body.quantite;
    
    // Variables pour stocker les dates pour le calcul ultérieur
    let dateArriveeImmat = existingContribuable.dateArriveeImmat;
    let dateLivraisonSG = existingContribuable.dateLivraisonSG;
    
    // Gestion des champs de date - ajouter seulement si ce sont des dates valides
    if ('dateDepot' in body && body.dateDepot) {
      const newDateDepot = new Date(body.dateDepot);
      if (!isNaN(newDateDepot.getTime())) {
        updateData.dateDepot = newDateDepot;
      }
    }
    
    if ('dateArriveeImmat' in body && body.dateArriveeImmat) {
      const newDateArriveeImmat = new Date(body.dateArriveeImmat);
      if (!isNaN(newDateArriveeImmat.getTime())) {
        updateData.dateArriveeImmat = newDateArriveeImmat;
        dateArriveeImmat = newDateArriveeImmat;
      }
    }
    
    if ('dateLivraisonSG' in body && body.dateLivraisonSG) {
      const newDateLivraisonSG = new Date(body.dateLivraisonSG);
      if (!isNaN(newDateLivraisonSG.getTime())) {
        updateData.dateLivraisonSG = newDateLivraisonSG;
        dateLivraisonSG = newDateLivraisonSG;
      }
    }
    
    if ('dateRejet' in body && body.dateRejet) {
      const dateRejet = new Date(body.dateRejet);
      if (!isNaN(dateRejet.getTime())) {
        updateData.dateRejet = dateRejet;
      }
    }
    
    // Calcul automatique du nombre de jours de traitement entre l'arrivée à l'immatriculation et la livraison
    if (dateArriveeImmat && dateLivraisonSG) {
      // Calcul du nombre de jours entre l'arrivée à l'immatriculation et la livraison
      const nombreJoursTraitement = differenceInDays(dateLivraisonSG, dateArriveeImmat);
      updateData.nombreJoursTraitement = nombreJoursTraitement;
    }
    
    // Si aucun champ à mettre à jour n'est fourni
    if (Object.keys(updateData).length === 0) {
      set.status = 400;
      return {
        success: false,
        message: "Aucune donnée valide fournie pour la mise à jour"
      };
    }
    
    // Mise à jour du contribuable avec les données validées
    const updatedContribuable = await prisma.contribuable.update({
      where: { id: id },
      data: updateData
    });
    
    return {
      success: true,
      message: "Contribuable mis à jour avec succès",
      data: updatedContribuable
    };
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
    // Ajoutez d'autres champs que vous souhaitez autoriser à mettre à jour
  })
});