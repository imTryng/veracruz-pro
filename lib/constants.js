/**
 * Constantes compartidas entre frontend y backend
 * NOTA: Solo incluir valores públicos y configurables
 */

export const FUENTES_A_MONITOREAR = [
  {
    url: "https://distribuidoraveracruz.tiendapropio.com/search",
    dominio: "veracruz",
    nombre: "Distribuidora Veracruz",
    esApi: false,
    selectorProducto: "article, .product, .item, .product-item, .product-card, [class*='product']",
    selectorNombre: "h1, h2, h3, .title, .product-name, .name",
    selectorPrecio: ".price, .precio, .product-price, .price-display"
  },
  {
    url: "https://www.distrisuronline.com/response.php",
    dominio: "distrisur",
    nombre: "Distri Sur Online",
    esApi: true,
    apiMethod: "POST",
    apiBody: "action=getProducts&subcategory=53&page=1",
    selectorProducto: "article, .product, .item, [class*='product']",
    selectorNombre: "h1, h2, h3, .title",
    selectorPrecio: ".price, .precio"
  }
];

export const SCRAPER_CONFIG = {
  TIMEOUT: parseInt(process.env.SCRAPER_TIMEOUT || '10000', 10),
  RETRIES: parseInt(process.env.SCRAPER_RETRIES || '2', 10),
  HEADERS: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "X-Requested-With": "XMLHttpRequest"
  }
};

export const FIRESTORE_CONFIG = {
  COLLECTION: 'precios_proveedores',
  HISTORIAL_MAX: 90,
  BATCH_SIZE: 100
};

export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

export const LOG_LEVEL_MAP = {
  'debug': LOG_LEVELS.DEBUG,
  'info': LOG_LEVELS.INFO,
  'warn': LOG_LEVELS.WARN,
  'error': LOG_LEVELS.ERROR
};
