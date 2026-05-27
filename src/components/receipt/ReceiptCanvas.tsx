/**
 * ReceiptCanvas.tsx
 * A hidden, pixel-perfect receipt DOM node that html2canvas renders into an image.
 * Rendered off-screen (position: fixed, left: -9999px) so it never appears in the UI.
 *
 * Usage: pass a ref, then call html2canvas(ref.current) to get a canvas.
 */
import { forwardRef } from 'react'

export interface ReceiptItem {
  item_name: string
  unit_label: string
  quantity: number
  unit_price: number
  total_amount: number
}

export interface ReceiptData {
  items: ReceiptItem[]
  total: number
  paymentMethod: string
  customerName: string
  saleDate: string
  notes: string
  companyName: string
  appName: string
  logoEmoji: string
  brandColor: string
}

const ReceiptCanvas = forwardRef<HTMLDivElement, { data: ReceiptData }>(
  ({ data }, ref) => {
    const {
      items, total, paymentMethod, customerName,
      saleDate, notes, companyName, appName, logoEmoji, brandColor,
    } = data

    const dateStr = new Date(saleDate).toLocaleDateString('en-NG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })

    const payIcon: Record<string, string> = {
      cash: '💵', transfer: '🏦', pos: '💳', credit: '📋',
    }

    const receiptNo = `RCP-${Date.now().toString(36).toUpperCase().slice(-6)}`

    return (
      <div
        ref={ref}
        style={{
          position: 'fixed',
          left: '-9999px',
          top: 0,
          width: '400px',
          background: '#ffffff',
          fontFamily: "'Segoe UI', Arial, sans-serif",
          color: '#1a1a1a',
          padding: '0',
          boxSizing: 'border-box',
        }}
      >
        {/* Header band */}
        <div style={{
          background: brandColor || '#d97706',
          padding: '24px 24px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, lineHeight: 1, marginBottom: 8 }}>{logoEmoji}</div>
          <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: 0.5 }}>{companyName}</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>{appName}</div>
        </div>

        {/* Receipt label */}
        <div style={{
          background: '#f8f8f8',
          borderBottom: '1px solid #e5e5e5',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: 1, color: '#555', textTransform: 'uppercase' }}>
            🧾 Sales Receipt
          </span>
          <span style={{ fontSize: 11, color: '#999', fontFamily: 'monospace' }}>{receiptNo}</span>
        </div>

        {/* Meta row */}
        <div style={{ padding: '12px 24px 8px', borderBottom: '1px dashed #e5e5e5' }}>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📅 {dateStr}</div>
          {customerName && (
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>👤 {customerName}</div>
          )}
          <div style={{ fontSize: 12, color: '#666' }}>
            {payIcon[paymentMethod] || '💰'} Payment: <strong style={{ color: '#1a1a1a' }}>{paymentMethod.toUpperCase()}</strong>
          </div>
        </div>

        {/* Items */}
        <div style={{ padding: '12px 24px' }}>
          {/* Column headers */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#999',
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: 8,
            paddingBottom: 6,
            borderBottom: '1px solid #eee',
          }}>
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: 60, textAlign: 'right' }}>Qty</span>
            <span style={{ width: 80, textAlign: 'right' }}>Price</span>
            <span style={{ width: 90, textAlign: 'right' }}>Amount</span>
          </div>

          {items.map((item, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              padding: '7px 0',
              borderBottom: i < items.length - 1 ? '1px solid #f5f5f5' : 'none',
            }}>
              <div style={{ flex: 1, paddingRight: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{item.item_name}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{item.unit_label}</div>
              </div>
              <div style={{ width: 60, textAlign: 'right', fontSize: 12, color: '#555', paddingTop: 2 }}>
                {item.quantity}
              </div>
              <div style={{ width: 80, textAlign: 'right', fontSize: 12, color: '#555', paddingTop: 2 }}>
                ₦{Number(item.unit_price).toLocaleString()}
              </div>
              <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 600, paddingTop: 2 }}>
                ₦{Number(item.total_amount).toLocaleString()}
              </div>
            </div>
          ))}
        </div>

        {/* Total band */}
        <div style={{
          background: brandColor || '#d97706',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: 600 }}>TOTAL</span>
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            ₦{total.toLocaleString()}
          </span>
        </div>

        {/* Notes */}
        {notes && (
          <div style={{
            padding: '10px 24px',
            background: '#fffbf5',
            borderTop: '1px solid #ffe4a0',
            fontSize: 11,
            color: '#7a6000',
          }}>
            📝 {notes}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px 20px',
          textAlign: 'center',
          borderTop: '1px dashed #e5e5e5',
        }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🙏</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', marginBottom: 4 }}>
            Thank you for your patronage!
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            {companyName} • {appName}
          </div>
        </div>
      </div>
    )
  }
)

ReceiptCanvas.displayName = 'ReceiptCanvas'
export default ReceiptCanvas
