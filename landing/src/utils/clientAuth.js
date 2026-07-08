const normalizeUrl = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed || null;
};

export const getClientAuthUrl = () => {
  const envUrl = normalizeUrl(import.meta.env.VITE_CLIENT_AUTH_URL);
  if (envUrl) return envUrl;

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8089/login`;
  }

  return "/login";
};
