export interface StarterProduct {
  name: string
  units: { unit_label: string; unit_price: string }[]
}

export interface CategoryPreset {
  key: string
  label: string
  emoji: string
  products: StarterProduct[]
}

// Starter templates. Prices are left at 0 so the user sets their own — only
// names and common units are pre-filled to save typing.
export const CATEGORY_PRESETS: CategoryPreset[] = [
  {
    key: 'poultry_feed',
    label: 'Poultry Feed',
    emoji: '🐔',
    products: [
      { name: 'Grower Feed', units: [{ unit_label: 'bag', unit_price: '' }] },
      { name: 'Layer Feed', units: [{ unit_label: 'bag', unit_price: '' }] },
      { name: 'Starter Feed', units: [{ unit_label: 'bag', unit_price: '' }] },
    ],
  },
  {
    key: 'day_old_chicks',
    label: 'Day Old Chicks',
    emoji: '🐣',
    products: [
      { name: 'Broiler Chicks', units: [{ unit_label: 'bird', unit_price: '' }] },
      { name: 'Layer Chicks', units: [{ unit_label: 'bird', unit_price: '' }] },
    ],
  },
  {
    key: 'eggs',
    label: 'Eggs',
    emoji: '🥚',
    products: [
      { name: 'Crate of Eggs', units: [{ unit_label: 'crate', unit_price: '' }] },
    ],
  },
  {
    key: 'vaccines',
    label: 'Vaccines & Supplements',
    emoji: '💉',
    products: [
      { name: 'Newcastle Vaccine', units: [{ unit_label: 'unit', unit_price: '' }] },
      { name: 'Vitamin Supplement', units: [{ unit_label: 'sachet', unit_price: '' }] },
    ],
  },
  {
    key: 'custom',
    label: 'Custom',
    emoji: '✏️',
    products: [],
  },
]
