import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { reserva } from '../../testing/datos';
import { ConsultarPage } from './consultar';

describe('ConsultarPage', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ConsultarPage>;
  let page: Record<string, any>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ConsultarPage);
    page = fixture.componentInstance as unknown as Record<string, any>;
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  const texto = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const consultar = (codigo = 'abcd234567', telefono = '987654321') => {
    page['form'].setValue({ codigo, telefono });
    page['consultar']();
  };

  it('exige código y teléfono antes de consultar', () => {
    page['consultar']();
    fixture.detectChanges();
    http.expectNone((r) => r.method === 'POST');
    expect(texto()).toContain('Escribe tu código de seguimiento.');
    expect(texto()).toContain('Escribe un celular de 9 dígitos');
  });

  it('consulta con POST (el teléfono no viaja en la URL), código en mayúsculas y sin credenciales', () => {
    consultar(' abcd234567 ', '+51 987 654 321');
    const req = http.expectOne('/api/catalogo/reservas/consulta');
    expect(req.request.method).toBe('POST');
    expect(req.request.url).not.toContain('987');
    expect(req.request.body).toEqual({ codigo: 'ABCD234567', telefono: '+51 987 654 321' });
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(reserva());
  });

  it('una consulta repetida mientras espera no duplica la petición', () => {
    consultar();
    page['consultar']();
    http.expectOne('/api/catalogo/reservas/consulta').flush(reserva());
  });

  it('muestra el estado real, los productos, la fecha de retiro y el total', () => {
    consultar();
    http.expectOne('/api/catalogo/reservas/consulta').flush(reserva({ estado: 'CONFIRMADA' }));
    fixture.detectChanges();
    const t = texto();
    expect(t).toContain('ABCD234567');
    expect(t).toContain('Confirmada');
    expect(t).toContain('Tu reserva está confirmada');
    expect(t).toContain('Martes 13 de octubre de 2026');
    expect(t).toContain('Yogurt Natural');
    expect(t).toContain('Total: S/ 17.00');
  });

  it('una reserva pendiente se explica como pendiente (no confirmada) y avisa del precio a confirmar', () => {
    consultar();
    http.expectOne('/api/catalogo/reservas/consulta').flush(reserva({ estado: 'PENDIENTE', precioAConfirmar: true, total: null }));
    fixture.detectChanges();
    const t = texto();
    expect(t).toContain('pendiente de confirmación');
    expect(t).toContain('Todavía no está confirmada');
    expect(t).toContain('precio a confirmar');
    expect(t).toContain('Total: por confirmar');
    expect(t).toContain('12/10/2026 09:30');
  });

  it('explica cada estado final y ofrece hacer una nueva reserva', () => {
    for (const [estado, frase] of [['RECHAZADA', 'No pudimos aceptar'], ['CANCELADA', 'fue cancelada'], ['VENCIDA', 'venció'], ['RETIRADA', 'ya fue retirada']] as const) {
      consultar();
      http.expectOne('/api/catalogo/reservas/consulta').flush(reserva({ estado }));
      fixture.detectChanges();
      expect(texto()).toContain(frase);
      expect(texto()).toContain('Hacer una nueva reserva');
    }
  });

  it('datos que no coinciden o código inexistente: el mismo mensaje (404) sin revelar nada más', () => {
    consultar();
    http.expectOne('/api/catalogo/reservas/consulta').flush({ mensaje: 'Reserva no encontrada' }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(texto()).toContain('No encontramos una reserva con ese código y teléfono');
    expect(page['reserva']()).toBeNull();
  });

  it('sin conexión muestra un error de red y permite volver a intentar', () => {
    consultar();
    http.expectOne('/api/catalogo/reservas/consulta').error(new ProgressEvent('error'));
    fixture.detectChanges();
    expect(texto()).toContain('No pudimos conectar con el servidor');
    page['consultar']();
    http.expectOne('/api/catalogo/reservas/consulta').flush(reserva());
  });

  it('un resultado anterior no queda a la vista mientras se hace una nueva consulta', () => {
    consultar();
    http.expectOne('/api/catalogo/reservas/consulta').flush(reserva());
    expect(page['reserva']()).not.toBeNull();
    consultar('zzzzzzzzzz');
    expect(page['reserva']()).toBeNull();
    http.expectOne('/api/catalogo/reservas/consulta').flush({ mensaje: 'x' }, { status: 404, statusText: 'Not Found' });
  });
});
