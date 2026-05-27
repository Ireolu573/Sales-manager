/**
 * offlineQueue.ts
 * Offline sale queue: saves sales to localStorage when offline,
 * flushes them to Supabase when the connection is restored.
 */

import { insertSale } from '@/lib/tenant-queries'

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
    id: crypto.randomUUID(),
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
      const { error } = await insertSale(item.saleData, item.tenantId, item.userId)
      if (error) {
        remaining.push(item)
      } else {
        synced++
        onProgress?.(synced, queue.length)
      }
    } catch {
      remaining.push(item)
    }
  }

  saveQueue(remaining)
  return synced
}
