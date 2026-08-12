/**
 * Utilidades compartidas y helpers
 */

/**
 * Valida que un string sea una URL válida
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Valida que un objeto sea un serviceAccount válido de Firebase
 */
export function isValidServiceAccount(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    obj.type === 'service_account' &&
    obj.project_id &&
    obj.private_key &&
    obj.client_email &&
    obj.private_key.includes('-----BEGIN') &&
    obj.private_key.includes('-----END')
  );
}

/**
 * Sanitiza un string para usar como ID de documento en Firestore
 */
export function sanitizeFirestoreId(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 255); // Límite de Firestore
}

/**
 * Extrae un número de un string (ej: "$1.234,50" -> 1234.50)
 */
export function extractPrice(priceString) {
  if (!priceString || typeof priceString !== 'string') return 0;

  let cleaned = priceString.replace(/[^0-9,.]/g, '');

  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    cleaned = cleaned.replace(',', '.');
  }

  const price = parseFloat(cleaned);
  return isNaN(price) ? 0 : price;
}

/**
 * Calcula la variación porcentual entre dos precios
 */
export function calculatePercentageChange(newPrice, oldPrice) {
  if (oldPrice === 0) return 0;
  return parseFloat((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2));
}

/**
 * Genera un delay aleatorio para retries exponenciales
 */
export function exponentialBackoff(attempt, baseDelay = 1000) {
  const delay = baseDelay * Math.pow(2, attempt);
  return delay + Math.random() * 1000; // Agregar jitter
}

/**
 * Reintentar una función async con backoff exponencial
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = exponentialBackoff(attempt, baseDelay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
