import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { isElectron } from '@/services/orchestrators/runtimeOrch'

// VS Code integrated terminal color palette (distinct from syntax-highlight colors)
const VSCODE_THEME = {
  background: '#1e1e1e',
  foreground: '#cccccc',
  cursor: '#cccccc',
  cursorAccent: '#1e1e1e',
  selectionBackground: '#264f78',
  selectionForeground: '#ffffff',
  black:          '#000000',
  red:            '#cd3131',
  green:          '#0dbc79',
  yellow:         '#e5e510',
  blue:           '#2472c8',
  magenta:        '#bc3fbc',
  cyan:           '#11a8cd',
  white:          '#e5e5e5',
  brightBlack:    '#666666',
  brightRed:      '#f14c4c',
  brightGreen:    '#23d18b',
  brightYellow:   '#f5f543',
  brightBlue:     '#3b8eea',
  brightMagenta:  '#d670d6',
  brightCyan:     '#29b8db',
  brightWhite:    '#e5e5e5',
}

export interface TerminalBlockProps {
  cwd?: string
  className?: string
  onExit?: (exitCode: number) => void
}

export default function TerminalBlock({ cwd, className = '', onExit }: TerminalBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Stable refs so effects don't re-run on prop changes
  const cwdRef = useRef(cwd)
  const onExitRef = useRef(onExit)
  useEffect(() => { cwdRef.current = cwd }, [cwd])
  useEffect(() => { onExitRef.current = onExit }, [onExit])

  useEffect(() => {
    if (!isElectron() || !containerRef.current) return

    const api = window.electronAPI!
    const container = containerRef.current

    // -- xterm setup --
    const term = new Terminal({
      theme: VSCODE_THEME,
      fontFamily: "'Menlo', 'Cascadia Code', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 5000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(container)

    // Fit after a frame so the container has rendered dimensions
    requestAnimationFrame(() => { fitAddon.fit() })

    // -- PTY lifecycle --
    let terminalId: string | null = null
    let unsubData: (() => void) | null = null
    let unsubExit: (() => void) | null = null
    let inputDisposable: { dispose(): void } | null = null
    let resizeDisposable: { dispose(): void } | null = null
    let destroyed = false

    const { cols, rows } = term

    api.terminalCreate!({ cwd: cwdRef.current, cols, rows }).then(({ id }) => {
      if (destroyed) {
        void api.terminalKill!(id)
        return
      }

      terminalId = id

      // PTY → xterm
      unsubData = api.onTerminalData!(id, (data) => { term.write(data) })

      // PTY exit
      unsubExit = api.onTerminalExit!(id, (exitCode) => {
        term.writeln(`\r\n\x1b[2m[Process exited with code ${exitCode}]\x1b[0m`)
        onExitRef.current?.(exitCode)
      })

      // xterm input → PTY
      inputDisposable = term.onData((data) => {
        void api.terminalInput!(id, data)
      })

      // xterm resize → PTY
      resizeDisposable = term.onResize(({ cols: c, rows: r }) => {
        void api.terminalResize!(id, c, r)
      })
    }).catch((err: unknown) => {
      term.writeln(`\r\n\x1b[31m[Failed to create terminal: ${err instanceof Error ? err.message : String(err)}]\x1b[0m`)
    })

    // Resize observer: refit when container dimensions change
    const resizeObserver = new ResizeObserver(() => { fitAddon.fit() })
    resizeObserver.observe(container)

    return () => {
      destroyed = true
      resizeObserver.disconnect()
      inputDisposable?.dispose()
      resizeDisposable?.dispose()
      unsubData?.()
      unsubExit?.()
      if (terminalId) void api.terminalKill!(terminalId)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — terminal mounts once

  if (!isElectron()) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`}>
        Terminal is only available in the desktop app.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'hidden' }}
    />
  )
}
