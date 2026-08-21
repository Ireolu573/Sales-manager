import { useQuery } from '@tanstack/react-query'
import { StockService, type InventorySummary } from '@/services/stock.service'

export function useStock(tenantId?: string | null) {
  const { data, isLoading, isError, error, refetch } = useQuery<Record<string, InventorySummary>>({
    queryKey: ['inventorySummary', tenantId],
    queryFn: async () => {
      if (!tenantId) return {}
      return StockService.getInventorySummary(tenantId)
    },
    enabled: Boolean(tenantId),
    staleTime: 1000 * 30, // 30 seconds
  })

  return {
    inventorySummary: data ?? {},
    isLoading,
    isError,
    error,
    refetch,
  }
}

export default useStock
