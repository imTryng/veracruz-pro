#!/usr/bin/env node

/**
 * Script de debugging y validación
 * Ejecutar: node scripts/debug.js
 */

import { logger } from '../lib/logger.js';
import { isValidServiceAccount, isValidUrl } from '../lib/utils.js';
import { FUENTES_A_MONITOREAR, SCRAPER_CONFIG } from '../lib/constants.js';

console.log('🐛 DEBUGGING SCRIPT - Validación del Setup\n');

// ============================================================================
// 1. Verificar Firebase Service Account
// ============================================================================
console.log('📋 1. Verificando FIREBASE_SERVICE_ACCOUNT...');

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountStr) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT no está configurado');
  process.exit(1);
}

try {
  let parsed = serviceAccountStr;
  
  // Intentar decodificar de Base64
  if (parsed.startsWith('ey')) {
    parsed = Buffer.from(parsed, 'base64').toString('utf-8');
    console.log('✅ Decodificado desde Base64');
  } else {
    console.log('✅ Usando JSON directo (no Base64)');
  }

  const serviceAccount = JSON.parse(parsed);

  if (isValidServiceAccount(serviceAccount)) {
    console.log('✅ Estructura válida de Service Account');
    console.log(`   - project_id: ${serviceAccount.project_id}`);
    console.log(`   - client_email: ${serviceAccount.client_email}`);
    console.log(`   - private_key: ${serviceAccount.private_key.substring(0, 50)}...`);
  } else {
    console.error('❌ Estructura inválida de Service Account');
    console.log('   Campos requeridos:', {
      type: serviceAccount.type,
      project_id: !!serviceAccount.project_id,
      private_key: !!serviceAccount.private_key,
      client_email: !!serviceAccount.client_email
    });
  }
} catch (error) {
  console.error('❌ Error parseando FIREBASE_SERVICE_ACCOUNT:', error.message);
}

// ============================================================================
// 2. Verificar CRON_SECRET
// ============================================================================
console.log('\n🔐 2. Verificando CRON_SECRET...');

const cronSecret = process.env.CRON_SECRET;

if (!cronSecret) {
  console.error('❌ CRON_SECRET no está configurado');
} else if (cronSecret.length < 32) {
  console.warn(`⚠️  CRON_SECRET muy corto (${cronSecret.length} chars, se recomiendan 32+)`);
} else {
  console.log(`✅ CRON_SECRET válido (${cronSecret.length} caracteres)`);
}

// ============================================================================
// 3. Verificar Fuentes a Monitorear
// ============================================================================
console.log('\n📡 3. Verificando Fuentes a Monitorear...');

for (const fuente of FUENTES_A_MONITOREAR) {
  console.log(`\n  Fuente: ${fuente.nombre} (${fuente.dominio})`);
  console.log(`  URL: ${fuente.url}`);

  if (isValidUrl(fuente.url)) {
    console.log('  ✅ URL válida');
  } else {
    console.error('  ❌ URL inválida');
  }

  if (fuente.esApi) {
    console.log(`  ✅ Tipo: API (${fuente.apiMethod})`);
    console.log(`  Cuerpo: ${fuente.apiBody}`);
  } else {
    console.log('  ✅ Tipo: HTML');
    console.log(`  Selector producto: ${fuente.selectorProducto}`);
    console.log(`  Selector nombre: ${fuente.selectorNombre}`);
    console.log(`  Selector precio: ${fuente.selectorPrecio}`);
  }
}

// ============================================================================
// 4. Verificar Configuración de Scraper
// ============================================================================
console.log('\n⚙️  4. Verificando Configuración de Scraper...');

console.log(`  Timeout: ${SCRAPER_CONFIG.TIMEOUT}ms`);
console.log(`  Retries: ${SCRAPER_CONFIG.RETRIES}`);
console.log(`  User-Agent: ${SCRAPER_CONFIG.HEADERS['User-Agent'].substring(0, 50)}...`);

// ============================================================================
// 5. Verificar LOG_LEVEL
// ============================================================================
console.log('\n📊 5. Verificando LOG_LEVEL...');

const logLevel = process.env.LOG_LEVEL || 'info';
console.log(`  LOG_LEVEL: ${logLevel}`);
console.log('  Niveles: debug < info < warn < error');

// Test logger
logger.debug('Esto es un mensaje DEBUG (visible si LOG_LEVEL=debug)');
logger.info('Esto es un mensaje INFO');
logger.warn('Esto es un mensaje WARN');
logger.error('Esto es un mensaje ERROR');

// ============================================================================
// 6. Resumen
// ============================================================================
console.log('\n✅ DEBUG COMPLETADO\n');
console.log('📌 Notas:');
console.log('  - Para production, usar Base64 para FIREBASE_SERVICE_ACCOUNT');
console.log('  - CRON_SECRET debe ser único y aleatorio (32+ caracteres)');
console.log('  - LOG_LEVEL=debug da salida muy verbose (usar solo en desarrollo)');
console.log('  - Revisar logs en Vercel: vercel logs --follow\n');
