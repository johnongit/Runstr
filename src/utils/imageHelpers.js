export const getAvatarUrl = (url, size = 48) => {
  // If no URL provided, caller should handle default placeholder.
  if (!url) return null;

  try {
    // Strip protocol because images.weserv.nl expects domain-only in `url` param.
    const sanitized = url.replace(/^https?:\/\//i, '');
    const encoded = encodeURIComponent(sanitized);

    // Return proxy thumbnail – caller can still switch back to original via error handler.
    return `https://images.weserv.nl/?url=${encoded}&w=${size}&h=${size}&fit=cover&output=webp`;
  } catch (_e) {
    // In case of malformed URL or encoding error, fall back to original URL.
    return url;
  }
}; 