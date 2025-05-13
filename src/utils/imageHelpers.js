export const getAvatarUrl = (url, size = 48) => {
  // If no URL provided, caller should handle default placeholder.
  if (!url) return null;

  try {
    // Use images.weserv.nl proxy to resize and convert to WebP for faster loading.
    const encoded = encodeURIComponent(url);
    // fit=cover ensures square crop, output=webp gives modern image format with good compression.
    return `https://images.weserv.nl/?url=${encoded}&w=${size}&h=${size}&fit=cover&output=webp`;
  } catch (_e) {
    // In case of malformed URL or encoding error, fall back to original URL.
    return url;
  }
}; 