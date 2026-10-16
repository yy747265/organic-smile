// ONE place to point the storefront at your API.
// Local testing  -> the public API run with:  uvicorn api.index:app --port 8001
// GitHub Pages   -> replace the Vercel URL below with your real deployment URL.
window.ORGANIC_CONFIG = {
    API_BASE: ["localhost", "127.0.0.1", ""].includes(location.hostname)
        ? "http://127.0.0.1:8001"
        : "https://organic-smile-api.vercel.app",
    WHATSAPP: "201061429669"
};
