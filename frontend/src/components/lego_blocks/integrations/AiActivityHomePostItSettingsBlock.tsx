import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import { Switch } from '@/components/lego_blocks/units/ui/switch'
import {
  getAiActivityHomePostItEnabled,
  setAiActivityHomePostItEnabled,
} from '@/services/lego_blocks/units/storageKeyBlock'

export default function AiActivityHomePostItSettingsBlock() {
  const [enabled, setEnabled] = useState<boolean>(() => getAiActivityHomePostItEnabled())

  const toggle = (checked: boolean) => {
    setAiActivityHomePostItEnabled(checked)
    setEnabled(checked)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Home canvas</CardTitle>
        <CardDescription>
          Controls AI-activity surfaces drawn onto the home canvas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <label className="flex items-start justify-between gap-4 rounded-md border border-border/60 px-3 py-2.5">
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm font-medium text-foreground">Auto-draft daily activity post-it</div>
            <p className="text-xs text-muted-foreground">
              Pins a "what I did with AI today" post-it to the home canvas and appends new
              sessions to it through the day. The This Week digest card now covers the same
              ground, so this is off by default. Existing post-its are left alone when off.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            aria-label="Auto-draft daily AI activity post-it on the home canvas"
          />
        </label>
      </CardContent>
    </Card>
  )
}
