# Colaborar con el backend

## Instalar el hook pre-push

Desde la raíz del repositorio `TPI-BackEnd`, ejecutá una vez en macOS/Linux o
Git Bash:

```sh
chmod +x .githooks/pre-push
git config core.hooksPath .githooks
```

En Windows también podés ejecutar la configuración desde PowerShell:

```powershell
git config core.hooksPath .githooks
```

El ajuste queda en la configuración local del repositorio. Cada vez que intentes
hacer `git push`, Git ejecutará `.githooks/pre-push`, que corre `npm test` dentro
de `node-api`. Si Node.js/npm no está disponible o algún test falla, el hook
termina con error y Git cancela el push. Cada colaborador debe instalarlo en su
propio clon.

Para comprobarlo manualmente, desde `node-api` ejecutá:

```sh
npm test
```

## GitHub Actions

El workflow `.github/workflows/node-api-tests.yml` se ejecuta en cada push a
cualquier rama y en cada pull request. Instala Node.js 22, ejecuta `npm ci` con
`node-api/package-lock.json` y después ejecuta `npm test`. Un error en la
instalación o en las pruebas marca la ejecución como fallida.
