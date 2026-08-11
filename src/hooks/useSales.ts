import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SalesService, InsertSaleDTO } from '@/services/sales.service'

export function useSales(tenantId: string, userId?: string) {
  const queryClient = useQueryClient()

  const salesQuery = useQuery({
    queryKey: ['sales', tenantId, userId],
    queryFn: () => SalesService.getSales(tenantId, userId),
    enabled: Boolean(tenantId),
  })

  const addSaleMutation = useMutation({
    mutationFn: (saleData: InsertSaleDTO) => {
      if (!userId) throw new Error('User ID required')
      return SalesService.addSale(saleData, tenantId, userId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['analytics', tenantId] })
    },
  })

  const deleteSaleMutation = useMutation({
    mutationFn: (saleId: string) => SalesService.deleteSale(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['analytics', tenantId] })
    },
  })

  return {
    sales: salesQuery.data || [],
    isLoading: salesQuery.isLoading,
    isError: salesQuery.isError,
    error: salesQuery.error,
    refetch: salesQuery.refetch,
    addSale: addSaleMutation.mutateAsync,
    isAdding: addSaleMutation.isPending,
    deleteSale: deleteSaleMutation.mutateAsync,
    isDeleting: deleteSaleMutation.isPending,
  }
}
