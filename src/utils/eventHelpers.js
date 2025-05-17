export const getEventTargetId = (event) => {
  if (!event || !Array.isArray(event.tags)) return null;
  // Find first 'e' tag
  const eTag = event.tags.find((t) => t[0] === 'e');
  if (!eTag) return null;
  // Some receipts put id in index 1, some in 2
  return eTag[1] || eTag[2] || null;
};

export const chunkArray = (arr, size = 150) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}; 