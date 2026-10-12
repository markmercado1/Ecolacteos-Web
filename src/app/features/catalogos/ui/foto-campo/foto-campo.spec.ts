import { TestBed } from '@angular/core/testing';
import { BYTES_MAXIMOS_FOTO } from '../../data-access/foto-catalogo';
import { FotoCambio, FotoCampo } from './foto-campo';

function crear(fotoUrl: string | null = null) {
  const f = TestBed.createComponent(FotoCampo);
  f.componentRef.setInput('fotoUrl', fotoUrl);
  const emitidos: FotoCambio[] = [];
  f.componentInstance.cambio.subscribe((c) => emitidos.push(c));
  return { f, c: f.componentInstance as unknown as Record<string, any>, emitidos };
}

function evento(archivo: File | undefined): Event {
  return { target: { files: archivo ? [archivo] : [], value: 'C:\\fakepath\\x' } } as unknown as Event;
}

function imagen(tipo = 'image/jpeg', bytes = 10): File {
  return new File([new Uint8Array(bytes)], 'x', { type: tipo });
}

describe('FotoCampo', () => {
  beforeEach(() => {
    // jsdom no implementa createImageBitmap: prepararFoto devuelve el archivo original
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('sin soporte')));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('muestra la foto guardada y no emite nada hasta que el usuario actúe', () => {
    const { f, emitidos } = crear('/api/catalogo/fotos/abc.jpg');
    f.detectChanges();

    expect(f.nativeElement.querySelector('img')?.getAttribute('src')).toContain('/api/catalogo/fotos/abc.jpg');
    expect(emitidos).toEqual([]);
  });

  it('sin foto guardada muestra "Sin foto"', () => {
    const { f } = crear();
    f.detectChanges();

    expect(f.nativeElement.textContent).toContain('Sin foto');
  });

  it('elegir una imagen válida emite el archivo pendiente', async () => {
    const { c, emitidos } = crear();
    const elegida = imagen('image/png');

    await c['elegir'](evento(elegida));

    expect(emitidos).toEqual([{ archivo: elegida, quitar: false }]);
    expect(c['error']()).toBeNull();
  });

  it('rechaza un tipo de archivo no permitido sin emitir', async () => {
    const { c, emitidos } = crear();

    await c['elegir'](evento(imagen('application/pdf')));

    expect(c['error']()).toContain('JPEG, PNG o WebP');
    expect(emitidos).toEqual([]);
  });

  it('rechaza una foto que sigue pesando más de 5 MB tras prepararla', async () => {
    const { c, emitidos } = crear();

    await c['elegir'](evento(imagen('image/jpeg', BYTES_MAXIMOS_FOTO + 1)));

    expect(c['error']()).toContain('5 MB');
    expect(emitidos).toEqual([]);
  });

  it('cancelar el selector (sin archivo) no hace nada', async () => {
    const { c, emitidos } = crear();

    await c['elegir'](evento(undefined));

    expect(emitidos).toEqual([]);
    expect(c['error']()).toBeNull();
  });

  it('quitar una foto guardada emite quitar=true y oculta la vista', () => {
    const { f, c, emitidos } = crear('/api/catalogo/fotos/abc.jpg');

    c['quitarFoto']();
    f.detectChanges();

    expect(emitidos).toEqual([{ archivo: null, quitar: true }]);
    expect(f.nativeElement.querySelector('img')).toBeNull();
  });

  it('descartar una selección pendiente vuelve a la foto guardada, sin pedir quitarla', async () => {
    const { c, emitidos } = crear('/api/catalogo/fotos/abc.jpg');
    await c['elegir'](evento(imagen()));

    c['quitarFoto']();

    expect(emitidos[emitidos.length - 1]).toEqual({ archivo: null, quitar: false });
  });

  it('elegir una foto nueva después de pedir quitar cancela el quitar', async () => {
    const { c, emitidos } = crear('/api/catalogo/fotos/abc.jpg');
    c['quitarFoto']();
    const nueva = imagen();

    await c['elegir'](evento(nueva));

    expect(emitidos[emitidos.length - 1]).toEqual({ archivo: nueva, quitar: false });
  });
});
