export const getAvatarUrl = (url, size = 48) => {
  // If no URL provided, caller should handle default placeholder.
  if (!url) return null;

  try {
    // If the picture is served over plain HTTP, browsers will refuse to load it on an HTTPS page.
    // In that case we proxy through images.weserv.nl and keep the optimisation we previously removed.
    if (url.startsWith('http://')) {
      const sanitized = url.replace(/^https?:\/\//i, '');
      const encoded = encodeURIComponent(sanitized);
      return `https://images.weserv.nl/?url=${encoded}&w=${size}&h=${size}&fit=cover&output=webp`;
    }
    // Safe (https) URL – return as-is.
    return url;
  } catch (_e) {
    // In case of malformed URL or encoding error, fall back to original URL.
    return url;
  }
}; 