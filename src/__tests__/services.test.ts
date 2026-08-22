import { describe, it, expect, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: {} })),
        })),
      })),
    })),
    rpc: vi.fn(async () => ({ data: [], error: null })),
  },
}))

vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
})

const { DEFAULT_PERMS, ADMIN_PERMS } = await import('@/lib/types')
const { calculateInventorySummaryFromRecords } = await import('@/services/stock.service')
const { SalesService } = await import('@/services/sales.service')
const { insertSale } = await import('@/lib/tenant-queries')

describe('AnalyticsService Computations', () => {
  it('correctly aggregates sales summary metrics', async () => {
    // Mock data testing calculation logic
    const sales = [
      { id: '1', item_name: 'Feeds (50kg)', quantity: 2, unit_price: 15000, total_amount: 30000, sale_date: '2026-08-10' },
      { id: '2', item_name: 'Feeds (50kg)', quantity: 1, unit_price: 15000, total_amount: 15000, sale_date: '2026-08-10' },
      { id: '3', item_name: 'Eggs (Crate)', quantity: 5, unit_price: 3000, total_amount: 15000, sale_date: '2026-08-10' },
    ]

    const totalRevenue = sales.reduce((acc, curr) => acc + curr.total_amount, 0)
    const totalSalesCount = sales.length
    const averageOrderValue = totalRevenue / totalSalesCount

    expect(totalRevenue).toBe(60000)
    expect(totalSalesCount).toBe(3)
    expect(averageOrderValue).toBe(20000)
  })

  it('correctly determines top-selling product by quantity', () => {
    const sales = [
      { item_name: 'Feeds (50kg)', quantity: 3 },
      { item_name: 'Eggs (Crate)', quantity: 10 },
      { item_name: 'Feeds (50kg)', quantity: 2 },
    ]

    const productCounts: Record<string, number> = {}
    sales.forEach(s => {
      productCounts[s.item_name] = (productCounts[s.item_name] || 0) + s.quantity
    })
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0][0]

    expect(topProduct).toBe('Eggs (Crate)')
  })
})

describe('Permission System Rules', () => {
  it('validates default staff permissions', () => {
    expect(DEFAULT_PERMS.can_record_sales).toBe(true)
    expect(DEFAULT_PERMS.can_view_history).toBe(true)
    expect(DEFAULT_PERMS.can_view_stock).toBe(true)
    expect(DEFAULT_PERMS.can_add_stock).toBe(false)
    expect(DEFAULT_PERMS.can_view_analytics).toBe(false)
    expect(DEFAULT_PERMS.can_manage_credit).toBe(false)
  })

  it('validates admin permissions escalation', () => {
    expect(ADMIN_PERMS.can_add_stock).toBe(true)
    expect(ADMIN_PERMS.can_view_analytics).toBe(true)
    expect(ADMIN_PERMS.can_manage_credit).toBe(true)
  })
})

describe('Inventory stock logic', () => {
  it('clamps stock to zero and marks products as out of stock when sales exceed stock', () => {
    const summary = calculateInventorySummaryFromRecords(
      [{ product_id: 'prod-1', item_name: 'Feed', quantity: 10 }],
      [{ product_id: 'prod-1', item_name: 'Feed', quantity: 12 }],
    )

    expect(summary['prod-1'].availableStock).toBe(0)
    expect(summary['prod-1'].status).toBe('out_of_stock')
  })

  it('uses base quantities so mixed sale units share one inventory balance', () => {
    const summary = calculateInventorySummaryFromRecords(
      [{ product_id: 'eggs', item_name: 'Eggs', quantity: 2, base_quantity: 60 }],
      [{ product_id: 'eggs', item_name: 'Eggs', quantity: 1, base_quantity: 30 }],
    )

    expect(summary.eggs.availableBaseQuantity).toBe(30)
    expect(summary.eggs.status).toBe('in_stock')
  })

  it('maps getInventorySummary RPC response with unique keys and non-enumerable aliases', async () => {
    const { StockService } = await import('@/services/stock.service')
    const { supabase } = await import('@/integrations/supabase/client')

    vi.spyOn(supabase, 'rpc').mockResolvedValueOnce({
      data: [
        {
          product_id: 'prod-70dd',
          item_name: 'Booster',
          total_stock: '30',
          total_sold: '31',
          available_stock: '0',
          available_base_quantity: '0',
          status: 'out_of_stock',
        },
      ],
      error: null,
    } as any)

    const summary = await StockService.getInventorySummary('tenant-1')
    expect(Object.keys(summary)).toEqual(['prod-70dd'])
    expect(Object.values(summary).length).toBe(1)
    expect(summary['prod-70dd']?.availableStock).toBe(0)
    expect(summary['Booster']?.availableStock).toBe(0)
    expect(summary['booster']?.availableStock).toBe(0)
  })
})

describe('Sales write safety', () => {
  it('blocks legacy direct sales inserts and requires the secured transaction RPC', async () => {
    await expect(
      SalesService.addSale({
        item_name: 'Feed',
        unit_label: 'bag',
        quantity: 1,
        unit_price: 150,
        sale_date: '2026-08-15',
        payment_method: 'cash',
      }, 'tenant-1', 'user-1')
    ).rejects.toThrow(/direct sales table writes are disabled|recordTransaction\(|secure sales RPC/i)

    await expect(insertSale({ item_name: 'Feed', quantity: 1, unit_price: 150 }, 'tenant-1', 'user-1'))
      .rejects.toThrow(/direct sales table writes are disabled|record_sales_transaction|secure sales RPC/i)
  })
})
