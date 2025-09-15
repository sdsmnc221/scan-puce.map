import https from "https";
import { URL } from "url";
import crypto from "crypto";

export default async function handler(req, res) {
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
    // Générer le access token
    const accessToken = await getAccessToken();

    // Appel à l'API Google Sheets
    const sheetName = encodeURIComponent(
      source === "draftBase" ? "draftBase" : "filloutBase"
    );
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}`;

    const sheetsData = await makeHttpsRequest(apiUrl, {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    });

    const data = JSON.parse(sheetsData);
    const rows = data.values || [];

    if (rows.length === 0) {
      return res.status(200).json([]);
    }

    // Première ligne = headers
    const headers = rows[0];

    // Convertir les lignes en objets comme Airtable
    const records = rows.slice(1).map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        if (row[index] !== undefined && row[index] !== "") {
          record[header] = row[index];
        }
      });
      return record;
    });

    console.log(`Retour de ${records.length} records depuis ${source}`);
    res.status(200).json(records);
  } catch (error) {
    console.error("Erreur Google Sheets:", error);
    res.status(500).json({
      error: "Erreur serveur",
      details: error.message,
    });
  }
}

// Fonction pour obtenir un access token Google
async function getAccessToken() {
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(
    /\\n/g,
    "\n"
  );
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;

  // Créer le JWT
  const jwt = createJWT(clientEmail, privateKey);

  // Échanger le JWT contre un access token
  const tokenData = await exchangeJWTForToken(jwt);
  return tokenData.access_token;
}

// Créer un JWT avec les APIs natives Node.js
function createJWT(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64urlEscape(
    Buffer.from(JSON.stringify(header)).toString("base64")
  );
  const encodedPayload = base64urlEscape(
    Buffer.from(JSON.stringify(payload)).toString("base64")
  );

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(signatureInput),
    privateKey
  );
  const encodedSignature = base64urlEscape(signature.toString("base64"));

  return `${signatureInput}.${encodedSignature}`;
}

// Échanger le JWT contre un access token
async function exchangeJWTForToken(jwt) {
  const postData = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;

  const response = await makeHttpsRequest(
    "https://oauth2.googleapis.com/token",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
    postData,
    "POST"
  );

  return JSON.parse(response);
}

// Fonction générique pour faire des requêtes HTTPS
function makeHttpsRequest(url, headers = {}, postData = null, method = "GET") {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: headers,
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }

    req.end();
  });
}

// Utilitaire pour l'encodage base64url
function base64urlEscape(str) {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
