#!/usr/bin/env node

/**
 * Script de setup y validación para desarrollo
 * Ejecutar: node scripts/setup.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('🔧 Iniciando validación del proyecto...\n');

// ============================================================================
// 1. Verificar variables de entorno
// ============================================================================
console.log('📋 Verificando variables de entorno...');

const requiredVars = {
  'FIREBASE_SERVICE_ACCOUNT': 'Firebase Service Account (Base64 o JSON)',
  'CRON_SECRET': 'Secret para autorizar cron jobs',
  'LOG_LEVEL': 'Nivel de logging (info, debug, warn, error)'
};

const envFile = path.join(projectRoot, '.env');
const envExampleFile = path.join(projectRoot, '.env.example');

if (!fs.existsSync(envFile)) {
  console.warn('⚠️  No existe .env - copiando desde .env.example');
  if (fs.existsSync(envExampleFile)) {
    fs.copyFileSync(envExampleFile, envFile);
    console.log('✅ .env creado desde template');
  } else {
    console.error('❌ ERROR: No se encuentra .env.example');
    process.exit(1);
  }
}

const envContent = fs.readFileSync(envFile, 'utf-8');
let envOk = true;

for (const [key, desc] of Object.entries(requiredVars)) {
  if (envContent.includes(key) && !envContent.includes(`${key}=your-`)) {
    console.log(`✅ ${key}: configurado`);
  } else {
    console.warn(`⚠️  ${key}: NO configurado - ${desc}`);
    envOk = false;
  }
}

if (!envOk) {
  console.warn('\n🔐 Pasos para configurar variables en Vercel:');
  console.warn('  1. vercel env add FIREBASE_SERVICE_ACCOUNT');
  console.warn('  2. vercel env add CRON_SECRET');
  console.warn('  3. vercel env add LOG_LEVEL');
}

// ============================================================================
// 2. Verificar estructura de archivos
// ============================================================================
console.log('\n📁 Verificando estructura de archivos...');

const requiredFiles = [
  'lib/firestore.js',
  'lib/scraper.js',
  'lib/logger.js',
  'lib/constants.js',
  'lib/utils.js',
  'api/scraper-precios.js',
  'package.json'
];

let filesOk = true;
for (const file of requiredFiles) {
  const fullPath = path.join(projectRoot, file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file}`);
  } else {
    console.error(`❌ FALTA: ${file}`);
    filesOk = false;
  }
}

// ============================================================================
// 3. Validar sintaxis de imports
// ============================================================================
console.log('\n🔍 Validando imports (básico)...');

const keyFiles = [
  'lib/firestore.js',
  'lib/scraper.js',
  'api/scraper-precios.js'
];

for (const file of keyFiles) {
  const fullPath = path.join(projectRoot, file);
  const content = fs.readFileSync(fullPath, 'utf-8');

  if (content.includes('import ') && content.includes('from ')) {
    console.log(`✅ ${file}: imports correctos`);
  } else {
    console.warn(`⚠️  ${file}: revisar imports`);
  }
}

// ============================================================================
// 4. Sugerencias
// ============================================================================
console.log('\n💡 Próximos pasos:');
console.log('  1. npm install                 # Instalar dependencias');
console.log('  2. npm run dev                 # Desarrollo local');
console.log('  3. npm run test:scraper        # Test del scraper');
console.log('  4. npx vercel --prod           # Deploy a producción');

console.log('\n📚 Para más info: ver MEJORAS_IMPLEMENTADAS.md\n');

if (filesOk && envOk) {
  console.log('✅ Setup completado correctamente!\n');
  process.exit(0);
} else {
  console.log('⚠️  Setup con advertencias - revisar arriba\n');
  process.exit(0);
}
