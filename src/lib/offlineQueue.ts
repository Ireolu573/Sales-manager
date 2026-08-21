/**
 * offlineQueue.ts
 * Offline sale queue: saves sales to localStorage when offline,
 * flushes them to Supabase when the connection is restored.
 */

import { insertSale } from '@/lib/tenant-queries'
import { SalesService, type RecordSaleTransactionDTO } from '@/services/sales.service'
import { generateUUID } from '@/lib/utils'

export interface QueuedSale {
  id: string
  saleData: Record<string, unknown>
  tenantId: string
  userId: string
  queuedAt: string
}

const QUEUE_KEY = 'offline_sale_queue'

export function getQueue(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveQueue(queue: QueuedSale[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function enqueueSale(
  saleData: Record<string, unknown>,
  tenantId: string,
  userId: string
): void {
  const queue = getQueue()
  queue.push({
    id: generateUUID(),
    saleData,
    tenantId,
    userId,
    queuedAt: new Date().toISOString(),
  })
  saveQueue(queue)
}

export function getQueueLength(): number {
  return getQueue().length
}

/**
 * Flush all queued sales to Supabase.
 * Returns the number of successfully synced sales.
 */
export async function flushQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<number> {
  const queue = getQueue()
  if (queue.length === 0) return 0

  let synced = 0
  const remaining: QueuedSale[] = []

  for (const item of queue) {
    try {
      if ('__transaction' in item.saleData) {
        await SalesService.recordTransaction((item.saleData.__transaction as RecordSaleTransactionDTO), item.tenantId)
      } else {
        throw new Error('Direct sales table writes are disabled. Use the secure record_sales_transaction RPC instead.')
      }
      synced++
      onProgress?.(synced, queue.length)
    } catch {
      remaining.push(item)
    }
  }

  saveQueue(remaining)
  return synced
}
