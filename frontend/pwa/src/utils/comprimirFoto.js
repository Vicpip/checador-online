// Client-side photo compression before upload — no external libraries needed.
// Defaults come from Vite env vars (frontend/pwa/.env → VITE_FOTO_MAX_WIDTH /
// VITE_FOTO_QUALITY), mirroring the backend's FOTO_MAX_WIDTH / FOTO_QUALITY
// so both sides of a deployment stay in sync.
const DEFAULT_MAX_WIDTH = Number(import.meta.env.VITE_FOTO_MAX_WIDTH) || 1200;
const DEFAULT_QUALITY = Number(import.meta.env.VITE_FOTO_QUALITY) || 0.75;

export async function comprimirFoto(file, maxWidth = DEFAULT_MAX_WIDTH, quality = DEFAULT_QUALITY) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la foto."))),
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
