import { pool } from '../config/db.js'
import puppeteer from 'puppeteer'

// 🔥 Función para convertir números a letras (versión profesional)
function numeroALetras(num) {
  const UNIDADES = [
    '', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'
  ];
  const DECENAS = [
    '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'
  ];
  const CENTENAS = [
    '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'
  ];

  function convertirMenorMil(n) {
    let letras = '';

    if (n >= 100) {
      if (n === 100) {
        letras = 'CIEN';
      } else {
        letras = CENTENAS[Math.floor(n / 100)];
      }
      n = n % 100;
    }

    if (n >= 20) {
      if (letras) letras += ' ';
      letras += DECENAS[Math.floor(n / 10)];
      if (n % 10 !== 0) letras += ' Y ' + UNIDADES[n % 10];
    } else if (n > 0) {
      if (letras) letras += ' ';
      letras += UNIDADES[n];
    }

    return letras;
  }

  function convertirNumero(n) {
    if (n === 0) return 'CERO';

    let millones = Math.floor(n / 1000000);
    let miles = Math.floor((n - (millones * 1000000)) / 1000);
    let resto = n % 1000;

    let letras = '';

    if (millones > 0) {
      if (millones === 1) letras += 'UN MILLÓN';
      else letras += convertirMenorMil(millones) + ' MILLONES';
    }

    if (miles > 0) {
      if (letras) letras += ' ';
      if (miles === 1) letras += 'MIL';
      else letras += convertirMenorMil(miles) + ' MIL';
    }

    if (resto > 0) {
      if (letras) letras += ' ';
      letras += convertirMenorMil(resto);
    }

    return letras;
  }

  const partes = num.toFixed(2).split('.');
  const entero = parseInt(partes[0], 10);
  const decimales = partes[1];

  // 🎯 Manejo especial para 1 sol
  if (entero === 1) return `UN SOL CON ${decimales}/100`;
  return `${convertirNumero(entero)} CON ${decimales}/100 SOLES`;
}

