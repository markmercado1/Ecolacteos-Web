import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { JornadasApi } from './jornadas.api';

const base = environment.apiBaseUrl;

describe('JornadasApi', () => {
  let api: JornadasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(JornadasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listarBandeja() hace GET /jornadas sin parámetros', () => {
    api.listarBandeja().subscribe();
    const req = http.expectOne(`${base}/jornadas`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
