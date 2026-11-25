import { Router } from 'express'
import { createContactMessage, listContactMessages } from '../controllers/contact.controller.js'
import { requireLogin } from '../middlewares/auth.middleware.js'

const router = Router()

// Solo administración puede consultar los mensajes recibidos.
router.get('/', requireLogin, listContactMessages)

// El formulario permite enviar mensajes sin iniciar sesión.
router.post('/', createContactMessage)

export default router