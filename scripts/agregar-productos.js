import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function pregunta(texto) {
  return new Promise(resolve => {
    rl.question(texto, resolve);
  });
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  📝 AGREGADOR DE PRODUCTOS REALES        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  const productos = [];

  console.log('📖 INSTRUCCIONES:');
  console.log('1. Ve a: https://www.distrisuronline.com/');
  console.log('2. Ve a: https://distribuidoraveracruz.tiendapropio.com/');
  console.log('3. Copia productos y sus precios');
  console.log('4. Pégalos aquí\n');

  let agregarMas = true;

  while (agregarMas) {
    console.log(`\n--- PRODUCTO ${productos.length + 1} ---`);
    
    const nombre = await pregunta('🔹 Nombre del producto: ');
    if (!nombre.trim()) {
      console.log('⚠️  Nombre requerido');
      continue;
    }

    const precioStr = await pregunta('💰 Precio actual ($): ');
    const precio = parseFloat(precioStr);
    if (isNaN(precio) || precio <= 0) {
      console.log('⚠️  Precio inválido');
      continue;
    }

    const fuente = await pregunta('📍 Fuente (1=Distri Sur, 2=Veracruz): ');
    const fuenteNombre = fuente === '1' 
      ? 'Distri Sur Online' 
      : 'Distribuidora Veracruz';

    productos.push({
      id: String(productos.length + 1),
      nombre: nombre.trim().substring(0, 100),
      fuente: fuenteNombre,
      precioActual: Math.round(precio),
      variacion: 0,
      ultimaAct: new Date().toISOString()
    });

    console.log(`✅ Agregado: ${nombre} - $${precio} (${fuenteNombre})`);

    const continuar = await pregunta('\n¿Agregar otro? (s/n): ');
    agregarMas = continuar.toLowerCase() === 's' || continuar.toLowerCase() === 'yes';
  }

  rl.close();

  if (productos.length === 0) {
    console.log('\n⚠️  No se agregó ningún producto');
    return;
  }

  // Guardar archivo
  const filepath = path.join(__dirname, '..', 'api', 'productos-reales.json');
  const datosGuardar = {
    timestamp: new Date().toISOString(),
    total: productos.length,
    productos: productos
  };

  fs.writeFileSync(filepath, JSON.stringify(datosGuardar, null, 2));

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║  ✅ DATOS GUARDADOS EXITOSAMENTE         ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`\n📊 Total de productos: ${productos.length}`);
  console.log(`📁 Archivo: ${filepath}`);
  console.log('\n🚀 Próximos pasos:');
  console.log('   1. git add api/productos-reales.json');
  console.log('   2. git commit -m "Actualizar productos reales"');
  console.log('   3. git push');
  console.log('   4. Espera 2-3 minutos a Vercel');
  console.log('   5. Recarga la app - ¡Los precios se actualizarán!\n');
}

main().catch(console.error);
