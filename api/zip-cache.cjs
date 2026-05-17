// api/zip-cache.cjs
const { put, list, del } = require("@vercel/blob");

const BLOB_NAME = process.env.BLOB_NAME;
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

async function readCache() {
  const { blobs } = await list({ prefix: BLOB_NAME, token: TOKEN });
  if (blobs.length === 0) return {};
  const res = await fetch(blobs[0].url, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
  return res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!BLOB_NAME || !TOKEN) {
    return res.status(503).json({ error: "Blob storage not configured" });
  }

  try {
    if (req.method === "GET") {
      const data = await readCache();
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      const incoming = req.body ?? {};
      if (Object.keys(incoming).length === 0) {
        return res.status(400).json({ error: "Empty body" });
      }

      // Read existing, merge, rewrite
      const { blobs } = await list({ prefix: BLOB_NAME, token: TOKEN });
      let existing = {};
      if (blobs.length > 0) {
        const r = await fetch(blobs[0].url, {
          headers: { authorization: `Bearer ${TOKEN}` },
        });
        existing = await r.json();
        await del(blobs[0].url, { token: TOKEN });
      }

      const merged = { ...existing, ...incoming };

      await put(BLOB_NAME, JSON.stringify(merged), {
        access: "private",
        token: TOKEN,
        addRandomSuffix: false,
      });

      return res.status(200).json({ updated: Object.keys(incoming).length });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("zip-cache error:", error);
    return res.status(500).json({ error: error.message });
  }
};
