import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import comprobanteRoutes from './routes/comprobanteRoutes.js'

dotenv.config()

console.log(`Iniciando ${process.env.APP_NAME}`)

const app = express()
app.use(cors())
app.use(express.json())

// Servir carpeta pública (para el logo)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
app.use('/public', express.static(path.join(__dirname, 'public')))

// Rutas
app.use('/api', comprobanteRoutes)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`)
})
