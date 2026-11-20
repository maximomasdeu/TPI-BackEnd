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

router.get('/', optionalLogin, listAnniversaries)
router.get('/:id', optionalLogin, getAnniversary)
router.post('/', requireLogin, createAnniversary)
router.patch('/:id/status', requireLogin, updateAnniversaryStatus)
router.delete('/:id', requireLogin, deleteAnniversary)

export default router
