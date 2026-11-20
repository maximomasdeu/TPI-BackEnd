import express from 'express'
import eventsRoutes from './src/routes/events.routes.js'
import anniversariesRoutes from './src/routes/anniversaries.routes.js'
import contactRoutes from './src/routes/contact.routes.js'
import { healthCheck } from './src/controllers/event.controller.js'

const app = express()

app.use(express.json())
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

app.get('/health', healthCheck)
app.use('/events', eventsRoutes)
app.use('/anniversaries', anniversariesRoutes)
app.use('/contact', contactRoutes)

app.use((error, request, response, next) => {
  console.error(error)
  response.status(500).json({ message: 'Error interno del servidor' })
})

export default app
