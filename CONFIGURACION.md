# 🚚 Veracruz Pro - Guía de Configuración v2.0

## ✨ Nuevas Funcionalidades Agregadas

### 1. **Sistema de Autenticación con Email/Contraseña**
- Login seguro con email y contraseña
- Gestión de sesiones de usuario
- Recuperación de contraseña (próximamente)

**Credenciales de Demo:**
```
Email: admin@veracruz.com
Contraseña: admin123
```

### 2. **Gestión de Usuarios y Roles**
- **Roles disponibles:**
  - **Admin**: Acceso completo a todas las funciones, gestión de usuarios
  - **Usuario**: Acceso limitado a dashboard y registro de gastos

- **Panel de Administración**: 
  - Crear/editar/eliminar usuarios
  - Asignar roles y permisos
  - Ver historial de actividades

### 3. **Exportación de Datos**
- **Excel (.xlsx)**: Exportar historial de gastos con formato profesional
- **PDF**: Generar reportes imprimibles del período seleccionado

**Cómo usar:**
1. Selecciona el período deseado con los filtros
2. Haz clic en los botones "XLS" o "PDF" en la barra superior
3. El archivo se descargaremos automáticamente

### 4. **Búsqueda y Filtros Avanzados**
- Búsqueda por patente o nombre de chofer
- Filtro por tipo de flota (Pesada/Liviana)
- Filtro por período de fechas
- Búsqueda en tiempo real

### 5. **Sistema de Respaldos Automáticos**
- Crear respaldos manuales con un clic
- Los respaldos se guardan en Firestore
- Historial completo de respaldos por usuario

**Cómo hacer respaldo:**
1. Haz clic en el icono de reloj (⏰) en la barra superior
2. Se creará un respaldo automático de todos los datos

### 6. **Notificaciones por Email** (Configuración)
- Alertas cuando se registran gastos mayores a $10,000
- Resumen diario de operaciones (opcional)
- Reporte semanal de la flota (opcional)

**Requisitos:**
- Configurar proveedor de email (SendGrid, Mailgun, etc.)
- Agregar API key en variables de entorno

---

## 🔧 Instalación y Configuración

### Dependencias Instaladas:
```bash
npm install firebase react recharts lucide-react xlsx jspdf
```

### Variables de Entorno (.env)
```
REACT_APP_FIREBASE_API_KEY=tu_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=tu_auth_domain
REACT_APP_EMAIL_API_KEY=tu_email_api_key (opcional)
```

### Estructura Firebase (Firestore)
```
artifacts/
└── veracruz-fleet-pro-v2/
    └── public/
        └── data/
            ├── trucks/ (camiones)
            ├── history/ (gastos registrados)
            ├── users/ (usuarios del sistema)
            └── backups/ (respaldos)
```

---

## 👥 Gestión de Usuarios

### Crear nuevo usuario (Solo Admin):
1. Haz clic en el icono de usuarios (👥) en la barra superior
2. Haz clic en "+ Crear Nuevo Usuario"
3. Completa:
   - Email
   - Contraseña
   - Rol (Admin/Usuario)
4. Haz clic en "Crear"

### Permisos por Rol:
| Función | Admin | Usuario |
|---------|-------|---------|
| Ver Dashboard | ✅ | ✅ |
| Registrar Gastos | ✅ | ✅ |
| Crear Camiones | ✅ | ❌ |
| Gestionar Usuarios | ✅ | ❌ |
| Exportar Datos | ✅ | ✅ |
| Hacer Respaldos | ✅ | ❌ |
| Ver Respaldos | ✅ | ❌ |

---

## 📊 Funcionalidades del Dashboard

### Panel Principal (Dashboard)
- **Total Egresos**: Suma de todos los gastos del período
- **Unidades Activas**: Cantidad de camiones
- **Operaciones Registradas**: Número de gastos
- **Promedio x Unidad**: Costo promedio por camión

### Gráficos:
- **Gráfico de Barras**: Costos fijos vs variables por unidad
- **Gráfico de Pastel**: Distribución de gastos por categoría

### Pestaña Flota
- Tarjetas de cada camión con información detallada
- KM actual de cada unidad
- Costos asociados (Seguro, VTV, Municipal)
- Opción para eliminar unidades

### Pestaña Gastos
- Tabla con todos los movimientos del período
- Información: Fecha, Unidad, Concepto, Monto
- Filtrable y exportable

---

## 💾 Respaldos

### Datos que se respaldan:
- Lista de camiones
- Historial de gastos
- Información de usuarios
- Configuración del sistema

### Restaurar respaldo:
*Funcionalidad en desarrollo*

---

## 🔐 Seguridad

### Buenas Prácticas:
1. **Cambiar contraseña de demo** después de la primera instalación
2. **Usar HTTPS** en producción
3. **Configurar reglas de Firestore** apropiadamente
4. **Backup regular** de datos
5. **Auditoría de usuarios** periodicamente

### Reglas de Firestore Recomendadas:
```json
{
  "rules": {
    "artifacts": {
      "{appId}": {
        "public": {
          "data": {
            "trucks": {
              ".read": "auth != null",
              ".write": "auth != null"
            }
          },
          "users": {
            ".read": "auth != null && root.child('artifacts').child(${appId}).child('public').child('data').child('users').child(auth.uid).child('role').val() == 'admin'",
            ".write": "auth != null && root.child('artifacts').child(${appId}).child('public').child('data').child('users').child(auth.uid).child('role').val() == 'admin'"
          }
        }
      }
    }
  }
}
```

---

## 📱 Interfaz de Usuario

### Botones Principales:
- 🔍 **Buscador**: Busca por patente o nombre de chofer
- 📅 **Período**: Selecciona rango de fechas
- ➕ **Registrar Gasto**: Añade un nuevo gasto
- **XLS**: Exporta a Excel
- **PDF**: Exporta a PDF
- 👥 **Usuarios**: Gestión de usuarios (solo admin)
- ⏰ **Backup**: Crea respaldo manual
- 🚪 **Logout**: Cierra la sesión

---

## 🎯 Próximas Funcionalidades

- [ ] Recuperación de contraseña olvidada
- [ ] Edición de datos de camiones
- [ ] Importación de datos desde Excel
- [ ] Notificaciones en tiempo real
- [ ] Estadísticas avanzadas
- [ ] Multi-idioma
- [ ] Modo oscuro
- [ ] App móvil

---

## 📞 Soporte

Para reportar bugs o solicitar funcionalidades:
- Contacta al equipo de desarrollo
- Email: soporte@veracruzflota.com

---

## 📄 Licencia

Veracruz Pro © 2024. Todos los derechos reservados.
