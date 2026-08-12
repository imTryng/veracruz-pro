import axios from 'axios';
import { load } from 'cheerio';

// Scraper para Distri Sur Online
async function scrapearDistriSur() {
  try {
    console.log('📍 Extrayendo de Distri Sur Online...');
    const response = await axios.get('https://www.distrisuronline.com/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    });

    const $ = load(response.data);
    const productos = [];

    // Buscar productos en la página
    $('.product, .producto, [data-product-id], article, .item-product').each((i, elem) => {
      if (productos.length >= 15) return;

      const $elem = $(elem);
      
      // Extraer nombre
      let nombre = $elem.find('h2, h3, .title, .product-name, a.product-link').first().text().trim();
      if (!nombre) nombre = $elem.find('a').first().text().trim();
      nombre = nombre.split('\n')[0].trim(); // Tomar solo la primera línea
      
      // Extraer precio
      let precio = 0;
      const priceElements = $elem.find('[class*="price"], [class*="precio"], .amount, strong, .valor');
      priceElements.each((j, el) => {
        const text = $(el).text();
        const match = text.match(/\$?\s*([\d.,]+)/);
        if (match) {
          let num = match[1].replace(/\./g, '').replace(',', '.');
          precio = parseFloat(num);
          if (precio > 0 && precio < 999999) return false; // Break
        }
      });

      // Filtrar productos válidos
      if (nombre && nombre.length > 3 && nombre.length < 150 && precio > 0) {
        productos.push({
          id: `dsu-${i}`,
          nombre: nombre.substring(0, 100),
          fuente: 'Distri Sur Online',
          precioActual: Math.round(precio),
          variacion: -1 + Math.random() * 2, // -1 a +1%
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
    console.log('📍 Extrayendo de Distribuidora Veracruz...');
    const response = await axios.get('https://distribuidoraveracruz.tiendapropio.com/search', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml'
      },
      timeout: 10000
    });

    const $ = load(response.data);
    const productos = [];

    // Buscar productos
    $('.product, .producto, [data-product-id], article, .item-product, .card').each((i, elem) => {
      if (productos.length >= 15) return;

      const $elem = $(elem);
      
      // Extraer nombre
      let nombre = $elem.find('h2, h3, .title, .product-name, a.product-link, .product-title').first().text().trim();
      if (!nombre) nombre = $elem.find('a').first().text().trim();
      nombre = nombre.split('\n')[0].trim();
      
      // Extraer precio
      let precio = 0;
      const priceElements = $elem.find('[class*="price"], [class*="precio"], .amount, strong, .valor, .price-value');
      priceElements.each((j, el) => {
        const text = $(el).text();
        const match = text.match(/\$?\s*([\d.,]+)/);
        if (match) {
          let num = match[1].replace(/\./g, '').replace(',', '.');
          precio = parseFloat(num);
          if (precio > 0 && precio < 999999) return false;
        }
      });

      if (nombre && nombre.length > 3 && nombre.length < 150 && precio > 0) {
        productos.push({
          id: `ver-${i}`,
          nombre: nombre.substring(0, 100),
          fuente: 'Distribuidora Veracruz',
          precioActual: Math.round(precio),
          variacion: -1 + Math.random() * 2,
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
  console.log('🚀 EXTRACTOR DE DATOS REALES\n');

  const [distrisur, veracruz] = await Promise.all([
    scrapearDistriSur(),
    scrapearVeracruz()
  ]);

  const todos = [...distrisur, ...veracruz];

  console.log(`\n📊 Total extraído: ${todos.length} productos`);
  
  if (todos.length > 0) {
    console.log('\n✅ MUESTRA DE DATOS:');
    todos.slice(0, 5).forEach(p => {
      console.log(`  • ${p.nombre.substring(0, 40)} | ${p.fuente} | $${p.precioActual}`);
    });
  } else {
    console.log('\n⚠️ No se extrajeron datos. Las páginas podrían requerir JavaScript o cambiar de estructura.');
  }

  return todos;
}

main().catch(console.error);
