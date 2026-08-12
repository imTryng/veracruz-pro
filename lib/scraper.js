import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from './logger.js';
import { SCRAPER_CONFIG } from './constants.js';
import { extractPrice, retryWithBackoff, isValidUrl } from './utils.js';

/**
 * Realiza scraping de una fuente (HTML o API JSON)
 * @param {Object} config - Configuración con url, selectores, etc.
 * @returns {Array} Lista de productos extraídos
 */
export async function scrapeMultipleUrls(config) {
  if (!config || !config.url) {
    throw new Error('Configuración inválida: falta URL');
  }

  if (!isValidUrl(config.url)) {
    throw new Error(`URL inválida: ${config.url}`);
  }

  const { url, esApi, apiMethod, apiBody, selectorProducto, selectorNombre, selectorPrecio } = config;

  try {
    // Reintentar con backoff exponencial
    return await retryWithBackoff(
      () => esApi && apiMethod === 'POST'
        ? scrapeApiJson(url, apiBody)
        : scrapeHtmlGeneric(url, selectorProducto, selectorNombre, selectorPrecio),
      SCRAPER_CONFIG.RETRIES,
      1000
    );
  } catch (error) {
    logger.error(`Error scrapeando ${url}`, error);
    return []; // Devolver array vacío para no interrumpir el proceso
  }
}

/**
 * Scraping para APIs que devuelven JSON
 */
async function scrapeApiJson(url, apiBody) {
  logger.debug(`Scrapeando API (POST)`, { url });

  const { data } = await axios.post(url, apiBody, {
    headers: SCRAPER_CONFIG.HEADERS,
    timeout: SCRAPER_CONFIG.TIMEOUT
  });

  const jsonData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
  const productosExtraidos = [];

  if (jsonData && Array.isArray(jsonData.lsProductos)) {
    jsonData.lsProductos.forEach(prod => {
      if (prod.descripcion && prod.precioActual1) {
        productosExtraidos.push({
          nombre: prod.descripcion.trim(),
          precioActual: extractPrice(String(prod.precioActual1)),
          precioTextoOriginal: `$${prod.precioActual1}`
        });
      }
    });
  }

  logger.info(`API scraping completado`, { url, productosCount: productosExtraidos.length });
  return productosExtraidos;
}

/**
 * Scraping HTML genérico con selectores CSS
 */
async function scrapeHtmlGeneric(url, selectorProducto, selectorNombre, selectorPrecio) {
  logger.debug(`Scrapeando HTML (GET)`, { url });

  const { data } = await axios.get(url, {
    headers: SCRAPER_CONFIG.HEADERS,
    timeout: SCRAPER_CONFIG.TIMEOUT
  });

  const $ = cheerio.load(data);
  const productosExtraidos = [];

  // Selectores con fallbacks
  const selectorProd = selectorProducto || "article, .product, .item, [class*='product'], [class*='item']";
  const selectorNom = selectorNombre || "h1, h2, h3, .title, [class*='name']";
  const selectorPrec = selectorPrecio || ".price, .precio, [class*='price']";

  $(selectorProd).each((i, el) => {
    const nombre = $(el).find(selectorNom).first().text().trim();
    const precioTexto = $(el).find(selectorPrec).first().text().trim();

    if (nombre && nombre.length > 0) {
      const precioActual = precioTexto ? extractPrice(precioTexto) : 0;

      productosExtraidos.push({
        nombre,
        precioActual,
        precioTextoOriginal: precioTexto || "Consultar"
      });
    }
  });

  logger.info(`HTML scraping completado`, { url, productosCount: productosExtraidos.length });
  return productosExtraidos;
}