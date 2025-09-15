import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const airtableData = req.body;

    // Extraire les données du webhook Airtable
    const record = airtableData.record || airtableData;
    const fields = record.fields;

    // Connexion à Google Sheets
    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SHEET_ID,
      serviceAccountAuth
    );
    await doc.loadInfo();

    // Déterminer la sheet cible (filloutBase par défaut)
    const targetSheet = fields.source === "draft" ? "draftBase" : "filloutBase";
    const sheet = doc.sheetsByTitle[targetSheet];

    if (!sheet) {
      throw new Error(`Sheet ${targetSheet} introuvable`);
    }

    // Vérifier si le record existe déjà (basé sur un ID unique)
    const rows = await sheet.getRows();
    const existingRowIndex = rows.findIndex(
      (row) => row.get("airtable_id") === record.id
    );

    if (existingRowIndex !== -1) {
      // Mettre à jour le record existant
      const existingRow = rows[existingRowIndex];
      Object.keys(fields).forEach((key) => {
        existingRow.set(key, fields[key]);
      });
      existingRow.set("last_updated", new Date().toISOString());
      await existingRow.save();

      console.log(`Record mis à jour : ${record.id}`);
    } else {
      // Créer un nouveau record
      const newRow = {
        airtable_id: record.id,
        created_at: new Date().toISOString(),
        ...fields,
      };

      await sheet.addRow(newRow);
      console.log(`Nouveau record créé : ${record.id}`);
    }

    res.status(200).json({
      success: true,
      message: "Synchronisation réussie",
      action: existingRowIndex !== -1 ? "updated" : "created",
    });
  } catch (error) {
    console.error("Erreur synchronisation:", error);
    res.status(500).json({
      error: "Erreur synchronisation",
      details: error.message,
    });
  }
}
