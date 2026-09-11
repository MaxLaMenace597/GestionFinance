/**
 * Cloudflare Worker — proxy pour cacher tes clés API.
 *
 * Déploiement :
 * 1. Va sur dash.cloudflare.com -> Workers & Pages -> Create Worker.
 * 2. Colle ce code dans l'éditeur.
 * 3. Dans Settings -> Variables, ajoute deux secrets (type "Secret", pas "Text") :
 *      FOOTBALL_API_KEY = ta clé football-data.org
 *      TENNIS_API_KEY   = ta clé livetennisapi.com
 * 4. Déploie. Tu obtiens une URL du type https://ton-worker.ton-pseudo.workers.dev
 * 5. Colle cette URL dans WORKER_URL en haut du script de index.html.
 *
 * Ce Worker ne fait que relayer les requêtes : ta page GitHub Pages appelle
 * CE worker, jamais directement football-data.org ou livetennisapi.com.
 * Tes clés ne sont donc jamais visibles dans le code source de ton site.
 */

// Autorise uniquement ton site GitHub Pages à appeler ce Worker.
// Remplace par ta vraie URL une fois le site en ligne (ex: "https://ton-pseudo.github.io").
const ALLOWED_ORIGIN = "*"; // à restreindre une fois que tu connais l'URL finale de ton site

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    try {
      if (url.pathname === "/api/football") {
        // Exemple : matchs du jour sur les compétitions couvertes par le plan gratuit
        const today = new Date().toISOString().slice(0, 10);
        const apiRes = await fetch(
          `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`,
          { headers: { "X-Auth-Token": env.FOOTBALL_API_KEY } }
        );
        const data = await apiRes.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      if (url.pathname === "/api/tennis") {
        const apiRes = await fetch(
          `https://live-tennis-api.com/api/v1/matches?api_key=${env.TENNIS_API_KEY}`
        );
        const data = await apiRes.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", ...corsHeaders() },
        });
      }

      return new Response(JSON.stringify({ error: "Route inconnue" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
  },
};
