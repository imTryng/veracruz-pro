// Configuración de notificaciones por email
export const EMAIL_CONFIG = {
  // API key de SendGrid/Mailgun/Resend - actualizar con tu clave
  PROVIDER: 'sendgrid', // opciones: 'sendgrid', 'mailgun', 'resend', 'firebase'
  API_KEY: process.env.REACT_APP_EMAIL_API_KEY || '', // Configurar en .env
  FROM_EMAIL: 'notificaciones@veracruzflota.com',
  
  // Umbrales para notificaciones
  THRESHOLDS: {
    EXPENSE_ALERT: 10000, // Alerta si gasto > 10000
    DAILY_DIGEST: true,    // Enviar resumen diario
    WEEKLY_REPORT: true    // Enviar reporte semanal
  }
};

// Plantillas de email
export const EMAIL_TEMPLATES = {
  EXPENSE_ALERT: {
    subject: 'Alerta: Gasto importante registrado',
    template: 'expense-alert'
  },
  DAILY_DIGEST: {
    subject: 'Resumen diario de gastos - Veracruz Pro',
    template: 'daily-digest'
  },
  WEEKLY_REPORT: {
    subject: 'Reporte semanal de la flota - Veracruz Pro',
    template: 'weekly-report'
  },
  USER_CREATED: {
    subject: 'Tu cuenta ha sido creada en Veracruz Pro',
    template: 'user-created'
  }
};

// Función para enviar emails (integración básica)
export async function sendNotificationEmail(email, type, data = {}) {
  try {
    // Aquí implementarías la integración real con tu proveedor de email
    // Por ahora, guardamos en Firestore para procesar con Cloud Functions
    
    const payload = {
      to: email,
      type,
      data,
      timestamp: new Date().toISOString(),
      sent: false
    };
    
    console.log('Email a enviar:', payload);
    
    // Retornar éxito (la implementación real verificaría con API)
    return { success: true, id: Date.now() };
    
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}
