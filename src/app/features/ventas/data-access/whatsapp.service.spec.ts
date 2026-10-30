import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { WhatsappService } from './whatsapp.service';

describe('WhatsappService', () => {
  let service: WhatsappService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(WhatsappService);
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('la primera vez propone el número ficticio de configuración', () => {
    expect(environment.whatsappPorDefecto).toBe('51900000000');
    expect(service.numeroPropuesto()).toBe('51900000000');
  });

  it('después propone el último número usado (hoy uno, mañana otro)', () => {
    service.recordar('51987654321');
    expect(service.numeroPropuesto()).toBe('51987654321');
    service.recordar('51911222333');
    expect(service.numeroPropuesto()).toBe('51911222333');
  });

  it('un valor guardado que ya no es válido se ignora', () => {
    localStorage.setItem('ecolacteos.whatsapp.numero', 'basura');
    expect(service.numeroPropuesto()).toBe('51900000000');
  });

  it('sin almacenamiento disponible no falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    expect(service.numeroPropuesto()).toBe('51900000000');
    expect(() => service.recordar('51987654321')).not.toThrow();
  });

  it('arma el enlace wa.me con el texto codificado', () => {
    expect(service.enlace('51987654321', 'Hola & total: S/ 5.00\nGracias')).toBe(
      'https://wa.me/51987654321?text=Hola%20%26%20total%3A%20S%2F%205.00%0AGracias'
    );
  });

  it('abrir() recuerda el número, abre el enlace en otra pestaña y avisa si el navegador la bloqueó', () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValueOnce({} as Window).mockReturnValueOnce(null);
    expect(service.abrir('51987654321', 'Hola')).toBe(true);
    expect(abrir).toHaveBeenCalledWith('https://wa.me/51987654321?text=Hola', '_blank', 'noopener');
    expect(service.numeroPropuesto()).toBe('51987654321');
    expect(service.abrir('51911222333', 'Hola')).toBe(false);
  });
});
