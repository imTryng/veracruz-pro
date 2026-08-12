#!/usr/bin/env node

/**
 * Script para agregar FIREBASE_SERVICE_ACCOUNT a Vercel
 * Uso: node scripts/add-to-vercel.js
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🚀 Agregando FIREBASE_SERVICE_ACCOUNT a Vercel\n');

const prepDir = path.join(process.cwd(), '.firebase-prep');
const base64File = path.join(prepDir, 'firebase-base64.txt');
const jsonFile = path.join(prepDir, 'firebase-json.txt');

// Verificar que existan los archivos preparados
if (!fs.existsSync(base64File) && !fs.existsSync(jsonFile)) {
  console.error('❌ Primero debes ejecutar:');
  console.error('   node scripts/prepare-firebase.js "ruta/a/firebase-key.json"');
  process.exit(1);
}

// Preferir Base64
const valueToUse = fs.existsSync(base64File) 
  ? fs.readFileSync(base64File, 'utf-8').trim()
  : fs.readFileSync(jsonFile, 'utf-8').trim();

console.log('📋 Información a agregar:');
console.log(`   Variable: FIREBASE_SERVICE_ACCOUNT`);
console.log(`   Longitud: ${valueToUse.length} caracteres`);
console.log(`   Formato: ${valueToUse.startsWith('ey') ? 'Base64 ✅' : 'JSON'}`);
console.log();

try {
  // Agregar a Vercel
  console.log('⏳ Agregando a Vercel...');
  
  // Usar echo para piping (Windows compatible con PowerShell)
  const cmd = process.platform === 'win32'
    ? `powershell -Command "Write-Output '${valueToUse}' | npx vercel env add FIREBASE_SERVICE_ACCOUNT --sensitive"`
    : `echo '${valueToUse}' | npx vercel env add FIREBASE_SERVICE_ACCOUNT --sensitive`;
  
  execSync(cmd, { stdio: 'inherit' });
  
  console.log('✅ Variable agregada a Vercel');
  
} catch (error) {
  console.error('❌ Error agregando a Vercel');
  console.error('💡 Alternativa: Cópiala manualmente desde:');
  console.error(`   cat ${path.relative(process.cwd(), base64File)}`);
  console.error('   O desde: .firebase-prep/firebase-base64.txt');
  process.exit(1);
}

console.log();
console.log('🚀 Próximo paso: npx vercel --prod');
