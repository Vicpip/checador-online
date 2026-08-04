// Conversions between the Blob a check-in photo starts as and the base64
// string form it's stored as in IndexedDB while queued offline (see
// utils/offlineQueue.js) — plain JSON-serializable strings survive
// structured-clone/idb-keyval round trips more predictably than Blobs.
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
