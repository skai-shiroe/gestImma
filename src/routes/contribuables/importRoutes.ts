import { Elysia } from "elysia";
import { read, utils, type WorkBook, type WorkSheet } from "xlsx";
import { writeFile, unlink } from "fs/promises";
import { existsSync, mkdirSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { differenceInDays } from "date-fns"; // Ajout de l'import pour calculer la différence en jours

// Initialisation de Prisma
const prisma = new PrismaClient();

// Création de l'app Elysia
const app = new Elysia();

// Vérifier et créer le dossier uploads
if (!existsSync("./uploads")) {
  mkdirSync("./uploads");
}

// Fonction pour parser les dates Excel
function parseExcelDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  
  // Si c'est un nombre (format date Excel)
  if (typeof value === 'number') {
    return new Date((value - 25569) * 86400 * 1000);
  }
  
  // Si c'est une chaîne de caractères
  if (typeof value === 'string') {
    // Essayez différents formats de date
    const formats = [
      'yyyy-MM-dd', 
      'dd/MM/yyyy', 
      'MM/dd/yyyy',
      'yyyy/MM/dd'
    ];
    
    for (const format of formats) {
      const parsed = parseDateString(value, format);
      if (parsed) return parsed;
    }
    
    return null;
  }
  
  return null;
}

// Fonction helper pour parser les dates selon un format
function parseDateString(dateString: string, format: string): Date | null {
  try {
    const parts = dateString.split(/[\/-]/);
    const formatParts = format.split(/[\/-]/);
    
    let day, month, year;
    
    for (let i = 0; i < formatParts.length; i++) {
      if (formatParts[i] === 'dd') day = parseInt(parts[i], 10);
      else if (formatParts[i] === 'MM') month = parseInt(parts[i], 10) - 1;
      else if (formatParts[i] === 'yyyy') year = parseInt(parts[i], 10);
    }
    
    if (year && month !== undefined && day) {
      // Vérifier que les valeurs sont valides
      if (month < 0 || month > 11) return null;
      if (day < 1 || day > 31) return null;
      
      const date = new Date(year, month, day);
      
      // Vérifier que la date est valide (par exemple, pas le 31 février)
      if (
        date.getFullYear() === year &&
        date.getMonth() === month &&
        date.getDate() === day
      ) {
        return date;
      }
    }
  } catch (e) {
    return null;
  }
  
  return null;
}

// Fonction pour calculer le nombre de jours de traitement
function calculerNombreJoursTraitement(dateArrivee: Date | null, dateLivraison: Date | null): number | null {
  if (!dateArrivee || !dateLivraison) {
    return null;
  }
  
  // Utiliser date-fns pour calculer la différence en jours
  return differenceInDays(dateLivraison, dateArrivee);
}

