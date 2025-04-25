import express from 'express'
import { obtenerComprobante } from '../controllers/comprobanteController.js'

const router = express.Router()
router.get('/comprobantes/:tipo/:serie/:numero', obtenerComprobante)
export default router
