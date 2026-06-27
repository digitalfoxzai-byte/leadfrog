import PDFDocument from 'pdfkit'
import path from 'path'
import fs from 'fs'

const FONT_DIR   = path.join(process.cwd(), 'public', 'fonts')
const FONT_REG   = path.join(FONT_DIR, 'BaiJamjuree-Regular.ttf')
const FONT_BOLD  = path.join(FONT_DIR, 'BaiJamjuree-Bold.ttf')
const HAS_FONT   = fs.existsSync(FONT_REG) && fs.existsSync(FONT_BOLD)
const REG        = HAS_FONT ? FONT_REG  : 'Helvetica'
const BOLD       = HAS_FONT ? FONT_BOLD : 'Helvetica-Bold'

export interface InvoicePdfData {
  orderId:    string
  paymentId?: string
  userName:   string
  userEmail:  string
  planName:   string
  cycleLabel: string
  amount:     number        // in ₹ (not paise)
  date:       string
  validUntil: string
  status:     string
}

const LIME  = '#16A34A'
const DARK  = '#0F172A'
const GRAY  = '#64748B'
const LIGHT = '#F1F5F9'

export function generateInvoicePdf(inv: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0 })
    const chunks: Buffer[] = []
    doc.on('data',  (c: Buffer) => chunks.push(c))
    doc.on('end',   () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const W = 595.28
    const M = 50

    // ── Header band ──────────────────────────────────────────
    doc.rect(0, 0, W, 120).fill(LIME)

    // Frog icon placeholder (circle + F)
    doc.circle(M + 18, 52, 18).fillOpacity(0.25).fill('#ffffff').fillOpacity(1)
    doc.fillColor('#ffffff').fontSize(18).font(BOLD).text('🐸', M + 7, 41, { lineBreak: false })

    doc.fillColor('#ffffff').fontSize(22).font(BOLD).text('LeadFrog', M + 48, 40)
    doc.fontSize(10).font(REG).fillColor('rgba(255,255,255,0.8)').text('Lead Intelligence Platform', M + 48, 66)

    doc.fillColor('#ffffff').fontSize(26).font(BOLD)
      .text('INVOICE', W - M - 200, 36, { width: 200, align: 'right' })
    doc.fontSize(10).font(REG).fillColor('rgba(255,255,255,0.85)')
      .text(inv.orderId, W - M - 260, 70, { width: 260, align: 'right' })

    // ── Bill To / Details ─────────────────────────────────────
    let y = 148
    doc.fillColor(GRAY).fontSize(9).font(BOLD).text('BILL TO', M, y)
    doc.fillColor(DARK).fontSize(13).font(BOLD).text(inv.userName, M, y + 14)
    doc.fillColor(GRAY).fontSize(10).font(REG).text(inv.userEmail, M, y + 30)

    doc.fillColor(GRAY).fontSize(9).font(BOLD)
      .text('INVOICE DATE', W - M - 160, y, { width: 160, align: 'right' })
    doc.fillColor(DARK).fontSize(10).font(REG)
      .text(inv.date, W - M - 160, y + 13, { width: 160, align: 'right' })

    doc.fillColor(GRAY).fontSize(9).font(BOLD)
      .text('STATUS', W - M - 160, y + 34, { width: 160, align: 'right' })
    doc.fillColor(inv.status === 'paid' ? LIME : '#D97706').fontSize(10).font(BOLD)
      .text(inv.status.toUpperCase(), W - M - 160, y + 48, { width: 160, align: 'right' })

    // ── Divider ───────────────────────────────────────────────
    y = 250
    doc.moveTo(M, y).lineTo(W - M, y).strokeColor('#E2E8F0').lineWidth(1).stroke()

    // ── Table Header ──────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(9).font(BOLD)
    doc.text('DESCRIPTION',  M,            y + 10)
    doc.text('CYCLE',        W - M - 220,  y + 10, { width: 100, align: 'center' })
    doc.text('AMOUNT',       W - M - 100,  y + 10, { width: 100, align: 'right' })
    doc.moveTo(M, y + 30).lineTo(W - M, y + 30).stroke()

    // ── Line Item ─────────────────────────────────────────────
    doc.fillColor(DARK).fontSize(12).font(BOLD).text(inv.planName, M, y + 44)
    doc.fillColor(GRAY).fontSize(9).font(REG).text('Lead scraping subscription', M, y + 60)
    doc.fillColor(DARK).fontSize(10).font(REG)
      .text(inv.cycleLabel, W - M - 220, y + 48, { width: 100, align: 'center' })
    doc.font(BOLD)
      .text(`Rs. ${inv.amount.toLocaleString('en-IN')}`, W - M - 100, y + 48, { width: 100, align: 'right' })
    doc.moveTo(M, y + 84).lineTo(W - M, y + 84).stroke()

    // ── Totals ────────────────────────────────────────────────
    y = y + 104
    doc.fillColor(GRAY).fontSize(10).font(REG)
    doc.text('Subtotal',      W - M - 220, y,      { width: 120 })
    doc.fillColor(DARK)
      .text(`Rs. ${inv.amount.toLocaleString('en-IN')}`, W - M - 100, y, { width: 100, align: 'right' })
    doc.fillColor(GRAY)
      .text('Tax (18% GST)', W - M - 220, y + 18, { width: 120 })
    doc.fillColor(DARK)
      .text('Included',       W - M - 100, y + 18, { width: 100, align: 'right' })

    doc.moveTo(W - M - 220, y + 38).lineTo(W - M, y + 38).stroke()
    doc.fillColor(DARK).fontSize(12).font(BOLD)
      .text('Total',          W - M - 220, y + 50, { width: 120 })
    doc.fillColor(LIME)
      .text(`Rs. ${inv.amount.toLocaleString('en-IN')}`, W - M - 120, y + 50, { width: 120, align: 'right' })

    // ── Valid Until ───────────────────────────────────────────
    y = y + 100
    doc.rect(M, y, W - 2 * M, 44).fill(LIGHT)
    doc.fillColor(GRAY).fontSize(9).font(BOLD).text('PLAN ACTIVE UNTIL', M + 16, y + 8)
    doc.fillColor(DARK).fontSize(13).font(BOLD).text(inv.validUntil, M + 16, y + 22)
    if (inv.paymentId) {
      doc.fillColor(GRAY).fontSize(9).font(REG)
        .text(`Payment ID: ${inv.paymentId}`, W - M - 260, y + 18, { width: 244, align: 'right' })
    }

    // ── Footer ────────────────────────────────────────────────
    doc.fillColor(GRAY).fontSize(9).font(REG)
      .text(
        'Payments processed securely via Razorpay. Thank you for using LeadFrog.',
        M, 758, { width: W - 2 * M, align: 'center' }
      )
      .text(
        'support@digitalfoxz.com',
        M, 772, { width: W - 2 * M, align: 'center' }
      )

    doc.end()
  })
}
