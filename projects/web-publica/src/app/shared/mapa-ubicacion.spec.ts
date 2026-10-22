import { TestBed } from '@angular/core/testing';
import { MapaUbicacion } from './mapa-ubicacion';

function crear(embedUrl: string) {
  const f = TestBed.createComponent(MapaUbicacion);
  f.componentRef.setInput('embedUrl', embedUrl);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('MapaUbicacion', () => {
  it('incrusta un mapa de Google Maps por HTTPS', () => {
    const el = crear('https://www.google.com/maps?q=-15.6,-69.9&output=embed');
    expect(el.querySelector('iframe')?.getAttribute('src')).toBe('https://www.google.com/maps?q=-15.6,-69.9&output=embed');
  });

  it('sin URL no renderiza nada', () => {
    expect(crear('').querySelector('iframe')).toBeNull();
  });

  it('rechaza cualquier URL que no sea de Google Maps por HTTPS', () => {
    for (const url of ['http://www.google.com/maps?q=1', 'https://evil.example/maps', 'javascript:alert(1)', 'https://www.google.com.evil.example/maps']) {
      expect(crear(url).querySelector('iframe'), url).toBeNull();
    }
  });
});
