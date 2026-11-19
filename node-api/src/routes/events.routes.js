import { Router } from 'express'
import {
  createEvent,
  deleteEvent,
  getEvent,
  listEvents,
  updateEventStatus,
} from '../controllers/event.controller.js'
import { requireLogin } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', listEvents)
router.get('/:slug', getEvent)
router.post('/', requireLogin, createEvent)
router.patch('/:slug/status', requireLogin, updateEventStatus)
router.delete('/:slug', requireLogin, deleteEvent)

export default router
