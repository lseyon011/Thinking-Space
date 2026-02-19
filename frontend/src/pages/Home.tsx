import { Link } from 'react-router-dom'
import { Button } from '@/components/lego_blocks/ui/button'
import { ArrowRight } from 'lucide-react'
import Starfield from '@/components/lego_blocks/StarfieldBlock'
import TodayFileActivityOrch from '@/components/orchestrators/TodayFileActivityOrch'

export default function Home() {
  return (
    <div className="relative ltm-page overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.25),transparent_60%),radial-gradient(900px_500px_at_80%_0%,rgba(168,85,247,0.18),transparent_55%),radial-gradient(800px_500px_at_50%_100%,rgba(16,185,129,0.12),transparent_55%)]" />
        <Starfield />
        <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-transparent to-background/60" />
      </div>

      <div className="relative z-10 ltm-page-shell ltm-shell-medium py-12 md:py-16">
        <header className="text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
            Thinking Space
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-foreground md:text-6xl">
            Welcome, Anurag
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            A calm, focused control panel for your vault. Pick a tool from the top bar to
            begin, or jump straight into your most-used workflows.
          </p>
        </header>

        <div className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">Most used tool</h2>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild className="h-11 px-5">
              <Link to="/new-thought">
                New Thought
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/todos">
                Todos
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/transcript-cleaner">
                Transcript Cleaner
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/pdf-to-markdown">
                PDF to Markdown
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/git-insights">
                Git Insights
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/format-excalidraw">
                Format for Excalidraw
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 px-5">
              <Link to="/mindmap-builder">
                Mindmap Builder
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold">What you did today</h2>
            <Link to="/git-insights" className="text-sm text-muted-foreground hover:text-foreground">
              Open insights
            </Link>
          </div>
          <div className="mt-4">
            <TodayFileActivityOrch />
          </div>
        </section>

        
      </div>
    </div>
  )
}
