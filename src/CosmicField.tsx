import { useEffect, useRef } from 'react'

type Star = {
  x: number
  y: number
  z: number
  r: number
  tw: number
  tws: number
}

type Dust = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  a: number
}

type Comet = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
}

type CosmicFieldProps = {
  className?: string
}

/**
 * Fondo cósmico para el hero: estrellas, polvo y nebulosas en tinta/teal.
 * Se pausa fuera de viewport y respeta prefers-reduced-motion.
 */
export function CosmicField({ className = '' }: CosmicFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let dpr = 1
    let stars: Star[] = []
    let dust: Dust[] = []
    let comet: Comet | null = null
    let raf = 0
    let visible = true
    let last = performance.now()
    let nebulaPhase = 0

    function seed(w: number, h: number) {
      const area = w * h
      const starCount = Math.min(280, Math.max(120, Math.floor(area / 7000)))
      const dustCount = Math.min(56, Math.max(22, Math.floor(area / 24000)))
      stars = Array.from({ length: starCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: 0.35 + Math.random() * 0.65,
        r: 0.45 + Math.random() * 1.65,
        tw: Math.random() * Math.PI * 2,
        tws: 0.4 + Math.random() * 1.2,
      }))
      dust = Array.from({ length: dustCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.02 - Math.random() * 0.06,
        r: 0.6 + Math.random() * 1.8,
        a: 0.08 + Math.random() * 0.18,
      }))
      comet = null
    }

    function resize() {
      const rect = wrap.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed(width, height)
      if (reduceMotion) drawFrame(0, true)
    }

    function drawNebula(t: number) {
      const cx = width * (0.72 + Math.sin(t * 0.04) * 0.03)
      const cy = height * (0.28 + Math.cos(t * 0.03) * 0.02)
      const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.58)
      g1.addColorStop(0, 'rgba(45, 212, 191, 0.22)')
      g1.addColorStop(0.35, 'rgba(15, 118, 110, 0.12)')
      g1.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, width, height)

      const cx2 = width * (0.18 + Math.cos(t * 0.035) * 0.025)
      const cy2 = height * (0.68 + Math.sin(t * 0.028) * 0.03)
      const g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(width, height) * 0.5)
      g2.addColorStop(0, 'rgba(234, 88, 12, 0.14)')
      g2.addColorStop(0.45, 'rgba(154, 52, 18, 0.06)')
      g2.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, width, height)

      const g3 = ctx.createRadialGradient(
        width * 0.5,
        height * 1.02,
        0,
        width * 0.5,
        height * 1.02,
        height * 0.8,
      )
      g3.addColorStop(0, 'rgba(94, 234, 212, 0.12)')
      g3.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = g3
      ctx.fillRect(0, 0, width, height)

      // Anillo orbital sutil (lectura “tech”, sin glow agresivo)
      const ox = width * 0.62
      const oy = height * 0.42
      const rx = Math.max(width, height) * 0.28
      const ry = rx * 0.38
      ctx.save()
      ctx.translate(ox, oy)
      ctx.rotate(-0.35 + Math.sin(t * 0.02) * 0.04)
      ctx.strokeStyle = 'rgba(148, 233, 216, 0.14)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.beginPath()
      ctx.ellipse(0, 0, rx * 0.72, ry * 0.72, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    function spawnComet() {
      const fromLeft = Math.random() > 0.5
      comet = {
        x: fromLeft ? -40 : width + 40,
        y: height * (0.08 + Math.random() * 0.35),
        vx: fromLeft ? 3.2 + Math.random() * 1.6 : -(3.2 + Math.random() * 1.6),
        vy: 1.1 + Math.random() * 0.9,
        life: 0,
        max: 70 + Math.random() * 40,
      }
    }

    function drawFrame(dt: number, staticFrame = false) {
      ctx.fillStyle = '#070b14'
      ctx.fillRect(0, 0, width, height)

      if (!staticFrame) nebulaPhase += dt * 0.35
      drawNebula(nebulaPhase)

      // Velo estructural suave (sin foto)
      const veil = ctx.createLinearGradient(0, 0, 0, height)
      veil.addColorStop(0, 'rgba(7, 11, 20, 0.15)')
      veil.addColorStop(0.45, 'rgba(7, 11, 20, 0)')
      veil.addColorStop(1, 'rgba(7, 11, 20, 0.35)')
      ctx.fillStyle = veil
      ctx.fillRect(0, 0, width, height)

      for (const s of stars) {
        if (!staticFrame) {
          s.tw += dt * s.tws
          s.y += dt * 2.2 * (1.15 - s.z)
          if (s.y > height + 4) {
            s.y = -4
            s.x = Math.random() * width
          }
        }
        const twinkle = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(s.tw))
        const alpha = (0.35 + 0.65 * s.z) * twinkle
        ctx.beginPath()
        ctx.fillStyle = `rgba(236, 248, 250, ${alpha.toFixed(3)})`
        ctx.arc(s.x, s.y, s.r * s.z, 0, Math.PI * 2)
        ctx.fill()
        if (s.z > 0.82 && s.r > 1.1) {
          ctx.beginPath()
          ctx.fillStyle = `rgba(94, 234, 212, ${(0.18 * twinkle).toFixed(3)})`
          ctx.arc(s.x, s.y, s.r * s.z * 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      for (const d of dust) {
        if (!staticFrame) {
          d.x += d.vx * dt * 60
          d.y += d.vy * dt * 60
          if (d.y < -6) {
            d.y = height + 6
            d.x = Math.random() * width
          }
          if (d.x < -6) d.x = width + 6
          if (d.x > width + 6) d.x = -6
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(94, 234, 212, ${d.a.toFixed(3)})`
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (!staticFrame) {
        if (!comet && Math.random() < 0.0035) spawnComet()
        if (comet) {
          comet.life += dt * 60
          comet.x += comet.vx * dt * 60
          comet.y += comet.vy * dt * 60
          const p = 1 - comet.life / comet.max
          if (p <= 0) {
            comet = null
          } else {
            const tx = comet.x - comet.vx * 8
            const ty = comet.y - comet.vy * 8
            const trail = ctx.createLinearGradient(comet.x, comet.y, tx, ty)
            trail.addColorStop(0, `rgba(226, 252, 245, ${(0.75 * p).toFixed(3)})`)
            trail.addColorStop(1, 'rgba(20, 184, 166, 0)')
            ctx.strokeStyle = trail
            ctx.lineWidth = 1.4
            ctx.beginPath()
            ctx.moveTo(comet.x, comet.y)
            ctx.lineTo(tx, ty)
            ctx.stroke()
            ctx.beginPath()
            ctx.fillStyle = `rgba(255, 255, 255, ${(0.85 * p).toFixed(3)})`
            ctx.arc(comet.x, comet.y, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (visible) drawFrame(dt)
      raf = requestAnimationFrame(tick)
    }

    const ro = new ResizeObserver(() => resize())
    ro.observe(wrap)
    resize()

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting)
      },
      { threshold: 0.05 },
    )
    io.observe(wrap)

    if (!reduceMotion) {
      last = performance.now()
      raf = requestAnimationFrame(tick)
    } else {
      drawFrame(0, true)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapRef}
      className={`nf-cosmic ${className}`.trim()}
      aria-hidden
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
