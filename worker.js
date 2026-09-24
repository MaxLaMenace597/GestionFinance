/**
 * Cloudflare Worker — synchronisation de « Mes comptes » entre appareils.
 *
 * Route unique : /api/data
 *   GET  -> renvoie tes données (ou null s'il n'y a encore rien)
 *   POST -> enregistre tes données
 * Chaque requête doit contenir l'en-tête X-App-Secret = ton mot de passe (secret APP_SECRET).
 *
 * Configuration nécessaire dans le dashboard Cloudflare :
 *   - un namespace KV relié à ce Worker sous le nom DATA
 *   - un secret APP_SECRET (type "Secret")
 */

// Mets l'adresse de ton site une fois qu'il marche, ex. "https://ton-pseudo.github.io" (sans / à la fin).
const ALLOWED_ORIGIN = "*";

const STORAGE_KEY = "finances";
const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo, largement assez

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Secret",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// Comparaison en temps constant, pour ne pas laisser deviner le mot de passe caractère par caractère
async function secretMatches(given, expected) {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(given)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname !== "/api/data") {
      return json({ error: "Route inconnue" }, 404);
    }

    if (!env.APP_SECRET || !env.DATA) {
      return json({ error: "Worker mal configuré : il manque le secret APP_SECRET ou le KV DATA." }, 500);
    }

    const given = request.headers.get("X-App-Secret") || "";
    if (!(await secretMatches(given, env.APP_SECRET))) {
      return json({ error: "Mot de passe incorrect" }, 401);
    }

    try {
      if (request.method === "GET") {
        const raw = await env.DATA.get(STORAGE_KEY);
        return new Response(raw || "null", {
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders() },
        });
      }

      if (request.method === "POST") {
        const text = await request.text();
        if (text.length > MAX_SIZE) return json({ error: "Données trop volumineuses" }, 413);

        let data;
        try { data = JSON.parse(text); } catch { return json({ error: "JSON invalide" }, 400); }
        if (!data || data.schema !== "finances-v1") return json({ error: "Format de données inattendu" }, 400);

        await env.DATA.put(STORAGE_KEY, text);
        return json({ ok: true, updatedAt: data.updatedAt || null });
      }

      return json({ error: "Méthode non autorisée" }, 405);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },
};
