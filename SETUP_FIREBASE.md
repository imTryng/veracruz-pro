# 📋 Obtener Firebase Service Account JSON - Guía Paso a Paso

## Paso 1: Ir a Firebase Console
1. Abre en tu navegador: **https://console.firebase.google.com**
2. Inicia sesión con tu cuenta de Google (la que usó para crear el proyecto)

## Paso 2: Selecciona tu Proyecto
- Busca el proyecto llamado algo como:
  - "distribuidora-camionescostos" 
  - "veracruz-app"
  - O como hayas nombrado tu proyecto Firebase
- Haz clic en él

## Paso 3: Acceder a Service Accounts
1. En la esquina superior izquierda, haz clic en el **ícono ⚙️ (engranaje)**
2. Selecciona **"Project Settings"** (Configuración del proyecto)

## Paso 4: Ir a Service Accounts
1. En la ventana que se abre, ve a la pestaña **"Service Accounts"**

## Paso 5: Descargar la Clave
1. Busca la sección "Firebase Admin SDK"
2. Haz clic en el botón **"Generate New Private Key"** (Generar nueva clave privada)
3. Se descargará un archivo `.json` con un nombre como:
   - `distribuidora-camionescostos-firebase-adminsdk-xxxxx.json`

## Paso 6: Copiar el Contenido
1. Abre el archivo JSON descargado con un editor de texto (Notepad, VS Code, etc.)
2. Selecciona **TODO el contenido** (Ctrl+A)
3. Cópialo (Ctrl+C)

## Paso 7: Convertir a Base64 (Opcional pero Recomendado)
### En PowerShell:
```powershell
# Opción 1: Si tienes el archivo
$path = "C:\ruta\al\archivo\firebase-key.json"
$json = Get-Content $path -Raw
$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
$base64 | Set-Clipboard
Write-Host "✅ Base64 copiado al portapapeles"
```

### Resultado:
- Un string muy largo empezando con `eyJ...` estará en tu portapapeles

## Paso 8: Agregar a Vercel (Opción A - Recomendada: Dashboard)

### Opción A.1: Desde el Dashboard Web
1. Ve a **https://vercel.com**
2. Selecciona tu proyecto **veracruz-distribuidora**
3. Ve a **Settings** → **Environment Variables**
4. Haz clic en **Add**
5. Llena:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Value:** Pega el JSON (o Base64 si convertiste)
   - **Environments:** Selecciona `Production`, `Preview`, y `Development`
6. Haz clic en **Add Environment Variable**

### Opción A.2: Desde la CLI (después que funcione)
```powershell
# En PowerShell, desde tu carpeta del proyecto:
cd "C:\Users\tobia\OneDrive\Imágenes\Screenshots\web-camiones"

# Agregar la variable
npx vercel env add FIREBASE_SERVICE_ACCOUNT

# Responder las preguntas:
# Is the value a sensitive secret? → n (no)
# What's the value of FIREBASE_SERVICE_ACCOUNT? → Pega tu JSON o Base64
```

## Paso 9: Deploy Nuevamente

```powershell
npx vercel --prod
```

---

## ✅ Verificar que Funcionó

1. Espera a que Vercel termine el deploy (~1 minuto)
2. Ve a tu web: **https://veracruz-distribuidora.vercel.app**
3. Haz clic en **"ACTUALIZAR"** en la sección de precios
4. Si ves datos reales (no "demo"), ¡funcionó! ✅

---

## 🆘 Si Algo No Funciona

**Problema:** No encuentro el botón "Generate New Private Key"
- **Solución:** Asegúrate de haber ido a Project Settings → Service Accounts

**Problema:** El archivo JSON tiene estructura extraña
- **Solución:** No importa, cópialo igual, nuestro código maneja múltiples formatos

**Problema:** El deploy en Vercel aún falla
- **Solución:** Haz log en: `npx vercel logs` para ver el error exacto

---

## 📌 Notas Importantes

- **NO commits el JSON a Git** - Ya está en `.gitignore`
- El archivo JSON que descarges tiene credenciales reales, así que:
  - ✅ Guárdalo en lugar seguro localmente
  - ✅ Mete en Vercel como variable
  - ❌ No lo compartas ni lo publiques
- Si alguien accede a este JSON, pueden usar tu Firestore como propio

---

¿Necesitas ayuda en alguno de estos pasos? Avísame cuál es el que te cuesta.
