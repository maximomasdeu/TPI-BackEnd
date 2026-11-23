import { Router } from 'express'
import { createContactMessage, listContactMessages } from '../controllers/contact.controller.js'
import { requireLogin } from '../middlewares/auth.middleware.js'

const router = Router()

router.get('/', requireLogin, listContactMessages)
router.post('/', createContactMessage)

export default router