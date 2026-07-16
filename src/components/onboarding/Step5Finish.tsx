import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

interface Props {
  companyName: string
  logoEmoji: string
  productCount: number
  onFinish: () => void
  finishing: boolean
}

export default function Step5Finish({ companyName, logoEmoji, productCount, onFinish, finishing }: Props) {
  return (
    <Card className="slide-up shadow-xl border-border">
      <CardContent className="p-6 space-y-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <span className="text-3xl">{logoEmoji}</span>
        </div>

        <div>
          <h2 className="font-bold text-lg text-foreground">{companyName} is ready</h2>
          <p className="text-sm text-muted-foreground mt-1">Here's what's set up so far</p>
        </div>

        <div className="space-y-2 text-left">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            Business profile created
          </div>
          <div className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            {productCount > 0 ? `${productCount} product(s) added` : 'You can add products anytime in Settings'}
          </div>
        </div>

        <Button onClick={onFinish} disabled={finishing} className="w-full h-11 font-semibold">
          {finishing ? 'Finishing up...' : 'Go to Dashboard'}
        </Button>
      </CardContent>
    </Card>
  )
}
