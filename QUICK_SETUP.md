# ⚡ Quick Start - Configurar Firebase en 3 Pasos

## 🎯 Objetivo
Que tu web muestre **datos reales** en lugar de "datos de demo".

---

## Paso 1️⃣: Obtener Firebase Service Account JSON

### Opción A: Desde Firebase Console (Visual)
1. **Abre:** https://console.firebase.google.com
2. **Selecciona** tu proyecto (ej: "distribuidora-camionescostos")
3. **Haz clic** en ⚙️ (arriba a la izquierda) → **Project Settings**
4. **Ve** a la pestaña **Service Accounts**
5. **Haz clic** en **"Generate New Private Key"**
6. Se descargará un archivo `.json`

### Opción B: Desde la CLI (Firebase CLI)
```bash
firebase login
firebase projects:list
firebase admin:import <PROJECT_ID>
```

---

## Paso 2️⃣: Preparar el JSON para Vercel

Una vez que tengas el archivo JSON:

```powershell
# En PowerShell, desde la carpeta del proyecto:
node scripts/prepare-firebase.js "C:\ruta\al\archivo\firebase-key.json"
```

**Salida:**
```
✅ Archivo JSON válido

📋 Información del proyecto:
   Project ID: distribuidora-camionescostos
   Client Email: firebase-adminsdk-xxxx@distribuidora-camionescostos.iam.gserviceaccount.com
   Private Key: -----BEGIN PRIVATE KEY-----...

📝 OPCIÓN 1: JSON en una línea
────────────────────────────────────
{"type":"service_account",...}

📝 OPCIÓN 2: Base64 (RECOMENDADO - más seguro)
────────────────────────────────────
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9Ni...
```

**Esto guarda los valores en:** `.firebase-prep/`

---

## Paso 3️⃣: Agregar a Vercel

### Opción A: Dashboard Web (Más Fácil)

1. **Abre:** https://vercel.com
2. **Selecciona:** Tu proyecto `veracruz-distribuidora`
3. **Ve a:** Settings → Environment Variables
4. **Haz clic:** Add
5. **Llena:**
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** Pega el Base64 (o JSON) de arriba
   - **Environments:** Marca `Production`, `Preview`, `Development`
6. **Haz clic:** Add Environment Variable

### Opción B: CLI (Desde PowerShell)

```powershell
# Copiar el valor Base64 de .firebase-prep/firebase-base64.txt
node scripts/prepare-firebase.js "C:\ruta\al\archivo\firebase-key.json"

# Luego agregar a Vercel
npx vercel env add FIREBASE_SERVICE_ACCOUNT
# Responde: no (no es sensible)
# Responde: Pega el Base64
```

---

## Paso 4️⃣: Deploy

```powershell
npx vercel --prod
```

**Espera 1-2 minutos** para que termine.

---

## ✅ Verificar que Funcionó

1. **Abre tu web:** https://veracruz-distribuidora.vercel.app
2. **Ve a:** Sección "COMPARADOR DE PRECIOS"
3. **Haz clic:** Botón "ACTUALIZAR"
4. Si ves datos como:
   - ✅ NEUMATICO 265/70 R16 LT - $2.850
   - ✅ BATERIA 150AH DIESEL - $4.200
   
   **¡Funcionó!** 🎉

---

## 🆘 Si algo falla

### Problema: "Error al cargar datos (HTTP 500)"
- **Causa:** Firebase aún no está configurado
- **Solución:** Verifica que la variable esté en Vercel Dashboard
- **Verificar:** `npx vercel env ls`

### Problema: "source: demo" en la respuesta
- **Causa:** La variable llegó pero está corrupta
- **Solución:** Vuelve a obtener el JSON y cópialo limpio

### Problema: No encuentro el archivo descargado
- **Solución:** Revisa la carpeta `Descargas` o usa:
  ```powershell
  Get-ChildItem -Name "*firebase*" -Recurse -Path "C:\Users\$env:USERNAME\Downloads"
  ```

---

## 📝 Resumen de Comandos

```bash
# Preparar Firebase JSON
npm run prep-firebase "C:\ruta\al\firebase-key.json"

# Debug y verificación
npm run debug

# Deploy a Vercel
npx vercel --prod

# Ver logs
npx vercel logs
```

---

## ⏱️ Tiempo Estimado
- **Obtener JSON:** 2 minutos
- **Preparar y agregar:** 1 minuto
- **Deploy:** 1 minuto
- **Total:** 4-5 minutos

---

¿Necesitas ayuda? Avísame en qué paso te trabas. 👉
