import express from "express";
import fetch from "node-fetch";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import ejs from "ejs";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const HOST = process.env.HOST;
const SCOPES = "read_orders";
const REDIRECT_URI = `${HOST}/auth/callback`;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    `frame-ancestors https://${req.query.shop} https://admin.shopify.com`
  );
  next();
});

// 1. Iniciar la instalación
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Falta 'shop'");

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(installUrl);
});

// 2. Shopify redirige aquí
app.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send("Faltan parámetros");

  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) return res.status(401).send("Error al generar token");

  // Mostrar el panel embebido una vez obtenido el token
  res.redirect(`/panel?shop=${shop}`);
});

// 3. Mostrar el panel embebido con datos actualizados
app.get("/panel", (req, res) => {
  const shop = req.query.shop || "tienda-desconocida";

  // Cargar los datos de las entradas desde el archivo JSON
  let entries = [];
  try {
    const dataPath = path.join(__dirname, "estructura-entradas.json");
    const jsonData = fs.readFileSync(dataPath, "utf-8");
    entries = JSON.parse(jsonData);
  } catch (err) {
    console.error("Error al cargar los datos de entradas:", err);
    entries = [];
  }

  // Aplicar filtros de fecha (si se proporcionan fechas "from" y/o "to")
  const from = req.query.from || "";
  const to = req.query.to || "";
  let filteredEntries = entries;
  if (from || to) {
    let fromDate = from ? new Date(from) : null;
    let toDate = to ? new Date(to) : null;
    if (toDate) {
      // Establecer el final del día para la fecha "to"
      toDate.setHours(23, 59, 59, 999);
    }
    filteredEntries = entries.filter(o => {
      if (fromDate) {
        if (!o.escaneado_en) return false;
        const scanDate = new Date(o.escaneado_en._seconds * 1000);
        if (scanDate < fromDate) return false;
      }
      if (toDate) {
        if (!o.escaneado_en) return false;
        const scanDate = new Date(o.escaneado_en._seconds * 1000);
        if (scanDate > toDate) return false;
      }
      return true;
    });
  }

  // Calcular los totales para mostrar en el panel
  const totals = {
    emitidas: filteredEntries.length,
    usadas: filteredEntries.filter(o => o.usada).length,
    duplicados: filteredEntries.filter(o => o.intento_dupe).length
  };

  // Renderizar la vista "dashboard" con los datos filtrados y los totales
  res.render("dashboard", {
    shop,
    totals,
    filters: { from, to },
    data: filteredEntries
  });
});

app.listen(PORT, () => {
  console.log(`🟢 Servidor en marcha en http://localhost:${PORT}`);
});