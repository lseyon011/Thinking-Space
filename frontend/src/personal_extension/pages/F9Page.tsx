import F9Orch from '../components/orchestrators/F9Orch'

interface F9PageProps {
  pageLabel?: string
}

export default function F9Page({ pageLabel }: F9PageProps) {
  const title = pageLabel?.trim() || 'Webull'
  return (
    <div className="ltm-page">
      <div className="ltm-page-shell ltm-shell-mega flex flex-col gap-4">
        <header>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
            <p className="text-sm text-muted-foreground">
              Personal market workspace with Webull-backed views.
            </p>
          </div>
        </header>
        <F9Orch />
      </div>
    </div>
  )
}
