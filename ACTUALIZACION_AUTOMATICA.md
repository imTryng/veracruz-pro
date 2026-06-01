# 🕘 Actualización Automática de Precios

## ¿Cómo funciona?

**Cada día a las 9 AM (Argentina), GitHub Actions:**
1. ✅ Ejecuta automáticamente el script `scripts/actualizar-precios.js`
2. 🔄 Scraperrea las 2 distribuidoras:
   - https://www.distrisuronline.com/
   - https://distribuidoraveracruz.tiendapropio.com/search
3. 💾 Actualiza `api/productos-reales.json` con precios nuevos
4. 📤 Hace auto-commit si detecta cambios
5. 🚀 Vercel auto-redeploy → ¡Precios actualizados en la app!

## Archivos clave

```
.github/workflows/actualizar-precios.yml    ← Programación de GitHub Actions
scripts/actualizar-precios.js               ← Script que scraperrea
api/productos-reales.json                   ← Base de datos de productos
```

## Ejecutar manualmente

Si quieres actualizar YA sin esperar a las 9 AM:

1. Ve a: https://github.com/imTryng/veracruz-pro/actions
2. Selecciona: "Actualizar Precios Diariamente"
3. Click en: "Run workflow"
4. Espera ~30 segundos
5. ✅ Los precios se actualizarán automáticamente

## Monitoreo

- **Logs**: https://github.com/imTryng/veracruz-pro/actions
- **Cambios**: https://github.com/imTryng/veracruz-pro/commits/main (busca commits automáticos)

## Notas técnicas

- ⏰ Horario: **12:00 UTC** = **09:00 ART** (Argentina)
- 🔄 Si las páginas no devuelven datos, mantiene precios anteriores
- 💡 Solo hace commit si detecta cambios en precios
- 🛡️ Usa credenciales de GitHub automáticamente

## Si algo falla

1. Revisa los logs en GitHub Actions
2. Verifica que las URLs de las distribuidoras sigan igual
3. Ejecuta manualmente desde la interfaz de GitHub
