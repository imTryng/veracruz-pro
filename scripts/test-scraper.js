import { scrapeMultipleUrls } from '../lib/scraper.js';

const fuenteATestear = {
  url: "https://www.distrisuronline.com/response.php",
  dominio: "distrisur",
  esApi: true,
  apiMethod: "POST",
  apiBody: "action=getProducts&subcategory=53&page=1", 
  selectorProducto: "article, .product, .item, [class*='product']", 
  selectorNombre: "h1, h2, h3, .title",
  selectorPrecio: ".price, .precio"
};

async function probarScraper() {
  console.log(`Iniciando prueba de scraping (Vía API o HTML) en: ${fuenteATestear.url}`);
  
  try {
    const productos = await scrapeMultipleUrls(fuenteATestear);
    
    console.log(`\n¡Scraping completado! Se encontraron ${productos.length} productos.`);
    // Mostramos solo los primeros 3 para no ensuciar tanto la consola
    console.log("Primeros 3 Resultados obtenidos:");
    console.log(productos.slice(0, 3));
  } catch (error) {
    console.error("Error durante la prueba de scraping:", error);
  }
}

probarScraper();