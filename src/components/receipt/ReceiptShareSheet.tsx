/**
 * ReceiptShareSheet.tsx
 * Bottom sheet / modal shown after a sale is recorded.
 * Offers: Share Image (WhatsApp), Share Text (WhatsApp), Download PNG.
 * Also previews the receipt inline so the user can see it before sharing.
 */
import { useState } from 'react'
import { MessageCircle, Download, Image, X, Loader2, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ReceiptData } from './ReceiptCanvas'
import { useReceiptShare } from './useReceiptShare'
import ReceiptCanvas from './ReceiptCanvas'

interface Props {
  data: ReceiptData
  onClose: () => void
}

export default function ReceiptShareSheet({ data, onClose }: Props) {
  const { receiptRef, generating, shareAsImage, shareAsText, downloadReceipt } = useReceiptShare()
  const [showPreview, setShowPreview] = useState(false)

  const total = data.items.reduce((s, i) => s + Number(i.total_amount), 0)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

  return (
    <>
      {/* Hidden receipt node for html2canvas — always rendered */}
      <ReceiptCanvas ref={receiptRef} data={{ ...data, total }} />

      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={onClose}
      >
        <Card
          className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border-border/50 shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          <CardContent className="p-0">
            {/* Handle bar (mobile) */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border/50">
              <div>
                <h3 className="font-bold text-foreground text-base">🧾 Receipt Ready</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.items.length} item{data.items.length > 1 ? 's' : ''} · ₦{total.toLocaleString()}
                  {data.customerName ? ` · ${data.customerName}` : ''}
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview toggle */}
            <div className="px-5 py-2">
              <button
                onClick={() => setShowPreview(v => !v)}
                className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? 'Hide preview' : 'Preview receipt'}
              </button>
            </div>

            {/* Inline preview — scaled-down live render of the receipt */}
            {showPreview && (
              <div className="mx-5 mb-3 rounded-xl overflow-hidden border border-border/50 shadow-sm">
                <div
                  className="origin-top-left"
                  style={{ transform: 'scale(0.72)', width: '139%', transformOrigin: 'top left' }}
                >
                  <div style={{ width: 400, background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", color: '#1a1a1a' }}>
                    {/* Miniature static preview */}
                    <div style={{ background: data.brandColor || '#d97706', padding: '16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28 }}>{data.logoEmoji}</div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>{data.companyName}</div>
                    </div>
                    <div style={{ padding: '10px 16px' }}>
                      {data.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                          <span>{item.item_name} × {item.quantity}</span>
                          <strong>₦{Number(item.total_amount).toLocaleString()}</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontWeight: 700, fontSize: 14 }}>
                        <span>Total</span>
                        <span style={{ color: data.brandColor || '#d97706' }}>₦{total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 gap-2.5 px-5 pb-5">
              {/* Primary: share image */}
              <Button
                onClick={() => shareAsImage(data)}
                disabled={generating}
                className="w-full h-12 gap-2.5 font-semibold text-sm bg-green-500 hover:bg-green-600 text-white"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
                {generating
                  ? 'Generating image…'
                  : isMobile
                    ? 'Share Receipt Image (WhatsApp)'
                    : 'Share via WhatsApp + Download Image'
                }
              </Button>

              {/* Secondary: text receipt */}
              <Button
                onClick={() => shareAsText(data)}
                variant="outline"
                className="w-full h-11 gap-2 font-medium text-sm"
              >
                <MessageCircle className="w-4 h-4 text-green-500" />
                Send as Text Message (WhatsApp)
              </Button>

              {/* Tertiary: just download */}
              <Button
                onClick={() => downloadReceipt(data)}
                disabled={generating}
                variant="ghost"
                className="w-full h-10 gap-2 text-xs text-muted-foreground"
              >
                <Download className="w-3.5 h-3.5" />
                Download as PNG
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