// Route d'importation de fichier Excel
app.post("/import", async ({ body, set }) => {
  let tempPath = "";

  try {
    console.log("📂 Début de l'importation...");

    // Vérification du fichier
    const uploadFile = (body as { file?: { arrayBuffer: () => Promise<ArrayBuffer> } }).file;
    if (!uploadFile) {
      set.status = 400;
      return { error: "Aucun fichier n'a été envoyé." };
    }

    // Sauvegarde temporaire du fichier
    tempPath = `./uploads/temp-${Date.now()}.xlsx`;
    const fileBuffer = await uploadFile.arrayBuffer();
    await writeFile(tempPath, Buffer.from(fileBuffer));
    console.log(`✅ Fichier temporaire sauvegardé : ${tempPath}`);

    // Lecture du fichier Excel
    const workbook: WorkBook = read(new Uint8Array(fileBuffer), { type: 'array' });
    if (!workbook?.SheetNames?.length) {
      set.status = 400;
      return { error: "Le fichier Excel ne contient aucune feuille." };
    }

    // Vérifier et sélectionner la première feuille
    const firstSheetName = workbook.SheetNames[0];
    const worksheet: WorkSheet = workbook.Sheets[firstSheetName];
    
    if (!worksheet || !worksheet["!ref"]) {
      set.status = 400;
      return { error: "La feuille Excel est vide ou mal formatée." };
    }

    // Configuration des en-têtes attendus avec leurs variations possibles
    const expectedHeadersWithVariations: Record<string, string[]> = {
      "DATE DE DEPOT": ["DATE DE DEPOT"],
      "LE CONTRIBUABLE EST-IL A JOUR LORS DU DEPOT?": [
        "LE CONTRIBUABLE EST-IL A JOUR LORS DU DEPOT?",
        "LE CONTRIBUABLE EST-IL A JOUR  LORS DU DEPOT?"
      ],
      "NIF": ["NIF"],
      "RAISON SOCIALE": ["RAISON SOCIALE"],
      "Document demandé": [
        "Document  demandé",  // avec 2 espaces
        "Document demandé",   // avec 1 espace
        "Document demandé"    // autre variation
      ],
      "Quantité": ["Quantité"],
      "CENTRE GESTIONNAIRE": ["CENTRE GESTIONNAIRE"],
      "DATE D'ARRIVE A IMMAT": ["DATE D'ARRIVE A IMMAT"],
      "DATE DE LIVRAISON AU SERVI. GESTIONNAIRE": ["DATE DE LIVRAISON AU SERVI. GESTIONNAIRE"],
      "REJET": ["REJET"],
      "OBSERVATION": ["OBSERVATION"]
    };

    // Fonction pour normaliser les en-têtes
    const normalizeHeader = (header: string) => header.trim().replace(/\s+/g, ' ');

    // Vérification des en-têtes
    const firstRow = (utils.sheet_to_json<string[]>(worksheet, { header: 1 })[0] || []);
    const normalizedFoundHeaders = firstRow.map(normalizeHeader);

    const missingHeaders: string[] = [];
    const headerMappings: Record<string, string> = {};

    // Vérifier chaque en-tête attendu
    Object.entries(expectedHeadersWithVariations).forEach(([expectedHeader, variations]) => {
      const found = variations.some(variant => 
        normalizedFoundHeaders.includes(normalizeHeader(variant))
      );
      
      if (!found) {
        missingHeaders.push(expectedHeader);
      } else {
        // Trouver la correspondance exacte
        const matchedVariant = variations.find(variant => 
          normalizedFoundHeaders.includes(normalizeHeader(variant))
        );
        if (matchedVariant) {
          headerMappings[expectedHeader] = matchedVariant;
        }
      }
    });

    // Log du mapping des en-têtes pour debug
    console.log("🔤 Mapping des en-têtes:", headerMappings);

    if (missingHeaders.length > 0) {
      set.status = 400;
      return { 
        error: "En-têtes manquants dans le fichier Excel",
        missingHeaders,
        foundHeaders: firstRow,
        suggestion: "Vérifiez les espaces supplémentaires dans les en-têtes"
      };
    }

    // Conversion de la feuille en JSON
    const jsonData = utils.sheet_to_json<Record<string, any>>(worksheet);

    // Vérification de la structure des données
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      set.status = 400;
      return { error: "Aucune donnée valide dans le fichier Excel." };
    }

    // Transformation des données avec le mapping des en-têtes
    const transformedData = jsonData.map(row => {
      const nif = row[headerMappings["NIF"]] !== undefined ? String(row[headerMappings["NIF"]]).trim() : "";
      
      // Ignorer les lignes sans NIF
      if (!nif) {
        console.warn("Ligne ignorée - NIF manquant:", row);
        return null;
      }

      // Debug spécifique pour le document
      const docValue = row[headerMappings["Document demandé"]];
      console.log("📄 Valeur document brute:", docValue, "Type:", typeof docValue);

      // Récupérer les dates pour calculer le nombre de jours de traitement
      const dateArriveeImmat = parseExcelDate(row[headerMappings["DATE D'ARRIVE A IMMAT"]]);
      const dateLivraisonSG = parseExcelDate(row[headerMappings["DATE DE LIVRAISON AU SERVI. GESTIONNAIRE"]]);
      
      // Calculer le nombre de jours de traitement
      const nombreJoursTraitement = calculerNombreJoursTraitement(dateArriveeImmat, dateLivraisonSG);

      return {
        dateDepot: parseExcelDate(row[headerMappings["DATE DE DEPOT"]]) || new Date(),
        aJour: String(row[headerMappings["LE CONTRIBUABLE EST-IL A JOUR LORS DU DEPOT?"]]).toLowerCase() === "oui",
        nif,
        raisonSociale: String(row[headerMappings["RAISON SOCIALE"]] || "").trim(),
        documents: docValue !== undefined && docValue !== null ? String(docValue).trim() : "",
        quantite: isNaN(Number(row[headerMappings["Quantité"]])) ? 0 : Number(row[headerMappings["Quantité"]]),
        centreGestionnaire: String(row[headerMappings["CENTRE GESTIONNAIRE"]] || "").trim(),
        dateArriveeImmat,
        dateLivraisonSG,
        nombreJoursTraitement, // Ajout du nombre de jours de traitement
        rejet: String(row[headerMappings["REJET"]]).toLowerCase() === "oui",
        observation: row[headerMappings["OBSERVATION"]] ? String(row[headerMappings["OBSERVATION"]]).trim() : null
      };
    }).filter(item => item !== null);

    if (transformedData.length === 0) {
      set.status = 400;
      return { error: "Aucune donnée valide à importer (NIF manquant ou incorrect)." };
    }

    // Sauvegarde en base de données
    const result = await prisma.contribuable.createMany({
      data: transformedData,
      skipDuplicates: true
    });

    console.log(`✅ Import réussi : ${result.count}/${transformedData.length} enregistrements insérés.`);
    return {
      success: true,
      importedCount: result.count,
      totalCount: transformedData.length,
      message: `Import réussi : ${result.count}/${transformedData.length} enregistrements effectués.`
    };

  } catch (error) {
    console.error("❌ Erreur lors de l'import :", error);
    set.status = 500;
    return { 
      error: error instanceof Error ? error.message : "Erreur lors du traitement du fichier.",
      ...(process.env.NODE_ENV === "development" && { stack: error instanceof Error ? error.stack : undefined })
    };
  } finally {
    // Nettoyage du fichier temporaire
    if (tempPath && existsSync(tempPath)) {
      await unlink(tempPath).catch(e => console.error("❌ Erreur de suppression du fichier temporaire :", e));
    }
  }
}, {
  detail: {
    tags: ['Import'],
    summary: 'Importer des contribuables depuis un fichier Excel',
    description: 'Permet d\'importer des données de contribuables à partir d\'un fichier Excel'
  }
});

export const importRoute = app;
