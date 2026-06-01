import { scrapeMultipleUrls } from '../../lib/scraper.js';
import { guardarPreciosEnFirestore, obtenerPreciosMonitoreados } from '../../lib/firestore.js';
import { logger } from '../../lib/logger.js';
import { FUENTES_A_MONITOREAR } from '../../lib/constants.js';

/**
 * Rate limiting simple en memoria (en producción usar Redis/Database)
 * Estructura: { 'ip': { count: N, resetTime: timestamp } }
 */
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Valida el rate limit por IP
 */
function checkRateLimit(clientIp) {
  const now = Date.now();
  const record = rateLimitStore.get(clientIp);

  if (!record || now > record.resetTime) {
    // Crear o resetear el registro
    rateLimitStore.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Obtiene la IP del cliente, considerando proxies (X-Forwarded-For)
 */
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * Valida el token Bearer para operaciones protegidas (POST)
 */
function validateCronSecret(authHeader) {
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret) {
    logger.error('⚠️  CRON_SECRET no configurado - POST requests serán rechazados');
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const [scheme, token] = authHeader.split(' ');

  // Validar formato Bearer
  if (scheme !== 'Bearer' || !token) {
    return false;
  }

  // Usar comparación timing-safe para evitar timing attacks
  return timingSafeCompare(token, expectedSecret);
}

/**
 * Comparación de strings timing-safe
 */
function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Configuración de Vercel (Hobby plan = max 10s. Pro plan = max 60s).
 */
export const maxDuration = 60;

/**
 * API Serverless: GET para obtener precios, POST para triggerear scraping
 */
export default async function handler(req, res) {
  // Configurar CORS y headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const clientIp = getClientIp(req);
  const { method } = req;

  logger.debug(`📨 ${method} request`, { clientIp });

  try {
    // ─── GET: Obtener precios monitoreados ───────────────────────────────────
    if (method === 'GET') {
      // Rate limit para lecturas (más permisivo)
      if (!checkRateLimit(clientIp)) {
        logger.warn('⏳ Rate limit excedido (GET)', { clientIp });
        return res.status(429).json({
          ok: false,
          error: 'Demasiadas solicitudes. Reintenta en 1 minuto.',
          retryAfter: 60
        });
      }

      try {
        const data = await obtenerPreciosMonitoreados();

        return res.status(200).json({
          ok: true,
          total: data.length,
          data,
          generadoEn: new Date().toISOString(),
          version: 'v1',
          source: 'firestore'
        });
      } catch (firebaseError) {
        logger.error('❌ Error obteniendo datos de Firebase', firebaseError);
        return res.status(500).json({
          ok: false,
          error: 'Error conectando a la base de datos Firestore',
          detalles: firebaseError?.message || String(firebaseError),
          stack: firebaseError?.stack
        });
      }
    }

    // ─── POST: Triggerear scraping (requiere autenticación) ──────────────────
    if (method === 'POST') {
      // Validar autenticación
      const authHeader = req.headers?.authorization;

      if (!validateCronSecret(authHeader)) {
        logger.warn('🚫 Intento de acceso no autorizado (POST)', { clientIp });
        return res.status(401).json({
          ok: false,
          error: 'No autorizado. Token inválido o ausente.'
        });
      }

      // Rate limit para escrituras (más restrictivo)
      if (!checkRateLimit(`${clientIp}-write`)) {
        logger.warn('⏳ Rate limit excedido (POST)', { clientIp });
        return res.status(429).json({
          ok: false,
          error: 'Scraping en progreso. Reintenta más tarde.'
        });
      }

      logger.info('🔄 Iniciando scraping de fuentes', { fuentes: FUENTES_A_MONITOREAR.length });

      let totalProcesados = 0;
      const resultados = [];

      // Procesar cada fuente
      for (const fuente of FUENTES_A_MONITOREAR) {
        try {
          logger.debug(`📡 Scrapeando ${fuente.nombre}`, { dominio: fuente.dominio });

          const productos = await scrapeMultipleUrls(fuente);

          if (productos.length > 0) {
            await guardarPreciosEnFirestore(productos, fuente.dominio);
            totalProcesados += productos.length;
            resultados.push({
              dominio: fuente.dominio,
              nombre: fuente.nombre,
              productosScraped: productos.length,
              status: 'ok'
            });

            logger.info(`✅ ${fuente.nombre} completado`, {
              dominio: fuente.dominio,
              productos: productos.length
            });
          } else {
            resultados.push({
              dominio: fuente.dominio,
              nombre: fuente.nombre,
              productosScraped: 0,
              status: 'sin_datos'
            });

            logger.warn(`⚠️  Sin productos scraped`, { dominio: fuente.dominio });
          }
        } catch (error) {
          logger.error(`❌ Error en fuente ${fuente.nombre}`, error);

          resultados.push({
            dominio: fuente.dominio,
            nombre: fuente.nombre,
            status: 'error',
            error: error?.message || String(error)
          });
          // Continuar con la siguiente fuente
        }
      }

      logger.info('✅ Scraping completado', { totalProcesados, fuentes: resultados.length });

      return res.status(200).json({
        ok: true,
        mensaje: 'Scraping completado con éxito',
        productosActualizados: totalProcesados,
        detallesPorFuente: resultados,
        completadoEn: new Date().toISOString()
      });
    }

    // ─── Método no permitido ───────────────────────────────────────────────
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({
      ok: false,
      error: `Método ${method} no permitido`,
      permitidos: ['GET', 'POST']
    });
  } catch (error) {
    logger.error('💥 Error no controlado en API', error);

    // Devolver SIEMPRE el error explícito en la respuesta JSON (incluso en producción) para poder debugear
    return res.status(500).json({
      ok: false,
      error: 'Error interno del servidor (Crash)',
      timestamp: new Date().toISOString(),
      errorType: error?.name || 'UnknownError',
      errorMessage: error?.message || String(error),
      stack: error?.stack,
      hint: error?.message?.includes('FIREBASE_SERVICE_ACCOUNT')
        ? '⚠️ FIREBASE_SERVICE_ACCOUNT no está configurado correctamente en Vercel'
        : error?.message?.includes('private_key')
        ? '⚠️ La clave privada de Firebase tiene un formato inválido'
        : error?.message?.includes('JSON')
        ? '⚠️ El JSON de Firebase tiene un formato incorrecto'
        : '⚠️ Posible problema de Timeout o conexión de red.'
    });
  }
}
