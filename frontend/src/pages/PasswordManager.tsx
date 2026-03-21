import PasswordManagerOrch from '@/components/orchestrators/PasswordManagerOrch'

export default function PasswordManager() {
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-wide space-y-4">
        <header>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]" aria-hidden="true">
                <path d="M7 10V7a5 5 0 1 1 10 0v3" />
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M12 14v2.5" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Password Manager</h1>
              <p className="text-sm text-muted-foreground">
                Store credentials in an encrypted vault file inside Thinking Space so they can travel with your synced workspace across devices.
              </p>
            </div>
          </div>
        </header>
        <PasswordManagerOrch />
      </div>
    </div>
  )
}