export const obtenerComprobante = async (req, res) => {
  const { tipo, serie, numero } = req.params

  try {
    const [rows] = await pool.query(
      `SELECT 
        c.crucclie AS ruc,
        c.cnomclie AS cliente,
        c.cdirclie AS direccion,
        c.ctipdocu AS tipo_documento,
        c.cserdocu AS serie,
        c.cnumdocu AS numero,
        DATE_FORMAT(c.ffecemis, '%Y-%m-%d') AS fecha_emision,
        c.ctipmone AS tipo_moneda,
        c.ntotdocu AS total_documento,
        c.nvv_docu AS sub_total,
        c.nigvdocu AS total_igv,
        gx_vendedor.ctitvend AS vendedor,
        c.ccodinte AS id_interno,
        d.ncanvent AS cantidad,
        d.npreunit AS precio_unitario,
        d.ntotregi AS total_item,
        p.ctitprod AS descripcion
      FROM tx_salidac c
      JOIN tx_salidad d ON c.ccodinte = d.ccodinte
      JOIN gx_producto p ON d.ccodprod = p.ccodprod
      JOIN gx_vendedor ON c.ccodvend = gx_vendedor.ccodvend
      WHERE c.ctipdocu = ? AND c.cserdocu = ? AND c.cnumdocu = ?`,
      [tipo, serie, numero]
    )

    if (rows.length === 0) {
      return res.status(404).json({ mensaje: 'Comprobante no encontrado' })
    }

    const comprobante = rows[0]
    const productos = rows

    const tipoDocumentoCliente = '6' // 6 = RUC (podrías hacer dinámico si tuvieras DNI)
    const qrData = `${comprobante.ruc}|01|${comprobante.serie}|${comprobante.numero}|${comprobante.total_documento}|${comprobante.total_igv}|${comprobante.fecha_emision}|${tipoDocumentoCliente}|${comprobante.ruc}`

    const montoEnLetras = numeroALetras(parseFloat(comprobante.total_documento));

    const tipoDescripcion = {
      '01': 'Factura Electrónica',
      '03': 'Boleta de Venta Electrónica',
      '07': 'Nota de Crédito Electrónica',
      '08': 'Nota de Débito Electrónica'
    }
    
    const tipoTexto = tipoDescripcion[comprobante.tipo_documento] || 'Comprobante Electrónico';
    
    // HTML para el PDF
    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 40px;">
  <table style="width: 100%; margin-bottom: 20px;">
    <tr>
      <td style="width: 70%; vertical-align: top;">
        <div style="text-align: left;">
          <img src="http://localhost:3000/public/logo.png" alt="Logo" style="height: 50px; margin-bottom: 10px;">
          <h4><strong>COMERCIAL SPLANA E.I.R.L.</strong></h4>
          <p><strong>Principal:</strong> Calle Real 261, Junín, Perú</p>
          <p><strong>Tlf.:</strong> (064) 216665</p>
        </div>
      </td>
      <td style="width: 30%; padding: 10px;">
        <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <p style="margin: 4px 0;"><strong>RUC:</strong> 20486293692</p>
          <p style="margin: 4px 0;"><strong>${tipoTexto}</strong></p>
          <p style="margin: 4px 0;"><strong>${comprobante.serie}-${comprobante.numero}</strong></p>
        </div>
      </td>
    </tr>
  </table>

  <table style="width: 100%; border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; font-size: 12px; page-break-inside: avoid;">
    <tr><td><strong>Señor(es):</strong> ${comprobante.cliente}</td></tr>
    <tr><td><strong>RUC:</strong> ${comprobante.ruc}</td></tr>
    <tr><td><strong>Dirección:</strong> ${comprobante.direccion}</td></tr>
    <tr><td><strong>Fecha Emisión:</strong> ${comprobante.fecha_emision}</td></tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; font-size: 12px;">
    <thead>
      <tr style="background-color: #f0f0f0;">
        <th style="border: 1px solid #ccc; padding: 8px;">Descripción</th>
        <th style="border: 1px solid #ccc; padding: 8px;">Cantidad</th>
        <th style="border: 1px solid #ccc; padding: 8px;">P. Unitario</th>
        <th style="border: 1px solid #ccc; padding: 8px;">Total</th>
      </tr>
    </thead>
    <tbody>
  ${productos.map(p => `
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">${p.descripcion}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${Number(p.cantidad).toFixed(2)}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">S/ ${Number(p.precio_unitario).toFixed(2)}</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">S/ ${Number(p.total_item).toFixed(2)}</td>
    </tr>
  `).join('')}
</tbody>

  </table>

  <div style="display: flex; justify-content: flex-end; margin-bottom: 20px;">
    <table style="width: 300px; border-collapse: collapse; page-break-inside: avoid; font-size: 12px;">
      <tbody>
        <tr>
          <th style="border: 1px solid #ccc; background: #f0f0f0; padding: 8px; text-align: right;">Op. Gravada:</th>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">S/ ${Number(comprobante.sub_total).toFixed(2)}</td>
        </tr>
        <tr>
          <th style="border: 1px solid #ccc; background: #f0f0f0; padding: 8px; text-align: right;">IGV (18%):</th>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">S/ ${Number(comprobante.total_igv).toFixed(2)}</td>
        </tr>
        <tr>
          <th style="border: 1px solid #ccc; background: #f0f0f0; padding: 8px; text-align: right;">Total Venta:</th>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: right; font-size: 16px;"><strong>S/ ${Number(comprobante.total_documento).toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <p><strong>SON:</strong> ${montoEnLetras}</p>

  <h4 style="margin-top: 30px;">Cuentas Bancarias:</h4>
  <p>Banco BBVA: 0011-0307-02-00002023 (Soles)</p>
  <p>Banco Interbank: 0011-0307-02-00002279 (Soles)</p>

  <div style="text-align: center; margin-top: 40px; page-break-inside: avoid;">
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${qrData}" alt="Código QR">
    <p style="font-size: 10px; color: #888;">Escanee el código para ver la representación electrónica</p>
  </div>
  <p style="text-align: center; margin-top: 20px; font-size: 10px; color: #888;">
    Representación impresa de la FACTURA ELECTRÓNICA.  
  </p>
</body>
      </html>
    `

    // Generar PDF
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',  // Dejar vacío el header
      footerTemplate: `
        <div style="font-size:10px; width:100%; text-align:center; color: #666; padding:10px 0;">
          Página {{pageNumber}} de {{totalPages}}
        </div>
      `,
      margin: {
        top: '20px',
        right: '20px',
        bottom: '60px', /* 💡 Aumentamos margen inferior para que el footer no tape contenido */
        left: '20px'
      }
    })
        await browser.close()

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename=comprobante-${comprobante.serie}-${comprobante.numero}.pdf`
    })

    res.send(pdfBuffer)
  } catch (error) {
    console.error('Error al generar PDF:', error)
    res.status(500).send('Error al generar el comprobante PDF')
  }
}
