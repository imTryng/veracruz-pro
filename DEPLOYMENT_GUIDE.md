# 🚀 Guía de Deployment a Vercel

## 1. Preparación Local

### Validar el setup
```bash
# Correr script de validación
node scripts/setup.js

# Correr debugging
LOG_LEVEL=debug node scripts/debug.js

# Test del scraper
npm run test:scraper
```

### Variables de Entorno Locales (.env)
```bash
# Copiar .env.example si no existe
cp .env.example .env

# Editar .env con tus valores
nano .env
```

---

## 2. Configurar en Vercel Dashboard

### 2.1 Ir a: `vercel.com` → Tu Proyecto → Settings → Environment Variables

### 2.2 Agregar Variables

#### A) FIREBASE_SERVICE_ACCOUNT (Método Base64 - RECOMENDADO)

```bash
# En tu máquina local (PowerShell)
$key = Get-Content "C:\path\to\firebase-key.json" -Raw
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($key)) | Set-Clipboard
```

En Vercel:
- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** Pega el Base64 (desde clipboard)
- **Environments:** Production, Preview, Development

#### B) FIREBASE_SERVICE_ACCOUNT (Método JSON Directo - Si prefieres)

En Vercel:
- **Name:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** El JSON completo en UNA línea:
```json
{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",...}
```
- **Environments:** Production, Preview, Development

#### C) CRON_SECRET (Seguridad)

```bash
# Generar secret seguro
openssl rand -hex 32
# Salida: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# O en PowerShell
[System.Convert]::ToHexString((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

En Vercel:
- **Name:** `CRON_SECRET`
- **Value:** Tu secret generado (32+ caracteres)
- **Environments:** Production (importante!)

#### D) LOG_LEVEL

En Vercel:
- **Name:** `LOG_LEVEL`
- **Value:** `info` (cambiar a `debug` solo si necesitas ver más detalles)
- **Environments:** Production

#### E) Otras (Opcionales)

```bash
SCRAPER_TIMEOUT=10000
SCRAPER_RETRIES=2
NODE_ENV=production
```

---

## 3. Deploy a Vercel

### Desde la CLI
```bash
# Login
vercel login

# Deploy a staging
vercel

# Deploy a producción
vercel --prod
```

### Desde GitHub (si está conectado)
- Push a `main` triggeará build automático
- Vercel deployará automáticamente

---

## 4. Verificar Deploy

### Ver logs en tiempo real
```bash
vercel logs --follow
```

### Test de la API

#### GET (obtener precios)
```bash
curl https://tu-proyecto.vercel.app/api/scraper-precios
```

#### POST (triggerear scraping)
```bash
curl -X POST https://tu-proyecto.vercel.app/api/scraper-precios \
  -H "Authorization: Bearer tu-cron-secret-aqui" \
  -H "Content-Type: application/json"
```

---

## 5. Configurar Cron Job (Automático)

### En Vercel (vercel.json)
Ya está configurado en `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/scraper-precios",
    "schedule": "0 */6 * * *"
  }]
}
```

Esto ejecutará el scraper:
- **Cada 6 horas**
- Automáticamente
- Con el header `Authorization: Bearer $CRON_SECRET`

### Para cambiar frecuencia
Editar `vercel.json`:
- `"0 * * * *"` → Cada hora
- `"0 0 * * *"` → Diariamente a las 00:00
- `"0 */12 * * *"` → Cada 12 horas

---

## 6. Monitoreo

### Logs en Vercel Dashboard
```
Settings → Functions Logs → Filter by scraper-precios
```

### Interpretar logs
```
✅ Firebase inicializado          → OK
📡 Scrapeando...                  → En progreso
✅ Precios guardados              → Éxito
❌ Error scrapeando              → Error (revisar detalles)
🚫 Intento no autorizado          → Token inválido
⏳ Rate limit excedido            → Demasiadas requests
```

---

## 7. Troubleshooting

### Error: `Error parseando FIREBASE_SERVICE_ACCOUNT`

**Posibles causas:**
1. Base64 incorrecto
2. JSON malformado
3. Private key corrupta

**Solución:**
```bash
# Validar que el JSON sea correcto
node scripts/debug.js

# Si usa Base64, verificar:
cat firebase-key.json | base64 | base64 -d | jq .
```

### Error: `No autorizado`

**Causa:** CRON_SECRET incorrecto o faltante

**Solución:**
```bash
# Verificar en Vercel Dashboard
vercel env ls

# Generar uno nuevo
openssl rand -hex 32

# Actualizar
vercel env add CRON_SECRET
```

### Error: `Rate limit excedido`

**Causa:** Demasiadas requests en corto tiempo

**Solución:**
- Esperar 1 minuto
- O revisar si hay requests duplicados

### Error: `Timeout`

**Causa:** Scraper tarda más de 10 segundos

**Solución:**
```bash
# Aumentar timeout en Vercel
vercel env add SCRAPER_TIMEOUT 20000

# O revisar la URL que falla en los logs
```

---

## 8. Mejores Prácticas

### ✅ DO
- Usar Base64 para FIREBASE_SERVICE_ACCOUNT
- Cambiar CRON_SECRET regularmente (ej: mensualmente)
- Revisar logs semanalmente
- Hacer backup de las credenciales
- Versionar cambios en código

### ❌ DON'T
- Incluir credenciales en Git
- Usar CRON_SECRET débil (<32 caracteres)
- Dejar LOG_LEVEL=debug en production
- Ejecutar scraping muy frecuentemente (overhead)
- Ignorar errores en logs

---

## 9. Comandos Útiles

```bash
# Ver todas las variables de entorno
vercel env ls

# Actualizar una variable
vercel env add NOMBRE_VARIABLE

# Ver los últimos 50 logs
vercel logs

# Seguir logs en tiempo real
vercel logs --follow

# Desplegar sin cache
vercel --force

# Ver estado del deploy
vercel inspect

# Abrir el proyecto en el navegador
vercel open
```

---

## 10. Soporte

Si algo falla:

1. **Revisar MEJORAS_IMPLEMENTADAS.md** - Cambios realizados
2. **Correr `node scripts/debug.js`** - Validación completa
3. **Revisar `vercel logs`** - Errores específicos
4. **Consultar .env.example** - Configuración correcta

---

## 📊 Estado del Proyecto

✅ **Seguridad:** Autenticación timing-safe, rate limiting
✅ **Rendimiento:** Retries inteligentes, batch operations
✅ **Logging:** Sistema centralizado y estructurado
✅ **Configuración:** Centralizada y versionable
✅ **Documentación:** Completa con ejemplos

---

**Última actualización:** 31 de mayo de 2026
