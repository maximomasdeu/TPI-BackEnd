import express from 'express'
import eventsRoutes from './src/routes/events.routes.js'
import anniversariesRoutes from './src/routes/anniversaries.routes.js'
import contactRoutes from './src/routes/contact.routes.js'
import { healthCheck } from './src/controllers/event.controller.js'

const app = express()

app.use(express.json({ limit: '8mb' }))
// Habilita las solicitudes del frontend y responde directamente a los preflight CORS.
app.use((request, response, next) => {
  response.header('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  if (request.method === 'OPTIONS') {
    response.sendStatus(204)
    return
  }
  next()
})

// Endpoint simple para comprobar que el servicio está disponible.
app.get('/health', healthCheck)

// Cada grupo de rutas delega la lógica de negocio en sus controladores.
app.use('/events', eventsRoutes)
app.use('/anniversaries', anniversariesRoutes)
app.use('/contact', contactRoutes)

// Convierte errores no manejados por una ruta en respuestas JSON.
app.use((error, request, response, next) => {
  console.error(error)
  const statusCode = error.statusCode || error.status || 500
  response.status(statusCode).json({
    message: error.statusCode ? error.message : statusCode === 413 ? 'La solicitud supera el tamaño permitido.' : 'Error interno del servidor',
  })
})

export default app
