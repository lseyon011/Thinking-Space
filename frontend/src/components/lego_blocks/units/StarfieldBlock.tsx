import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  r: number
  alpha: number
  twinkle: number
}

type ShootingStar = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

interface StarfieldProps {
  starColor?: string
  shootingColor?: string
}

export default function Starfield({
  starColor = '#1f2937',
  shootingColor,
}: StarfieldProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const starColorRef = useRef(starColor)
  starColorRef.current = starColor
  const shootingColorRef = useRef(shootingColor ?? starColor)
  shootingColorRef.current = shootingColor ?? starColor

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reduced = media.matches
    const onMediaChange = (e: MediaQueryListEvent) => {
      reduced = e.matches
    }
    media.addEventListener?.('change', onMediaChange)

    let width = 0
    let height = 0
    let dpr = 1
    let stars: Star[] = []
    let shooting: ShootingStar[] = []
    let raf = 0
    let last = 0
    let nextShootAt = 0

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const area = width * height
      const count = Math.max(60, Math.floor(area * 0.00008))
      stars = Array.from({ length: count }).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.2 + 0.4,
        alpha: Math.random() * 0.6 + 0.2,
        twinkle: Math.random() * 0.015 + 0.005,
      }))
    }

    const scheduleNextShoot = (now: number) => {
      nextShootAt = now + 2500 + Math.random() * 4500
    }

    const spawnShootingStar = () => {
      const fromLeft = Math.random() < 0.5
      const startX = fromLeft ? -50 : width + 50
      const startY = Math.random() * height * 0.4
      const vx = fromLeft ? 7 + Math.random() * 4 : -7 - Math.random() * 4
      const vy = 3 + Math.random() * 2
      const maxLife = 60 + Math.random() * 30
      shooting.push({ x: startX, y: startY, vx, vy, life: 0, maxLife })
    }

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height)

      for (const s of stars) {
        s.alpha += (Math.random() - 0.5) * s.twinkle
        s.alpha = Math.min(1, Math.max(0.12, s.alpha))
        ctx.globalAlpha = s.alpha
        ctx.fillStyle = starColorRef.current
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1

      shooting = shooting.filter(star => {
        star.x += star.vx
        star.y += star.vy
        star.life += 1

        const t = 1 - star.life / star.maxLife
        const tail = 40 + t * 40
        const grad = ctx.createLinearGradient(
          star.x,
          star.y,
          star.x - star.vx * (tail / 8),
          star.y - star.vy * (tail / 8),
        )
        grad.addColorStop(0, `rgba(31,41,55,${0.55 * t})`)
        grad.addColorStop(1, 'rgba(31,41,55,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(star.x, star.y)
        ctx.lineTo(star.x - star.vx * (tail / 8), star.y - star.vy * (tail / 8))
        ctx.stroke()

        return star.life < star.maxLife && star.y < height + 80
      })

      if (!reduced && now > nextShootAt) {
        spawnShootingStar()
        scheduleNextShoot(now)
      }
    }

    const loop = (now: number) => {
      if (!last) last = now
      draw(now)
      raf = requestAnimationFrame(loop)
    }

    resize()
    scheduleNextShoot(performance.now())

    if (reduced) {
      draw(performance.now())
    } else {
      raf = requestAnimationFrame(loop)
    }

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      media.removeEventListener?.('change', onMediaChange)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  )
}
