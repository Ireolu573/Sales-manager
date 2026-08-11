import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TenantService } from '@/services/tenant.service'
import type { CompanySettings } from '@/lib/types'

export function useTenant(tenantId: string) {
  const queryClient = useQueryClient()

  const companySettingsQuery = useQuery({
    queryKey: ['companySettings', tenantId],
    queryFn: () => TenantService.getCompanySettings(tenantId),
    enabled: Boolean(tenantId),
  })

  const productsQuery = useQuery({
    queryKey: ['products', tenantId],
    queryFn: () => TenantService.getProducts(tenantId),
    enabled: Boolean(tenantId),
  })

  const updateCompanyMutation = useMutation({
    mutationFn: (settings: Partial<CompanySettings>) => TenantService.updateCompanySettings(tenantId, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companySettings', tenantId] })
    },
  })

  const addProductMutation = useMutation({
    mutationFn: ({ name, units }: { name: string; units: { unit_label: string; unit_price: number }[] }) =>
      TenantService.addProduct(name, tenantId, units),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => TenantService.deleteProduct(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', tenantId] })
    },
  })

  return {
    companySettings: companySettingsQuery.data,
    products: productsQuery.data || [],
    isLoadingCompany: companySettingsQuery.isLoading,
    isLoadingProducts: productsQuery.isLoading,
    updateCompany: updateCompanyMutation.mutateAsync,
    addProduct: addProductMutation.mutateAsync,
    deleteProduct: deleteProductMutation.mutateAsync,
    refetchProducts: productsQuery.refetch,
  }
}
