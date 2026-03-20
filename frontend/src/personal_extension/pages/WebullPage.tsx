import WebullOrch from '../components/orchestrators/WebullOrch'

interface WebullPageProps {
  pageLabel?: string
}

export default function WebullPage({ pageLabel }: WebullPageProps) {
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
        <WebullOrch />
      </div>
    </div>
  )
}
