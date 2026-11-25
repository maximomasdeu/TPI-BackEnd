import { Router } from 'express'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEventDetails,
  updateEventStatus,
} from '../controllers/event.controller.js'
import { optionalLogin, requireLogin } from '../middlewares/auth.middleware.js'

const router = Router()

// Las consultas son públicas, pero pueden usar el usuario opcional para filtrar resultados.
router.get('/', optionalLogin, listEvents)
router.get('/:slug', optionalLogin, getEvent)

// Crear o modificar eventos requiere autenticación.
router.post('/', requireLogin, createEvent)
router.patch('/:slug/status', requireLogin, updateEventStatus)
router.patch('/:slug', requireLogin, updateEventDetails)
router.delete('/:slug', requireLogin, deleteEvent)

export default router
