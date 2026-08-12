import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from './logger.js';
import { isValidServiceAccount, sanitizeFirestoreId, calculatePercentageChange } from './utils.js';
import { FIRESTORE_CONFIG } from './constants.js';

let db;

function getDb() {
  if (!getApps().length) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      const error = 'FIREBASE_SERVICE_ACCOUNT no está configurado en variables de entorno';
      logger.error(error);
      throw new Error(error);
    }

    try {
      let serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;

      logger.debug('🔐 FIREBASE_SERVICE_ACCOUNT recibido', {
        length: serviceAccountStr.length,
        starts: serviceAccountStr.substring(0, 20)
      });

      // Intentar siempre como Base64 primero
      try {
        const decoded = Buffer.from(serviceAccountStr, 'base64').toString('utf-8');
        JSON.parse(decoded); // valida que sea JSON antes de aceptarlo
        serviceAccountStr = decoded;
        logger.debug('✅ FIREBASE_SERVICE_ACCOUNT decodificado de Base64');
      } catch (e) {
        logger.debug('📝 No es Base64 válido, usando string directo');
      }

      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountStr);
        logger.debug('✅ JSON parseado correctamente');
      } catch (parseError) {
        logger.error('❌ Error parseando JSON de FIREBASE_SERVICE_ACCOUNT', parseError);
        throw new Error(`JSON inválido en FIREBASE_SERVICE_ACCOUNT: ${parseError.message}`);
      }

      // Validación estructura
      if (!isValidServiceAccount(serviceAccount)) {
        const missing = [];
        if (!serviceAccount.type) missing.push('type');
        if (!serviceAccount.project_id) missing.push('project_id');
        if (!serviceAccount.private_key) missing.push('private_key');
        if (!serviceAccount.client_email) missing.push('client_email');

        const error = `Service Account inválido. Campos faltantes: ${missing.join(', ')}`;
        logger.error(error);
        throw new Error(error);
      }

      // Manejo de private_key — reemplazar \n literales por saltos reales
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

        if (!serviceAccount.private_key.includes('-----BEGIN') || !serviceAccount.private_key.includes('-----END')) {
          const error = 'Private key sin marcadores PEM válidos (falta BEGIN o END)';
          logger.error(error);
          throw new Error(error);
        }

        logger.debug('✅ Private key tiene formato PEM válido');
      }

      // Inicializar Firebase
      initializeApp({
        credential: cert(serviceAccount)
      });

      logger.info('✅ Firebase Admin SDK inicializado correctamente', {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email
      });

    } catch (error) {
      logger.error('❌ Error crítico inicializando Firebase', error);
      throw new Error(`Error de configuración Firebase: ${error.message}`);
    }
  }

  if (!db) {
    db = getFirestore();
  }

  return db;
}

export async function guardarPreciosEnFirestore(productos, dominio) {
  if (!productos || productos.length === 0) {
    logger.warn('No hay productos para guardar', { dominio });
    return;
  }

  if (!dominio || typeof dominio !== 'string') {
    throw new Error('dominio inválido');
  }

  try {
    const database = getDb();
    const batch = database.batch();
    const coleccionRef = database.collection(FIRESTORE_CONFIG.COLLECTION);
    const fechaActual = new Date().toISOString();
    let docsActualizados = 0;

    for (const prod of productos) {
      if (!prod.nombre || prod.precioActual === undefined) {
        logger.warn('Producto inválido, ignorando', { prod });
        continue;
      }

      const idUnico = sanitizeFirestoreId(`${dominio}__${prod.nombre}`);
      const docRef = coleccionRef.doc(idUnico);

      try {
        const docSnap = await docRef.get();
        let historial = [];
        let precioAnterior = prod.precioActual;

        if (docSnap.exists) {
          const datosViejos = docSnap.data();
          historial = datosViejos.historial || [];
          precioAnterior = datosViejos.precioActual || prod.precioActual;
        }

        const variacion = prod.precioActual - precioAnterior;
        const variacionPct = calculatePercentageChange(prod.precioActual, precioAnterior);

        historial.unshift({ fecha: fechaActual, precio: prod.precioActual });
        if (historial.length > FIRESTORE_CONFIG.HISTORIAL_MAX) {
          historial = historial.slice(0, FIRESTORE_CONFIG.HISTORIAL_MAX);
        }

        batch.set(
          docRef,
          {
            nombre: prod.nombre.trim(),
            dominio,
            precioActual: prod.precioActual,
            precioAnterior,
            variacion: parseFloat(variacion.toFixed(2)),
            variacionPct,
            ultimaActualizacion: fechaActual,
            historial
          },
          { merge: true }
        );

        docsActualizados++;
      } catch (error) {
        logger.warn(`Error procesando producto ${prod.nombre}`, error);
      }
    }

    if (docsActualizados > 0) {
      await batch.commit();
      logger.info('✅ Precios guardados en Firestore', { dominio, docsActualizados });
    }
  } catch (error) {
    logger.error('❌ Error guardando precios en Firestore', error);
    throw error;
  }
}

export async function obtenerPreciosMonitoreados() {
  try {
    const database = getDb();
    const snapshot = await database
      .collection(FIRESTORE_CONFIG.COLLECTION)
      .orderBy('ultimaActualizacion', 'desc')
      .get();

    const datos = [];
    snapshot.forEach(doc => {
      datos.push({
        id: doc.id,
        ...doc.data()
      });
    });

    logger.info('✅ Precios obtenidos de Firestore', { total: datos.length });
    return datos;
  } catch (error) {
    logger.error('❌ Error obteniendo precios de Firestore', error);
    throw error;
  }
}