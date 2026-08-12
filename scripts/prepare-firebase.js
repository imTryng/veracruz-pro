#!/usr/bin/env node

/**
 * Script para preparar Firebase Service Account
 * Uso: node scripts/prepare-firebase.js "ruta/al/firebase-key.json"
 */

import fs from 'fs';
import path from 'path';

console.log('🔐 Firebase Service Account Prep Tool\n');

// Obtener ruta del archivo desde argumentos
const argPath = process.argv[2];

if (!argPath) {
  console.error('❌ USO: node scripts/prepare-firebase.js "C:\\ruta\\al\\firebase-key.json"');
  console.error('\nEjemplo:');
  console.error('  node scripts/prepare-firebase.js "C:\\Users\\tobia\\Downloads\\firebase-key.json"');
  process.exit(1);
}

// Resolver ruta absoluta
const jsonPath = path.resolve(argPath);

// Verificar que el archivo existe
if (!fs.existsSync(jsonPath)) {
  console.error(`❌ Archivo no encontrado: ${jsonPath}`);
  process.exit(1);
}

try {
  // Leer el archivo
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  
  // Parsear para validar que es JSON válido
  const parsed = JSON.parse(jsonContent);
  
  console.log('✅ Archivo JSON válido\n');
  console.log('📋 Información del proyecto:');
  console.log(`   Project ID: ${parsed.project_id}`);
  console.log(`   Client Email: ${parsed.client_email}`);
  console.log(`   Private Key: ${parsed.private_key.substring(0, 50)}...\n`);
  
  // Opción 1: JSON en una línea (para Vercel)
  const jsonOneLine = JSON.stringify(parsed);
  
  // Opción 2: Base64 (más seguro)
  const base64 = Buffer.from(jsonOneLine).toString('base64');
  
  console.log('📝 OPCIÓN 1: JSON en una línea');
  console.log('─'.repeat(80));
  console.log(jsonOneLine);
  console.log();
  
  console.log('📝 OPCIÓN 2: Base64 (RECOMENDADO - más seguro)');
  console.log('─'.repeat(80));
  console.log(base64);
  console.log();
  
  console.log('📋 INSTRUCCIONES:');
  console.log('1. Copia el valor que prefieras (Opción 1 u Opción 2)');
  console.log('2. Ve a https://vercel.com → Tu Proyecto → Settings → Environment Variables');
  console.log('3. Agrega:');
  console.log('   Name: FIREBASE_SERVICE_ACCOUNT');
  console.log('   Value: Pega lo que copiaste');
  console.log('   Environments: Production + Preview + Development');
  console.log('4. Haz deploy: npx vercel --prod');
  console.log();
  
  // Guardar en archivos temporales para fácil acceso
  const outputDir = path.join(process.cwd(), '.firebase-prep');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(outputDir, 'firebase-json.txt'), jsonOneLine);
  fs.writeFileSync(path.join(outputDir, 'firebase-base64.txt'), base64);
  
  console.log(`✅ Valores guardados en: .firebase-prep/`);
  console.log('   - firebase-json.txt (JSON en una línea)');
  console.log('   - firebase-base64.txt (Base64)');
  console.log();
  
} catch (error) {
  if (error instanceof SyntaxError) {
    console.error('❌ El archivo no es JSON válido');
    console.error(`Error: ${error.message}`);
  } else {
    console.error(`❌ Error: ${error.message}`);
  }
  process.exit(1);
}
