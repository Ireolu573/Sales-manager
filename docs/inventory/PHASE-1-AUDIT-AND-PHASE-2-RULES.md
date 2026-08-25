# Sales Manager Inventory System

## Phase 1 Audit Findings

### Confirmed architecture

- `products` identifies the canonical product.
- `product_units` defines selling/stocking units and their `base_unit_quantity` conversion.
- `stock_records` represents stock entering inventory.
- `sales` represents stock leaving inventory.
- `record_sales_transaction()` is the authoritative sales transaction path.
- `get_inventory_summary()` is the authoritative inventory reporting path.

### Critical findings

1. Two `StockForm` components exist.
   - Legacy: `src/components/StockForm.tsx`
   - Canonical: `src/features/inventory/components/StockForm.tsx`
   - `Dashboard.tsx` currently imports the legacy component.
2. The legacy stock form does not populate `base_quantity` or `base_cost`.
3. The canonical stock form calculates `base_quantity` using the selected unit conversion.
4. Inventory reporting depends on `stock_records.base_quantity`, so NULL historical values can disappear from the RPC result.
5. The sales transaction path and inventory summary have different product matching behavior. Sales historically allowed name matching while inventory reporting primarily relied on `product_id`.
6. Sale success invalidates the inventory query. Legacy stock entry does not reliably invalidate the same query, causing stale UI state.
7. Stock record deletion exists and can destroy historical inventory evidence. This should later be replaced with an auditable adjustment/reversal workflow.

### Required Phase 1 follow-up

Before historical backfill, inspect all `stock_records` with NULL `base_quantity` and determine the correct unit conversion using the record's product and unit label. Do not run a blanket product-level update where multiple units can exist for one product.

---

# Phase 2: Inventory Rules

## Rule 1: Stock In

Every legitimate stock receipt creates a new `stock_records` row. Historical stock receipts must not be overwritten to represent a later restock.

Required identity and accounting fields include:

- `tenant_id`
- `product_id`
- `item_name`
- `unit_label`
- `quantity`
- `base_quantity`
- `cost_price`
- `base_cost`
- `stock_date`

## Rule 2: Base Unit Is the Inventory Currency

All inventory availability calculations use base units.

`base_quantity = quantity * product_units.base_unit_quantity`

Example:

- 1 carton = 24 bottles
- 5 cartons stocked = 120 base units
- 2 cartons sold = 48 base units
- 72 base units remain

## Rule 3: Sales Are Stock Out

A completed sale creates a `sales` record through `record_sales_transaction()`.

The sales record must contain the correctly converted `base_quantity`.

## Rule 4: Available Inventory

The canonical calculation is:

`available = total_stocked_base_quantity - total_sold_base_quantity`

Inventory must not be calculated from frontend-only state.

## Rule 5: PostgreSQL Is Authoritative

The frontend can display inventory and perform user-facing validation, but PostgreSQL makes the final stock-availability decision.

## Rule 6: Canonical Product Identity

`product_id` is the canonical identity connecting stock, sales, units, and inventory.

`item_name` is descriptive data and must not be the long-term source of truth for product identity.

Name-based matching should be removed or retained only as a controlled migration/repair mechanism.

## Rule 7: Tenant Isolation

Every inventory read and write must be scoped to the authenticated business tenant.

No tenant may read, modify, or consume another tenant's inventory.

## Rule 8: Restocking

Restocking adds inventory by inserting a new stock receipt. It does not directly mutate an aggregate `current_stock` value.

Example:

- Original stock: 30
- Restock: 9
- Total stocked: 39
- Sold: 31
- Available: 8

## Rule 9: No Silent Inventory Loss

A NULL or invalid `base_quantity` must not silently become zero in authoritative inventory reporting. Invalid records must be surfaced for repair.

## Rule 10: Atomic Sales

Sales must remain atomic. Inventory validation, sale insertion, and accounting calculations must succeed together or fail together.

## Rule 11: Inventory Refresh

After a successful restock or sale, the application must invalidate/refetch the inventory summary for the active tenant so the UI reflects the database immediately.

## Rule 12: Historical Corrections

Historical stock should not be silently edited to fix discrepancies. Future corrections should use auditable inventory adjustments, reversals, returns, damage/loss records, or opening-balance entries.

## Rule 13: Negative Inventory

Normal sales must not reduce available inventory below zero. Any override must be explicit, authorized, and recorded with a reason.

## Rule 14: COGS

Cost accounting continues to use the existing weighted-average transaction logic. Inventory fixes must not bypass or duplicate the existing COGS calculation.

---

# Phase 2 Implementation Sequence

1. Make `src/features/inventory/components/StockForm.tsx` the only production stock-entry component.
2. Search the repository for all imports/usages of the legacy `StockForm` before deleting it.
3. Verify exact unit selection is used to calculate `base_quantity` and `base_cost`.
4. Audit NULL `base_quantity` records before backfill.
5. Make inventory summary and sales transaction use canonical `product_id` identity.
6. Add immediate inventory query invalidation after successful stock insertion.
7. Verify sale invalidation remains intact.
8. Add regression tests for restock, sale, unit conversion, tenant isolation, and insufficient stock.
9. Only after validation, reconcile historical Booster inventory.

# Acceptance Criteria

- A restock of N base units increases available inventory by N immediately.
- A sale of N base units decreases available inventory by N immediately.
- Unit conversions are applied consistently in stock and sales.
- Inventory summary and sale validation return the same available quantity.
- Stock from one tenant never appears in another tenant's inventory.
- Historical stock records remain auditable.
- Invalid legacy records are identified instead of silently disappearing.
- The Booster discrepancy is resolved using evidence, not a manual UI number change.
