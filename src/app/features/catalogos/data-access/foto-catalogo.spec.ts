import { environment } from '../../../../environments/environment';
import { LADO_MAXIMO_FOTO_PX, prepararFoto, urlFotoCatalogo, validarTipoFoto } from './foto-catalogo';

function archivo(tipo: string, nombre = 'a', bytes = 10): File {
  return new File([new Uint8Array(bytes)], nombre, { type: tipo });
}

describe('foto-catalogo', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('urlFotoCatalogo', () => {
    it('resuelve la URL relativa de la API contra el origen del backend', () => {
      const origen = new URL(environment.apiBaseUrl).origin;
      expect(urlFotoCatalogo('/api/catalogo/fotos/abc.jpg')).toBe(`${origen}/api/catalogo/fotos/abc.jpg`);
    });

    it('devuelve null si no hay foto', () => {
      expect(urlFotoCatalogo(null)).toBeNull();
      expect(urlFotoCatalogo(undefined)).toBeNull();
      expect(urlFotoCatalogo('')).toBeNull();
    });
  });

  describe('validarTipoFoto', () => {
    it('acepta JPEG, PNG y WebP', () => {
      for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
        expect(validarTipoFoto(archivo(tipo))).toBeNull();
      }
    });

    it('rechaza cualquier otro tipo', () => {
      expect(validarTipoFoto(archivo('application/pdf'))).toBeTruthy();
      expect(validarTipoFoto(archivo('image/gif'))).toBeTruthy();
      expect(validarTipoFoto(archivo(''))).toBeTruthy();
    });
  });

  describe('prepararFoto', () => {
    it('si el navegador no puede procesar la imagen, devuelve el archivo original', async () => {
      const original = archivo('image/jpeg');
      vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('ilegible')));

      expect(await prepararFoto(original)).toBe(original);
    });

    function simularNavegador(ancho: number, alto: number) {
      const dibujos: Array<[number, number]> = [];
      const contexto = {
        fillStyle: '',
        fillRect: vi.fn(),
        drawImage: (_i: unknown, _x: number, _y: number, w: number, h: number) => dibujos.push([w, h])
      };
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => contexto,
        toBlob: (cb: (b: Blob | null) => void, tipo: string) => cb(new Blob([new Uint8Array(5)], { type: tipo }))
      };
      vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: ancho, height: alto, close: vi.fn() }));
      const crear = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((etiqueta: string) =>
        etiqueta === 'canvas' ? (canvas as unknown as HTMLCanvasElement) : crear(etiqueta)
      );
      return { canvas, contexto, dibujos };
    }

    it('reduce una foto grande al lado máximo conservando la proporción y la entrega como JPEG', async () => {
      const { canvas, contexto } = simularNavegador(3200, 1600);

      const resultado = await prepararFoto(archivo('image/jpeg', 'grande.jpg'));

      expect(canvas.width).toBe(LADO_MAXIMO_FOTO_PX);
      expect(canvas.height).toBe(LADO_MAXIMO_FOTO_PX / 2);
      expect(resultado.type).toBe('image/jpeg');
      expect(resultado.name).toBe('foto.jpg');
      expect(contexto.fillRect).toHaveBeenCalled(); // fondo blanco, JPEG no tiene transparencia
    });

    it('no amplía una foto pequeña y conserva PNG sin fondo blanco', async () => {
      const { canvas, contexto } = simularNavegador(400, 300);

      const resultado = await prepararFoto(archivo('image/png', 'logo.png'));

      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(300);
      expect(resultado.type).toBe('image/png');
      expect(resultado.name).toBe('foto.png');
      expect(contexto.fillRect).not.toHaveBeenCalled();
    });

    it('un WebP sale como JPEG', async () => {
      simularNavegador(800, 600);

      expect((await prepararFoto(archivo('image/webp'))).type).toBe('image/jpeg');
    });
  });
});
