import { NavLink, Outlet } from 'react-router-dom'
import excalidrawLogo from '@/assets/excalidraw-logo.svg'
import {
  EXCALIDRAW_PLUS_TOOL_ROUTES,
} from '@/components/lego_blocks/units/ExcalidrawPlusRoutesBlock'

export default function ExcalidrawPlus() {
  return (
    <>
      <div className="ltm-shell-field-surface sticky top-[calc(var(--ltm-safe-top,0px)+10px)] z-10 mb-3 rounded-xl border border-border/60 bg-background/85 p-2 backdrop-blur">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60 p-1.5">
            <img src={excalidrawLogo} alt="Excalidraw logo" className="h-full w-full" />
          </span>
          <span className="mr-1 shrink-0 text-sm font-semibold tracking-tight">Excalidraw++</span>
          {EXCALIDRAW_PLUS_TOOL_ROUTES.map((tool) => (
            <NavLink
              key={tool.route}
              to={tool.route}
              end
              className={({ isActive }) => (
                `ltm-motion-fast shrink-0 rounded-md px-3 py-1.5 text-sm ${
                  isActive
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              )}
            >
              {tool.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </>
  )
}
