// shopify-oauth-wrapper/server.js
import express from "express";
import fetch from "node-fetch";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3000;

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
const SCOPES = "read_orders"; // puedes poner más scopes si quieres
const HOST = process.env.HOST; // Ej: https://mi-app-wrapper.onrender.com
const REDIRECT_URI = `${HOST}/auth/callback`;
const DASHBOARD_URL = "https://validacion-entradas-indep-pub.web.app/panel";

// 1. Redirigir al flujo de instalación de Shopify
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Falta el parámetro 'shop'");

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SCOPES}&redirect_uri=${REDIRECT_URI}`;
  res.redirect(installUrl);
});

// 2. Shopify redirige aquí con un código de autorización
app.get("/auth/callback", async (req, res) => {
  const { shop, code } = req.query;

  if (!shop || !code) return res.status(400).send("Faltan parámetros");

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: SHOPIFY_API_KEY,
      client_secret: SHOPIFY_API_SECRET,
      code
    })
  });

  const data = await response.json();
  if (!data.access_token) return res.status(401).send("Autenticación fallida");

  // Redirige al dashboard
  res.redirect(DASHBOARD_URL);
});

app.get("/", (req, res) => {
  res.send("Bienvenido. Usa /auth?shop=TU-TIENDA.myshopify.com para empezar.");
});

app.listen(PORT, () => console.log(`🟢 Wrapper en marcha en puerto ${PORT}`));