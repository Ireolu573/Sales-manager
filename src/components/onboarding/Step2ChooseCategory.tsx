import { Card, CardContent } from '@/components/ui/card'
import { CATEGORY_PRESETS, type CategoryPreset } from './onboardingData'

interface Props {
  onSelect: (preset: CategoryPreset) => void
}

export default function Step2ChooseCategory({ onSelect }: Props) {
  return (
    <Card className="slide-up shadow-xl border-border">
      <CardContent className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Pick what you sell most. You can add more later in Settings.
        </p>

        <div className="grid grid-cols-2 gap-3">
          {CATEGORY_PRESETS.map(preset => (
            <button
              key={preset.key}
              onClick={() => onSelect(preset)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-center"
            >
              <span className="text-3xl">{preset.emoji}</span>
              <span className="text-sm font-semibold text-foreground">{preset.label}</span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
