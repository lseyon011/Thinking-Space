import { KeyRound, Loader2, LockOpen, Plus, Save } from 'lucide-react'
import { Button } from '@/components/lego_blocks/units/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/lego_blocks/units/ui/card'
import type { PasswordVaultEntryBlock } from '@/services/orchestrators/passwordManagerOrch'

interface PasswordAutofillOverlayBlockProps {
  hostname: string
  locked: boolean
  unlockPassphrase: string
  onUnlockPassphraseChange: (value: string) => void
  onUnlock: () => void
  unlocking: boolean
  matches: PasswordVaultEntryBlock[]
  onFill: (entry: PasswordVaultEntryBlock) => void
  filling: boolean
  canSave: boolean
  saveLabel: string
  onSave: () => void
  saving: boolean
  onOpenManager: () => void
  usernameValue: string
  error?: string | null
}

export default function PasswordAutofillOverlayBlock({
  hostname,
  locked,
  unlockPassphrase,
  onUnlockPassphraseChange,
  onUnlock,
  unlocking,
  matches,
  onFill,
  filling,
  canSave,
  saveLabel,
  onSave,
  saving,
  onOpenManager,
  usernameValue,
  error,
}: PasswordAutofillOverlayBlockProps) {
  return (
    <Card className="w-[20rem] border-border/70 bg-background/95 shadow-2xl backdrop-blur-sm">
      <CardHeader className="space-y-1.5 pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
            <KeyRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate text-sm">Passwords for {hostname}</CardTitle>
            <CardDescription className="truncate text-xs">
              {locked ? 'Unlock once to fill and save here.' : 'Fast fill and save from your encrypted vault.'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {locked ? (
          <>
            <div className="space-y-2">
              <label htmlFor="ltm-password-autofill-passphrase" className="text-xs font-medium text-foreground">
                Passphrase
              </label>
              <input
                id="ltm-password-autofill-passphrase"
                type="password"
                value={unlockPassphrase}
                onChange={(event) => onUnlockPassphraseChange(event.target.value)}
                placeholder="Unlock password vault"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
            <Button type="button" onClick={onUnlock} disabled={unlocking} className="w-full">
              {unlocking
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <LockOpen className="mr-2 h-4 w-4" />}
              {unlocking ? 'Unlocking...' : 'Unlock Passwords'}
            </Button>
          </>
        ) : (
          <>
            {matches.length > 0 ? (
              <div className="space-y-2">
                {matches.map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{entry.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {entry.username || 'No username'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onFill(entry)}
                      disabled={filling}
                    >
                      Fill
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
                No saved passwords for this site yet.
              </div>
            )}

            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/15 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-medium text-foreground">
                  {canSave ? 'Ready to store current login' : 'Type into the site to enable save'}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {usernameValue.trim() || 'Current username not detected yet'}
                </div>
              </div>
              <Button type="button" size="sm" onClick={onSave} disabled={!canSave || saving}>
                {saving
                  ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  : matches.length > 0 ? <Save className="mr-2 h-3.5 w-3.5" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
                {saveLabel}
              </Button>
            </div>
          </>
        )}

        <Button type="button" variant="ghost" size="sm" onClick={onOpenManager} className="w-full">
          Open Password Manager
        </Button>
      </CardContent>
    </Card>
  )
}
