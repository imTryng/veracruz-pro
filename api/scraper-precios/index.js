// API simple sin dependencias externas - solo devuelve datos

export const maxDuration = 60;

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

  try {
    // GET: Retornar datos de precios
    if (req.method === 'GET') {
      const datos = [
        { 
          id: '1', 
          nombre: 'Neumáticos 315/80R22.5', 
          fuente: 'Distrisur', 
          precioActual: 45500, 
          variacion: -2.5, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '2', 
          nombre: 'Aceite Castrol 15W40', 
          fuente: 'YPF', 
          precioActual: 2850, 
          variacion: 1.2, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '3', 
          nombre: 'Filtro de aire', 
          fuente: 'Discar', 
          precioActual: 1200, 
          variacion: 0.5, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '4', 
          nombre: 'Baterías 24V', 
          fuente: 'Ferretería Central', 
          precioActual: 18900, 
          variacion: -0.8, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '5', 
          nombre: 'Pastillas de freno', 
          fuente: 'Auto Parts Plus', 
          precioActual: 3500, 
          variacion: 2.1, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '6', 
          nombre: 'Correa de distribución', 
          fuente: 'Discar', 
          precioActual: 8900, 
          variacion: -1.3, 
          ultimaAct: new Date().toISOString() 
        },
        { 
          id: '7', 
          nombre: 'Gasolina Premium', 
          fuente: 'YPF', 
          precioActual: 285.50, 
          variacion: 3.2, 
          ultimaAct: new Date().toISOString() 
        },
      ];

      return res.status(200).json({
        ok: true,
        total: datos.length,
        data: datos,
        generadoEn: new Date().toISOString(),
        version: 'v1',
        source: 'demo'
      });
    }

    // POST: Simular scraping
    if (req.method === 'POST') {
      return res.status(200).json({
        ok: true,
        mensaje: 'Scraping simulado completado',
        productosActualizados: 7,
        completadoEn: new Date().toISOString()
      });
    }

    // Método no permitido
    res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
    return res.status(405).json({
      ok: false,
      error: `Método ${req.method} no permitido`
    });

  } catch (error) {
    console.error('Error en API:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error en el servidor',
      mensaje: error?.message
    });
  }
}
