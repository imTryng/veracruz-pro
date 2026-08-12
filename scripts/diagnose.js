#!/usr/bin/env node

/**
 * Diagnóstico rápido para Firebase en Vercel
 * Ejecutar: node scripts/diagnose.js
 */

import { execSync } from 'child_process';

console.log('🔍 DIAGNÓSTICO DE FIREBASE EN VERCEL\n');

console.log('═'.repeat(80));
console.log('1️⃣  Verificando variables en Vercel...');
console.log('═'.repeat(80));

try {
  const output = execSync('npx vercel env ls', { encoding: 'utf-8' });
  
  // Buscar FIREBASE_SERVICE_ACCOUNT
  if (output.includes('FIREBASE_SERVICE_ACCOUNT')) {
    console.log('✅ FIREBASE_SERVICE_ACCOUNT está configurada\n');
    
    // Verificar en qué ambientes está
    if (output.includes('Production')) {
      console.log('  ✅ En ambiente: Production');
    } else {
      console.log('  ❌ NO está en ambiente: Production');
    }
    
    if (output.includes('Preview')) {
      console.log('  ✅ En ambiente: Preview');
    } else {
      console.log('  ❌ NO está en ambiente: Preview');
    }
    
    if (output.includes('Development')) {
      console.log('  ✅ En ambiente: Development');
    } else {
      console.log('  ⚠️  NO está en ambiente: Development (normal, no es crítico)');
    }
  } else {
    console.log('❌ FIREBASE_SERVICE_ACCOUNT NO está configurada!\n');
    console.log('⚠️  Acciones requeridas:');
    console.log('  1. Ve a https://vercel.com → Tu Proyecto → Settings → Environment Variables');
    console.log('  2. Busca si existe FIREBASE_SERVICE_ACCOUNT');
    console.log('  3. Si no existe, agrégala');
    console.log('  4. Haz deploy nuevamente: npx vercel --prod');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ Error verificando variables de Vercel');
  process.exit(1);
}

console.log('\n' + '═'.repeat(80));
console.log('2️⃣  Verificando logs de Vercel...');
console.log('═'.repeat(80) + '\n');

try {
  const logs = execSync('npx vercel logs --limit 20', { encoding: 'utf-8' });
  
  if (logs.includes('No logs found')) {
    console.log('⚠️  Sin logs aún. Intenta acceder a la web primero:');
    console.log('   https://veracruz-distribuidora.vercel.app');
    console.log('   Luego vuelve a correr este script.\n');
  } else {
    console.log(logs);
  }
} catch (error) {
  console.error('Nota: No hay logs disponibles aún\n');
}

console.log('═'.repeat(80));
console.log('3️⃣  Pasos de solución');
console.log('═'.repeat(80));

console.log(`
Si aún ves HTTP 500, intenta esto:

A) Verificar el archivo Firebase JSON:
   1. Ve a Firebase Console: https://console.firebase.google.com
   2. Tu Proyecto → Settings → Service Accounts
   3. Descarga una clave nueva
   4. Cópiala a Base64:
      node scripts/prepare-firebase.js "ruta/al/archivo.json"
   5. Reemplaza la variable en Vercel Dashboard

B) Si el problema persiste:
   1. npx vercel redeploy --prod (redeploy limpio)
   2. Espera 2-3 minutos
   3. Intenta nuevamente

C) Para debug detallado:
   1. npx vercel env add LOG_LEVEL
   2. Valor: debug
   3. Redeploy
   4. Revisa logs: npx vercel logs --follow
`);

console.log('═'.repeat(80) + '\n');
