/**
 * useReceiptShare.ts
 * Hook that generates a receipt image from a ReceiptCanvas ref,
 * then offers three share options: WhatsApp image, WhatsApp text, download PNG.
 *
 * html2canvas → canvas → blob → Web Share API (mobile) or fallback (desktop)
 */
import { useRef, useState, useCallback } from 'react'
import type { ReceiptData } from './ReceiptCanvas'

export type ShareOption = 'whatsapp-image' | 'whatsapp-text' | 'download'

export function useReceiptShare() {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)

  /**
   * Capture the receipt DOM node as a PNG blob.
   */
  const captureReceipt = useCallback(async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null
    try {
      const { default: html2canvas } = await import('html2canvas')
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,           // retina quality
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 400,
        windowWidth: 400,
      })
      return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png', 0.95))
    } catch (err) {
      console.error('html2canvas failed:', err)
      return null
    }
  }, [])

  /**
   * Share as image via WhatsApp.
   * On mobile with Web Share API → native sheet (opens WhatsApp directly).
   * On desktop → falls back to downloading the image with an alert.
   */
  const shareAsImage = useCallback(async (data: ReceiptData) => {
    setGenerating(true)
    try {
      const blob = await captureReceipt()
      if (!blob) throw new Error('Failed to generate receipt image')

      const fileName = `receipt-${data.saleDate}.png`

      // Mobile: use native Web Share with file
      if (
        navigator.canShare &&
        navigator.canShare({ files: [new File([blob], fileName, { type: 'image/png' })] })
      ) {
        await navigator.share({
          files: [new File([blob], fileName, { type: 'image/png' })],
          title: `Receipt — ${data.companyName}`,
          text: `Sales receipt from ${data.companyName}`,
        })
        return
      }

      // Fallback: download + open WhatsApp text share
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)

      // Also open WhatsApp with a note to attach the downloaded image
      const text = buildTextReceipt(data)
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    } finally {
      setGenerating(false)
    }
  }, [captureReceipt])

  /**
   * Share as formatted text via WhatsApp (existing behavior, upgraded).
   */
  const shareAsText = useCallback((data: ReceiptData) => {
    const text = buildTextReceipt(data)
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [])

  /**
   * Download receipt as PNG.
   */
  const downloadReceipt = useCallback(async (data: ReceiptData) => {
    setGenerating(true)
    try {
      const blob = await captureReceipt()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `receipt-${data.companyName.replace(/\s+/g, '-')}-${data.saleDate}.png`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }, [captureReceipt])

  return { receiptRef, generating, shareAsImage, shareAsText, downloadReceipt }
}

function buildTextReceipt(data: ReceiptData): string {
  const { items, total, paymentMethod, customerName, saleDate, notes, companyName, appName } = data
  const date = new Date(saleDate).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  const payIcon: Record<string, string> = {
    cash: '💵', transfer: '🏦', pos: '💳', credit: '📋',
  }
  const itemLines = items.map(i =>
    `📦 *${i.item_name}* (${i.unit_label})\n   ${i.quantity} × ₦${Number(i.unit_price).toLocaleString()} = *₦${Number(i.total_amount).toLocaleString()}*`
  ).join('\n')

  return [
    `🏪 *${companyName}*`,
    `_${appName}_`,
    `━━━━━━━━━━━━━━━`,
    `🧾 *Sales Receipt*`,
    `━━━━━━━━━━━━━━━`,
    itemLines,
    `━━━━━━━━━━━━━━━`,
    `💰 *Total: ₦${total.toLocaleString()}*`,
    `${payIcon[paymentMethod] || '💳'} Payment: ${paymentMethod.toUpperCase()}`,
    customerName ? `👤 Customer: ${customerName}` : '',
    `📅 Date: ${date}`,
    notes ? `📝 ${notes}` : '',
    `━━━━━━━━━━━━━━━`,
    `🙏 Thank you for your patronage!`,
  ].filter(Boolean).join('\n')
}
