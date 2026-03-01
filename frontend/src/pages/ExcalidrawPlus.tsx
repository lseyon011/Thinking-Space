import { NavLink, Outlet } from 'react-router-dom'
import {
  EXCALIDRAW_PLUS_TOOL_ROUTES,
} from '@/components/lego_blocks/units/ExcalidrawPlusRoutesBlock'

export default function ExcalidrawPlus() {
  return (
    <>
      <div className="sticky top-[calc(var(--ltm-safe-top,0px)+10px)] z-10 mb-4">
        <div className="mb-2 text-center text-xl font-semibold tracking-tight sm:text-2xl">
          Excalidraw++
        </div>
        <div className="flex justify-center">
          <div className="flex max-w-full items-center gap-2 overflow-x-auto px-1 py-1">
          {EXCALIDRAW_PLUS_TOOL_ROUTES.map((tool) => (
            <NavLink
              key={tool.route}
              to={tool.route}
              end
              className={({ isActive }) => (
                `ltm-motion-fast shrink-0 rounded-md px-3 py-1.5 text-sm font-medium ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`
              )}
            >
              {tool.label}
            </NavLink>
          ))}
          </div>
        </div>
      </div>
      <Outlet />
    </>
  )
}
