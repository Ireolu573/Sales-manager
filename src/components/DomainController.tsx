import { useState, useEffect } from 'react'
import type { CompanySettings, Product } from '@/lib/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Palette, Package, Users } from 'lucide-react'
import { BrandSettingsForm } from '@/features/tenant/components/BrandSettingsForm'
import { ProductManagementTable } from '@/features/tenant/components/ProductManagementTable'
import { StaffManagementTable, StaffMember } from '@/features/tenant/components/StaffManagementTable'
import { TenantService } from '@/services/tenant.service'
import { supabase } from '@/integrations/supabase/client'

interface Props {
  userId: string
  tenantId: string
  company: CompanySettings
  onClose: () => void
  onCompanyUpdated: (c: CompanySettings) => void
  onProductsChanged: () => void
}

export default function DomainController({ userId, tenantId, company, onClose, onCompanyUpdated, onProductsChanged }: Props) {
  const [tab, setTab] = useState<'brand' | 'products' | 'staff'>('brand')
  const [products, setProducts] = useState<Product[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [inviteCode, setInviteCode] = useState('')

  const reloadProducts = () => {
    TenantService.getProducts(tenantId).then(setProducts)
    onProductsChanged()
  }

  const reloadStaff = () => {
    supabase
      .from('profiles')
      .select('id, email, is_admin, permissions')
      .eq('tenant_id', tenantId)
      .then(({ data }) => {
        if (data) setStaff(data as unknown as StaffMember[])
      })
  }

  const reloadInviteCode = () => {
    supabase
      .from('tenants')
      .select('invite_code')
      .eq('id', tenantId)
      .single()
      .then(({ data }) => {
        if (data?.invite_code) setInviteCode(data.invite_code)
      })
  }

  useEffect(() => {
    TenantService.getProducts(tenantId).then(setProducts)
    reloadStaff()
    reloadInviteCode()
  }, [tenantId])

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl sm:rounded-lg p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold">Business Domain & Store Controller</DialogTitle>
        </DialogHeader>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b gap-2 pb-2">
          <Button
            variant={tab === 'brand' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('brand')}
            className={`flex-1 min-w-[140px] justify-center ${tab === 'brand' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
          >
            <Palette className="h-4 w-4 mr-1.5" /> Brand & Styling
          </Button>

          <Button
            variant={tab === 'products' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('products')}
            className={`flex-1 min-w-[140px] justify-center ${tab === 'products' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
          >
            <Package className="h-4 w-4 mr-1.5" /> Product Catalog ({products.length})
          </Button>

          <Button
            variant={tab === 'staff' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('staff')}
            className={`flex-1 min-w-[140px] justify-center ${tab === 'staff' ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}`}
          >
            <Users className="h-4 w-4 mr-1.5" /> Staff & Access
          </Button>
        </div>

        {/* Tab Contents */}
        <div className="pt-2">
          {tab === 'brand' && (
            <BrandSettingsForm
              tenantId={tenantId}
              company={company}
              onCompanyUpdated={onCompanyUpdated}
            />
          )}

          {tab === 'products' && (
            <ProductManagementTable
              tenantId={tenantId}
              products={products}
              onProductsChanged={reloadProducts}
            />
          )}

          {tab === 'staff' && (
            <StaffManagementTable
              userId={userId}
              tenantId={tenantId}
              staff={staff}
              inviteCode={inviteCode}
              onRegenerateCode={reloadInviteCode}
              onStaffUpdated={reloadStaff}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}