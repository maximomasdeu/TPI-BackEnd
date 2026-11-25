import { Router } from 'express'
import {
  createAnniversary,
  deleteAnniversary,
  getAnniversary,
  listAnniversaries,
  updateAnniversaryStatus,
} from '../controllers/anniversary.controller.js'
import { optionalLogin, requireLogin } from '../middlewares/auth.middleware.js'

const router = Router()

// La lectura es pública; un token válido permite mostrar información adicional de administración.
router.get('/', optionalLogin, listAnniversaries)
router.get('/:id', optionalLogin, getAnniversary)

// Las operaciones de escritura requieren autenticación.
router.post('/', requireLogin, createAnniversary)
router.patch('/:id/status', requireLogin, updateAnniversaryStatus)
router.delete('/:id', requireLogin, deleteAnniversary)

export default router
