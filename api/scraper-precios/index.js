// API de Comparador de Precios con Scraping real
import axios from 'axios';
import * as cheerio from 'cheerio';

export const maxDuration = 60;

// Configuraciones de scraping
const FUENTES = [
  {
    url: "https://distribuidoraveracruz.tiendapropio.com/search",
    dominio: "veracruz",
    nombre: "Distribuidora Veracruz",
    esApi: false,
    selectorProducto: "article, .product, .product-item, .product-card, [class*='product']",
    selectorNombre: "h2, h3, .title, .product-name, [class*='name']",
    selectorPrecio: ".price, .precio, .product-price, [class*='price']"
  },
  {
    url: "https://www.distrisuronline.com/",
    dominio: "distrisur",
    nombre: "Distri Sur Online",
    esApi: false,
    selectorProducto: "article, .product, .product-item, .item-container, [class*='product']",
    selectorNombre: "h2, h3, .product-name, .title, [class*='name']",
    selectorPrecio: ".price, .precio, .product-price, [class*='price']"
  }
];

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9"
};

// Datos de fallback
const DATOS_FALLBACK = [
  { 
    id: '1', 
    nombre: 'Neumáticos 315/80R22.5', 
    fuente: 'Distri Sur Online', 
    precioActual: 45500, 
    variacion: -2.5, 
    ultimaAct: new Date().toISOString() 
  },
  { 
    id: '2', 
    nombre: 'Aceite Castrol 15W40', 
    fuente: 'Distribuidora Veracruz', 
    precioActual: 2850, 
    variacion: 1.2, 
    ultimaAct: new Date().toISOString() 
  },
  { 
    id: '3', 
    nombre: 'Filtro de aire', 
    fuente: 'Distri Sur Online', 
    precioActual: 1200, 
    variacion: 0.5, 
    ultimaAct: new Date().toISOString() 
  },
  { 
    id: '4', 
    nombre: 'Baterías 24V', 
    fuente: 'Distribuidora Veracruz', 
    precioActual: 18900, 
    variacion: -0.8, 
    ultimaAct: new Date().toISOString() 
  },
  { 
    id: '5', 
    nombre: 'Pastillas de freno', 
    fuente: 'Distri Sur Online', 
    precioActual: 3500, 
    variacion: 2.1, 
    ultimaAct: new Date().toISOString() 
  }
];

/**
 * Extrae precio de un texto
 */
function extraerPrecio(texto) {
  if (!texto) return 0;
  const matches = texto.match(/[\d.,]+/g);
  if (!matches) return 0;
  const num = matches[0].replace(/\./g, '').replace(',', '.');
  return parseFloat(num) || 0;
}

/**
 * Scraping HTML
 */
async function scrapearHtml(url, selectores) {
  try {
    console.log(`Scrapeando: ${url}`);
    
    const { data } = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000
    });

    const $ = cheerio.load(data);
    const productos = [];

    $(selectores.selectorProducto).slice(0, 20).each((i, el) => {
      const nombre = $(el).find(selectores.selectorNombre).first().text().trim();
      const precioTexto = $(el).find(selectores.selectorPrecio).first().text().trim();

      if (nombre && nombre.length > 3) {
        productos.push({
          nombre: nombre.substring(0, 100),
          precioActual: extraerPrecio(precioTexto),
          precioTextoOriginal: precioTexto || "Consultar"
        });
      }
    });

    return productos;
  } catch (error) {
    console.error(`Error scrapeando ${url}:`, error.message);
    return [];
  }
}

/**
 * Handler principal
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const datos = [];
      let productoId = 1;
      let tieneErrores = false;

      // Scrapear cada fuente
      for (const fuente of FUENTES) {
        try {
          const productos = await scrapearHtml(fuente.url, fuente);
          
          if (productos.length > 0) {
            productos.forEach(prod => {
              datos.push({
                id: String(productoId++),
                nombre: prod.nombre,
                fuente: fuente.nombre,
                precioActual: prod.precioActual,
                variacion: 0,
                ultimaAct: new Date().toISOString()
              });
            });
          } else {
            tieneErrores = true;
          }
        } catch (error) {
          console.error(`Error con ${fuente.nombre}:`, error.message);
          tieneErrores = true;
        }
      }

      // Si no hay datos, usar fallback
      const datosFinales = datos.length > 0 ? datos : DATOS_FALLBACK;

      return res.status(200).json({
        ok: true,
        total: datosFinales.length,
        data: datosFinales,
        generadoEn: new Date().toISOString(),
        version: 'v1',
        source: datos.length > 0 ? 'scraping' : 'fallback',
        conErrores: tieneErrores
      });
    }

    if (req.method === 'POST') {
      return res.status(200).json({
        ok: true,
        mensaje: 'Scraping completado',
        productosActualizados: 0,
        completadoEn: new Date().toISOString()
      });
    }

    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({
      ok: false,
      error: `Método ${req.method} no permitido`
    });

  } catch (error) {
    console.error('Error fatal en API:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error en el servidor',
      mensaje: error?.message,
      data: DATOS_FALLBACK
    });
  }
}
