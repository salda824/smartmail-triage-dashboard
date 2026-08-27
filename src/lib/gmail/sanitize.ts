/**
 * Limpieza de texto comun a todas las fuentes de correo.
 */

/**
 * Quita el relleno invisible del correo masivo.
 *
 * Muchos boletines inyectan cientos de U+034F, U+200B o soft hyphen despues del
 * preheader para estirar la vista previa en la bandeja. Sin limpiarlos el
 * snippet se llena de basura y las palabras clave se parten por la mitad, lo
 * que degrada tanto la clasificacion como lo que ve el usuario en la tarjeta.
 */
export function stripInvisible(text: string): string {
  return text
    .replace(/[\u00AD\u034F\u200B-\u200F\u2028\u2029\u202F\u205F\u2060\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Version de una sola linea, para snippets. */
export function toSingleLine(text: string, maxLength = 220): string {
  const clean = stripInvisible(text).replace(/\s+/g, ' ');
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1).trimEnd()}…` : clean;
}
