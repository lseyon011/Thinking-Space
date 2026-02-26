import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/lego_blocks/units/ui/card'
import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface ToolCardProps {
  title: string
  description: string
  to: string
  icon: LucideIcon
  available?: boolean
}

export function ToolCard({ title, description, to, icon: Icon, available = true }: ToolCardProps) {
  if (!available) {
    return (
      <Card className="opacity-50 cursor-not-allowed">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle>{title}</CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </div>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
              Coming soon
            </span>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Link to={to}>
      <Card className="cursor-pointer group">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="group-hover:text-primary transition-colors">
                  {title}
                </CardTitle>
                <CardDescription className="mt-1">{description}</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}
