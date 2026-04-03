# INICIO RÁPIDO - Veracruz Pro v2.0

## 🚀 Pasos de Instalación

### 1. Instalación de Dependencias ✅
```bash
npm install
```
*(Ya realizado: firebase, react, recharts, lucide-react, xlsx, jspdf)*

### 2. Configuración de Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env.local

# Los datos de Firebase ya están en el código
# Solo agregar si usas email notifications:
REACT_APP_EMAIL_API_KEY=tu_clave_aqui
```

### 3. Iniciar el Servidor de Desarrollo
```bash
npm run dev
```
El sitio abrirá en `http://localhost:5173`

### 4. Primer Login
**Email:** `admin@veracruz.com`  
**Contraseña:** `admin123`

---

## 🎯 Nuevas Funcionalidades Implementadas

### ✅ Sistema de Autenticación
- Login con email y contraseña
- Pantalla de inicio de sesión profesional
- Gestión de sesiones

### ✅ Panel de Administración
- Crear y gestionar usuarios
- Asignar roles (Admin/Usuario)
- Lista de usuarios con roles

### ✅ Exportación de Datos
- Descargar HTML como Excel (.xlsx)
- Generar reportes en PDF con período seleccionado

### ✅ Búsqueda y Filtros Mejorados
- Filtro por patente/chofer (en tiempo real)
- Filtro por tipo de flota (Pesada/Liviana)
- Filtro por período de fechas

### ✅ Sistema de Respaldos
- Crear respaldos manuales
- Los respaldos se guardan en Firestore
- Historial de respaldos

### ✅ Notificaciones por Email
- Configuración básica lista
- Estructura para integrar SendGrid, Mailgun, Resend
- Alertas automáticas para gastos importantes

---

## 📱 Botones Nuevos en la Barra Superior

| Botón | Función |
|-------|---------|
| **XLS** | Exportar a Excel |
| **PDF** | Exportar a PDF |
| **👥** | Panel de usuarios (solo admin) |
| **⏰** | Hacer respaldo manual |

---

## 🔒 Roles y Permisos

### Admin (admin@veracruz.com)
- Ver todo el dashboard
- Registrar gastos
- Crear camiones
- Gestionar usuarios
- Exportar datos
- Hacer respaldos

### Usuario Normal
- Ver dashboard
- Registrar gastos
- Exportar datos

---

## ⚠️ Próximos Pasos Recomendados

1. **Crear cuenta de administrador real**
   - Cambiar la contraseña de admin@veracruz.com
   - O crear nuevo usuario admin

2. **Configurar Email Notifications**
   - Registrarse en SendGrid/Mailgun/Resend
   - Obtener API key
   - Agregar en .env.local

3. **Configurar Firestore Security**
   - Actualizar reglas de Firestore en Firebase Console
   - Proteger colecciones de usuarios

4. **Hacer Respaldo**
   - Hacer primer respaldo de datos
   - Verificar en Firebase Console

---

## 🐛 Troubleshooting

### Error: "No se pudo autenticar"
- Verificar conexión a Firebase
- Verificar API key en firebase.config
- Revisar reglas de Firestore

### Error en Exportación
- Verificar que hay datos en el período seleccionado
- Ver consola del navegador (F12) para más detalles

### Email no se envía
- Verificar REACT_APP_EMAIL_API_KEY en .env
- Verificar configuración de proveedor de email

---

## 📚 Documentación Completa
Ver archivo `CONFIGURACION.md` para documentación detallada.

---

## ✨ ¡Listo! 
Tu aplicación Veracruz Pro está lista para usar. 🎉

Cualquier duda: revisa `CONFIGURACION.md` o contacta soporte.
