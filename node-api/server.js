import app from './app.js'
import { initializeDatabase } from './src/config/db.js'
import { startEventAlertMailer } from './src/services/event-alert-mailer.js'

// Usa el puerto configurado o 3000 si no se definió PORT.
const port = Number(process.env.PORT || 3000)

// Prepara las tablas antes de aceptar solicitudes.
initializeDatabase()
  .then(() => app.listen(port, () => {
    console.log(`Node API activa en http://localhost:${port}`)
    startEventAlertMailer()
  }))
  .catch((error) => {
    console.error('No se pudo iniciar la API:', error.message)
    process.exit(1)
  })
