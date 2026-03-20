// scripts/obfuscate-production.mjs
// ==============================================================
// Ofuscacion de JS client-side para deploy de produccion
// Se ejecuta como parte del build: npm run obfuscate
//
// - Ofusca todos los .js en games/shared/, games/play/, js/, hdd/
// - NO toca netlify/functions/ (server-side, invisible al usuario)
// - NO toca node_modules/
// - El codigo fuente original permanece en GitHub (legible)
// - Solo el deploy a produccion tiene codigo ofuscado
// ==============================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';

// Verificar que javascript-obfuscator esta instalado
try {
    execSync('npx javascript-obfuscator --version', { stdio: 'pipe' });
} catch {
    console.log('[obfuscate] Instalando javascript-obfuscator...');
    execSync('npm install --no-save javascript-obfuscator', { stdio: 'inherit' });
}

// Directorios a ofuscar (solo client-side)
const DIRS_TO_OBFUSCATE = [
    'games/shared',
    'games/play',
    'js',
    'hdd'
];

// Archivos a excluir (configs, ya minificados, etc)
const EXCLUDE_FILES = [
    'supabase-config.js'  // tiene la anon key que es publica, no necesita ofuscacion
];

// Extensiones a procesar
const EXTENSIONS = ['.js'];

// Opciones de ofuscacion (nivel medio-alto: buen balance proteccion/performance)
const OBFUSCATOR_OPTIONS = [
    '--compact true',
    '--control-flow-flattening true',
    '--control-flow-flattening-threshold 0.5',
    '--dead-code-injection true',
    '--dead-code-injection-threshold 0.2',
    '--identifier-names-generator hexadecimal',
    '--rename-globals true',
    '--string-array true',
    '--string-array-encoding rc4',
    '--string-array-threshold 0.75',
    '--self-defending false',   // false para no romper en iframes
    '--transform-object-keys true',
    '--unicode-escape-sequence false'  // false para menor tamanio
].join(' ');

// Recolectar archivos
function collectFiles(dir) {
    let files = [];
    try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
            const fullPath = join(dir, entry);
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
                // Excluir subdirectorios que no son client-side
                if (entry === 'node_modules' || entry === 'netlify' || entry === '.git') continue;
                files = files.concat(collectFiles(fullPath));
            } else if (EXTENSIONS.includes(extname(entry)) && !EXCLUDE_FILES.includes(entry)) {
                files.push(fullPath);
            }
        }
    } catch { /* dir no existe, skip */ }
    return files;
}

// Main
console.log('[obfuscate] Ofuscando JS client-side para produccion...');
let total = 0, errors = 0;

for (const dir of DIRS_TO_OBFUSCATE) {
    const files = collectFiles(dir);
    for (const file of files) {
        try {
            const originalSize = statSync(file).size;
            // Solo ofuscar archivos >500 bytes (los chicos no valen la pena)
            if (originalSize < 500) continue;

            execSync(`npx javascript-obfuscator "${file}" --output "${file}" ${OBFUSCATOR_OPTIONS}`, {
                stdio: 'pipe',
                timeout: 60000  // 60s max por archivo
            });

            const newSize = statSync(file).size;
            console.log(`  [OK] ${file} (${originalSize} -> ${newSize} bytes)`);
            total++;
        } catch (e) {
            console.warn(`  [SKIP] ${file}: ${e.message?.slice(0, 80)}`);
            errors++;
        }
    }
}

console.log(`[obfuscate] Completado: ${total} archivos ofuscados, ${errors} errores.`);
