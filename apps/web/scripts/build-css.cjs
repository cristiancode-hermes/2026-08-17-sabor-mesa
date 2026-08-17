#!/usr/bin/env node
/**
 * Pre-compila el CSS fuente (styles.source.css) a styles.css.
 * Colmado usa CSS puro con variables — el paso es un copy con log,
 * manteniendo el patrón source → compiled de los otros proyectos.
 * Uso: node scripts/build-css.cjs
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../src/styles.source.css');
const OUT = path.resolve(__dirname, '../src/styles.css');

if (!fs.existsSync(SRC)) {
  console.error('No styles.source.css found');
  process.exit(1);
}
const source = fs.readFileSync(SRC, 'utf8');
fs.writeFileSync(OUT, source, 'utf8');
console.log('CSS done:', (source.length / 1024).toFixed(1) + 'KB -> styles.css');
