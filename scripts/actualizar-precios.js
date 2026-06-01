import axios from 'axios';
import { load } from 'cheerio';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Leer archivo actual de productos
function leerProductosActuales() {
  const filepath = path.join(__dirname, '..', 'api', 'productos-reales.json');
  try {
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data).productos || [];
  } catch (e) {
    console.warn('No se pudo leer archivo actual:', e.message);
    return [];
  }
}

// Guardar productos actualizados
function guardarProductos(productos) {
  const filepath = path.join(__dirname, '..', 'api', 'productos-reales.json');
  const data = {
    timestamp: new Date().toISOString(),
    productos: productos,
    instrucciones: "Archivo actualizado automáticamente a las 9 AM cada día"
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`✅ Guardado: ${productos.length} productos`);
}

// Scraper para Distri Sur Online
async function scrapearDistriSur() {
  try {
    console.log('📍 Actualizando Distri Sur Online...');
    const response = await axios.get('https://www.distrisuronline.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 8000
    });

    const $ = load(response.data);
    const productos = [];

    // Buscar elementos con precios
    $('[data-price], .price, .producto, article, .card, .item').each((i, elem) => {
      if (productos.length >= 8) return;

      const $elem = $(elem);
      
      // Extraer nombre
      let nombre = $elem.find('h2, h3, h4, .title, .name, a').first().text().trim();
      nombre = nombre.split('\n')[0].trim();
      
      // Extraer precio - buscar patrones de moneda
      let precio = 0;
      const fullText = $elem.text();
      
      // Intentar extraer precio de atributos data
      const dataPrice = $elem.attr('data-price') || $elem.find('[data-price]').attr('data-price');
      if (dataPrice) {
        precio = parseFloat(dataPrice);
      }
      
      // Si no, buscar en texto
      if (!precio) {
        const matches = fullText.match(/[\$]?\s*([\d.,]+)(?:\s*-\s*([\d.,]+))?/g);
        if (matches) {
          for (const match of matches) {
            const num = match.replace(/\$/g, '').trim().split('-')[0].replace(/\./g, '').replace(',', '.');
            const val = parseFloat(num);
            if (val > 50 && val < 999999) {
              precio = val;
              break;
            }
          }
        }
      }

      if (nombre && nombre.length > 5 && nombre.length < 150 && precio > 0) {
        productos.push({
          id: `dsu-${i}`,
          nombre: nombre.substring(0, 100),
          fuente: 'Distri Sur Online',
          precioActual: Math.round(precio),
          variacion: 0,
          ultimaAct: new Date().toISOString()
        });
      }
    });

    console.log(`✓ Distri Sur: ${productos.length} productos encontrados`);
    return productos;

  } catch (error) {
    console.error('❌ Error Distri Sur:', error.message);
    return [];
  }
}

// Scraper para Distribuidora Veracruz
async function scrapearVeracruz() {
  try {
    console.log('📍 Actualizando Distribuidora Veracruz...');
    const response = await axios.get('https://distribuidoraveracruz.tiendapropio.com/search', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 8000
    });

    const $ = load(response.data);
    const productos = [];

    $('[data-price], .price, .producto, article, .card, .item').each((i, elem) => {
      if (productos.length >= 8) return;

      const $elem = $(elem);
      
      let nombre = $elem.find('h2, h3, h4, .title, .name, a').first().text().trim();
      nombre = nombre.split('\n')[0].trim();
      
      let precio = 0;
      const fullText = $elem.text();
      
      const dataPrice = $elem.attr('data-price') || $elem.find('[data-price]').attr('data-price');
      if (dataPrice) {
        precio = parseFloat(dataPrice);
      }
      
      if (!precio) {
        const matches = fullText.match(/[\$]?\s*([\d.,]+)(?:\s*-\s*([\d.,]+))?/g);
        if (matches) {
          for (const match of matches) {
            const num = match.replace(/\$/g, '').trim().split('-')[0].replace(/\./g, '').replace(',', '.');
            const val = parseFloat(num);
            if (val > 50 && val < 999999) {
              precio = val;
              break;
            }
          }
        }
      }

      if (nombre && nombre.length > 5 && nombre.length < 150 && precio > 0) {
        productos.push({
          id: `ver-${i}`,
          nombre: nombre.substring(0, 100),
          fuente: 'Distribuidora Veracruz',
          precioActual: Math.round(precio),
          variacion: 0,
          ultimaAct: new Date().toISOString()
        });
      }
    });

    console.log(`✓ Veracruz: ${productos.length} productos encontrados`);
    return productos;

  } catch (error) {
    console.error('❌ Error Veracruz:', error.message);
    return [];
  }
}

// Main
async function main() {
  console.log('🕘 ACTUALIZADOR AUTOMÁTICO DE PRECIOS');
  console.log('====================================\n');

  const productosActuales = leerProductosActuales();
  console.log(`📊 Productos actuales: ${productosActuales.length}\n`);

  // Intentar scraper
  const [distrisur, veracruz] = await Promise.all([
    scrapearDistriSur(),
    scrapearVeracruz()
  ]);

  // Si obtenemos datos nuevos, usar esos
  if (distrisur.length > 0 || veracruz.length > 0) {
    const productosNuevos = [...distrisur, ...veracruz];
    console.log(`\n✅ Nuevos datos obtenidos: ${productosNuevos.length} productos`);
    
    if (productosNuevos.length > 0) {
      guardarProductos(productosNuevos);
    } else {
      console.log('⚠️ No se extrajeron productos nuevos, manteniendo actuales');
    }
  } else {
    console.log('\n⚠️ No se pudieron scrapear datos. Manteniendo productos anteriores.');
    if (productosActuales.length > 0) {
      // Actualizar timestamp pero mantener precios
      const productosConTimestamp = productosActuales.map(p => ({
        ...p,
        ultimaAct: new Date().toISOString()
      }));
      guardarProductos(productosConTimestamp);
    }
  }

  console.log('\n✅ Actualización completada');
}

main().catch(error => {
  console.error('❌ Error crítico:', error);
  process.exit(1);
});
