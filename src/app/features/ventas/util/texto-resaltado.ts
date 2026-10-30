export interface ParteTexto {
  texto: string;
  resaltada: boolean;
}

/**
 * Una letra a su forma «plana»: sin acento y en minúscula, y SIEMPRE una sola unidad (misma longitud que el original), para que las posiciones
 * del texto plegado sirvan en el texto original. Mismo criterio que el buscador del servidor (huaman encuentra Huamán; nino encuentra Niño).
 */
function plegarLetra(c: string): string {
  const base = c.normalize('NFD')[0] ?? c;
  return base.toLowerCase()[0] ?? base;
}

function plegar(texto: string): string {
  let r = '';
  for (let i = 0; i < texto.length; i++) r += plegarLetra(texto[i]);
  return r;
}

/**
 * Parte `texto` en tres trozos para resaltar donde aparece `termino` por primera vez (sin distinguir mayúsculas ni acentos): lo de antes, la
 * coincidencia y lo de después. Sin término o sin coincidencia devuelve el texto entero sin resaltar. Nunca altera el texto mostrado.
 */
export function partesResaltadas(texto: string, termino: string): ParteTexto[] {
  const buscado = plegar(termino.trim());
  if (!buscado) return [{ texto, resaltada: false }];
  const inicio = plegar(texto).indexOf(buscado);
  if (inicio < 0) return [{ texto, resaltada: false }];
  const fin = inicio + buscado.length;
  return [
    { texto: texto.slice(0, inicio), resaltada: false },
    { texto: texto.slice(inicio, fin), resaltada: true },
    { texto: texto.slice(fin), resaltada: false }
  ].filter((p) => p.texto.length > 0);
}
