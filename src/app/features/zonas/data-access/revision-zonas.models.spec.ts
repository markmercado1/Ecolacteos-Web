import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { RevisionZonasApi } from './revision-zonas.api';
import { etiquetaMotivoSinZona } from './revision-zonas.models';

describe('etiquetaMotivoSinZona', () => {
  it('traduce los motivos del servidor y deja pasar uno desconocido sin inventarlo', () => {
    expect(etiquetaMotivoSinZona('DIA_DE_CAMBIO')).toContain('Día de cambio de zona');
    expect(etiquetaMotivoSinZona('SIN_PERIODO')).toContain('Ningún periodo');
    expect(etiquetaMotivoSinZona('OTRO')).toBe('Otro motivo');
    expect(etiquetaMotivoSinZona('MOTIVO_NUEVO')).toBe('MOTIVO_NUEVO');
  });
});

describe('RevisionZonasApi', () => {
  it('obtener() lee el informe por GET (solo lectura, sin cuerpo)', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(RevisionZonasApi).obtener().subscribe();
    const req = http.expectOne(`${environment.apiBaseUrl}/admin/zonas/revision`);
    expect(req.request.method).toBe('GET');
    req.flush({});
    http.verify();
  });
});
