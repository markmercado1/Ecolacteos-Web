import { environment } from '../../../../environments/environment';

/** Tipos y límites que acepta POST/PUT .../foto (FotoCatalogoService en el backend). */
export const TIPOS_FOTO_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];
export const BYTES_MAXIMOS_FOTO = 5 * 1024 * 1024;
/** Lado máximo al que el panel reduce la foto antes de subirla (el catálogo público no necesita más). */
export const LADO_MAXIMO_FOTO_PX = 1600;

/**
 * Las URLs de foto que devuelve la API son relativas al backend ("/api/catalogo/fotos/xxx.jpg"). Una etiqueta
 * <img> no pasa por HttpClient, así que se resuelven contra el origen de `environment.apiBaseUrl`.
 */
export function urlFotoCatalogo(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl) return null;
  try {
    return new URL(fotoUrl, environment.apiBaseUrl).href;
  } catch {
    return fotoUrl; // apiBaseUrl relativo (mismo origen): la ruta ya sirve tal cual
  }
}

/** null si el tipo es válido; si no, el mensaje para el usuario. */
export function validarTipoFoto(archivo: File): string | null {
  return TIPOS_FOTO_PERMITIDOS.includes(archivo.type) ? null : 'Elige una imagen JPEG, PNG o WebP.';
}

/**
 * Reduce la foto a LADO_MAXIMO_FOTO_PX y la vuelve a codificar en el navegador antes de subirla:
 *  - la página pública carga rápido aunque la foto original sea de varios MB;
 *  - se descartan los metadatos EXIF (ubicación GPS del celular) de una foto que será pública;
 *  - el navegador aplica la orientación EXIF al decodificar, así que la foto no queda girada.
 * PNG se conserva como PNG (transparencia); el resto sale como JPEG. Si el navegador no puede procesarla
 * (sin canvas o imagen ilegible) se devuelve el archivo original y el servidor decide si es válido.
 */
export async function prepararFoto(archivo: File): Promise<File> {
  try {
    const imagen = await createImageBitmap(archivo);
    const escala = Math.min(1, LADO_MAXIMO_FOTO_PX / Math.max(imagen.width, imagen.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagen.width * escala));
    canvas.height = Math.max(1, Math.round(imagen.height * escala));
    const contexto = canvas.getContext('2d');
    if (!contexto) return archivo;
    const tipo = archivo.type === 'image/png' ? 'image/png' : 'image/jpeg';
    if (tipo === 'image/jpeg') {
      contexto.fillStyle = '#ffffff'; // JPEG no tiene transparencia: fondo blanco en vez de negro
      contexto.fillRect(0, 0, canvas.width, canvas.height);
    }
    contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
    imagen.close?.();
    const blob = await new Promise<Blob | null>((resolver) => canvas.toBlob(resolver, tipo, 0.85));
    if (!blob) return archivo;
    const extension = tipo === 'image/png' ? 'png' : 'jpg';
    return new File([blob], `foto.${extension}`, { type: tipo });
  } catch {
    return archivo;
  }
}
