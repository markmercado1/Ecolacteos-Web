/**
 * Fase G: forma del DNI y del RUC, la misma que valida el servidor (DocumentoIdentidad.java). Solo sirve para avisar antes de enviar:
 * la decisión final la toma el servidor, que también comprueba que DNI y RUC no estén repetidos.
 */
const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Sin espacios, guiones ni puntos; null si queda vacío. */
export function limpiarDocumento(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').replace(/[\s\-. ]/g, '');
  return limpio === '' ? null : limpio;
}

export function dniValido(dni: string | null): boolean {
  return dni !== null && /^\d{8}$/.test(dni);
}

/** 11 dígitos con dígito verificador módulo 11 (no mira el prefijo). */
export function rucValido(ruc: string | null): boolean {
  if (ruc === null || !/^\d{11}$/.test(ruc)) return false;
  const suma = PESOS_RUC.reduce((acc, peso, i) => acc + Number(ruc[i]) * peso, 0);
  let digito = 11 - (suma % 11);
  if (digito === 10) digito = 0;
  if (digito === 11) digito = 1;
  return Number(ruc[10]) === digito;
}

/**
 * Primer problema de los documentos según el tipo de persona, o null si la forma es correcta. `dniSinCambio` / `rucSinCambio`: el valor
 * es el que ya estaba guardado (un registro anterior fuera de formato se conserva y no se revalida, igual que en el servidor).
 */
export function problemaDocumentos(
  tipo: 'NATURAL' | 'EMPRESA',
  dni: string | null,
  ruc: string | null,
  razonSocial: string | null,
  dniSinCambio = false,
  rucSinCambio = false
): string | null {
  if (tipo === 'NATURAL') {
    if (dni === null) return 'El DNI es obligatorio para una persona natural.';
    if (!dniSinCambio && !dniValido(dni)) return 'El DNI debe tener exactamente 8 dígitos.';
    if (ruc !== null && !(rucSinCambio && dniSinCambio)) {
      if (!rucValido(ruc)) return 'El RUC debe tener 11 dígitos y un dígito verificador correcto.';
      if (!ruc.startsWith('10')) return 'El RUC de una persona natural empieza con 10.';
      if (ruc.substring(2, 10) !== dni) return 'El RUC de una persona natural es 10 + su DNI + un dígito verificador.';
    }
    return null;
  }
  if (ruc === null) return 'El RUC es obligatorio para una empresa.';
  if (!rucSinCambio) {
    if (!rucValido(ruc)) return 'El RUC debe tener 11 dígitos y un dígito verificador correcto.';
    if (!ruc.startsWith('20')) return 'El RUC de una empresa empieza con 20.';
  }
  if (!razonSocial || razonSocial.trim() === '') return 'La razón social es obligatoria para una empresa.';
  return null;
}

/** Texto corto del documento principal para una tabla: DNI y RUC si tiene ambos. */
export function documentoResumen(p: { dni: string | null; ruc: string | null }): string {
  if (p.dni && p.ruc) return `DNI ${p.dni} · RUC ${p.ruc}`;
  if (p.ruc) return `RUC ${p.ruc}`;
  if (p.dni) return `DNI ${p.dni}`;
  return '—';
}
