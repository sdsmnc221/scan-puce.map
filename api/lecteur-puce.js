// api/lecteurs-puce.js
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
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { source = "filloutBase" } = req.query;

  try {
    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SHEET_ID,
      serviceAccountAuth
    );
    await doc.loadInfo();

    // Choisir la bonne sheet selon le source
    const sheet = doc.sheetsByTitle[source] || doc.sheetsByTitle["filloutBase"];

    if (!sheet) {
      throw new Error(`Sheet ${source} introuvable`);
    }

    const rows = await sheet.getRows();

    // Convertir au même format que votre Airtable actuel
    const records = rows.map((row) => {
      const record = {};

      // Tous vos champs Airtable
      const fields = [
        "Author",
        "ZipCode",
        "CommuneName",
        "Dept",
        "Date de MAJ d'informations",
        "Infos MAJ ?",
        "Mail envoyé pour MAJ ?",
        "Contact",
        "Mode",
        "Unfilled",
        "ContactMode",
        "LinkToPost",
        "AccessICAD",
        "IsOrganisation",
        "Tel",
        "Email",
        "Notes",
        "LinkToUpdateRecord",
        "Uid",
        "DuplicateGroup",
        "LastVerificationDate",
        "VerificationStatus",
        "IsPotentialDuplicate",
        "AuthorLowercase",
        "CommuneNameLowercase",
      ];

      fields.forEach((field) => {
        const value = row.get(field);
        if (value !== null && value !== undefined) {
          record[field] = value;
        }
      });

      return record;
    });

    res.status(200).json(records);
  } catch (error) {
    console.error("Erreur Google Sheets:", error);
    res.status(500).json({
      error: "Erreur serveur",
      details: error.message,
    });
  }
};
