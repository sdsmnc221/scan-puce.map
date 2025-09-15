// api/sync-to-sheets.js
const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
  key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const airtableData = req.body;
    console.log("Webhook reçu:", JSON.stringify(airtableData, null, 2));

    // Extraire les données du webhook Airtable
    const record = airtableData.record || airtableData;
    const fields = record.fields;

    if (!fields) {
      throw new Error("Aucun champ trouvé dans les données");
    }

    // Connexion à Google Sheets
    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SHEET_ID,
      serviceAccountAuth
    );
    await doc.loadInfo();

    // Déterminer la sheet cible
    const targetSheet = fields.source === "draft" ? "draftBase" : "filloutBase";
    const sheet = doc.sheetsByTitle[targetSheet];

    if (!sheet) {
      throw new Error(`Sheet ${targetSheet} introuvable`);
    }

    // Vérifier si le record existe déjà
    const rows = await sheet.getRows();
    const existingRowIndex = rows.findIndex(
      (row) => row.get("airtable_id") === record.id
    );

    if (existingRowIndex !== -1) {
      // Mettre à jour
      const existingRow = rows[existingRowIndex];
      Object.keys(fields).forEach((key) => {
        existingRow.set(key, fields[key]);
      });
      existingRow.set("last_updated", new Date().toISOString());
      await existingRow.save();

      console.log(`Record mis à jour : ${record.id}`);
      res.status(200).json({
        success: true,
        message: "Record mis à jour",
        recordId: record.id,
      });
    } else {
      // Créer nouveau
      const newRow = {
        airtable_id: record.id,
        created_at: new Date().toISOString(),
        ...fields,
      };

      await sheet.addRow(newRow);
      console.log(`Nouveau record créé : ${record.id}`);
      res.status(200).json({
        success: true,
        message: "Nouveau record créé",
        recordId: record.id,
      });
    }
  } catch (error) {
    console.error("Erreur synchronisation:", error);
    res.status(500).json({
      error: "Erreur synchronisation",
      details: error.message,
    });
  }
};
