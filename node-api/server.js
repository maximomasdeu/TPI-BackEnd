import app from './app.js'
import { initializeDatabase } from './src/config/db.js'

const port = Number(process.env.PORT || 3000)

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Node API activa en http://localhost:${port}`)))
  .catch((error) => {
    console.error('No se pudo iniciar la API:', error.message)
    process.exit(1)
  })
