const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"  // This stays the same for local development
    : "/api";                     // This is the change for production

export default API_BASE_URL;