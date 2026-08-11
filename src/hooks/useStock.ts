import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StockService, InsertStockDTO } from '@/services/stock.service'

export function useStock(tenantId: string, userId?: string) {
  const queryClient = useQueryClient()

  const stockQuery = useQuery({
    queryKey: ['stock', tenantId, userId],
    queryFn: () => StockService.getStockRecords(tenantId, userId),
    enabled: Boolean(tenantId),
  })

  const inventorySummaryQuery = useQuery({
    queryKey: ['inventorySummary', tenantId],
    queryFn: () => StockService.getInventorySummary(tenantId),
    enabled: Boolean(tenantId),
  })

  const addStockMutation = useMutation({
    mutationFn: (record: InsertStockDTO) => {
      if (!userId) throw new Error('User ID required')
      return StockService.addStockRecord(record, tenantId, userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['inventorySummary', tenantId] })
    },
  })

  const deleteStockMutation = useMutation({
    mutationFn: (recordId: string) => StockService.deleteStockRecord(recordId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['inventorySummary', tenantId] })
    },
  })

  return {
    stockRecords: stockQuery.data || [],
    inventorySummary: inventorySummaryQuery.data || {},
    isLoading: stockQuery.isLoading,
    isError: stockQuery.isError,
    refetch: stockQuery.refetch,
    addStockRecord: addStockMutation.mutateAsync,
    isAdding: addStockMutation.isPending,
    deleteStockRecord: deleteStockMutation.mutateAsync,
    isDeleting: deleteStockMutation.isPending,
  }
}

