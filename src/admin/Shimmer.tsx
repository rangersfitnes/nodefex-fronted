import type { CSSProperties } from 'react'

type ShimmerProps = {
  className?: string
  style?: CSSProperties
  /** Accesible: anuncia carga a lectores de pantalla. */
  label?: string
}

/** Bloque base con animación shimmer. */
export function Shimmer({ className = '', style, label }: ShimmerProps) {
  return (
    <span
      className={`nf-shimmer ${className}`.trim()}
      style={style}
      aria-hidden={label ? undefined : true}
      role={label ? 'status' : undefined}
      aria-label={label}
    />
  )
}

type ShimmerLineProps = {
  width?: string
  height?: string
  className?: string
}

export function ShimmerLine({ width = '100%', height = '0.85rem', className = '' }: ShimmerLineProps) {
  return <Shimmer className={`nf-shimmer-line ${className}`.trim()} style={{ width, height }} />
}

/** Skeleton del formulario Sitio web (secciones colapsables). */
export function SitioWebFormShimmer() {
  return (
    <div className="sitio-web-form sitio-web-shimmer" aria-busy="true" aria-label="Cargando contenido del sitio">
      {[
        { title: '72%', summary: '40%' },
        { title: '48%', summary: '55%' },
        { title: '56%', summary: '32%' },
        { title: '68%', summary: '28%' },
        { title: '62%', summary: '36%' },
        { title: '58%', summary: '30%' },
      ].map((row, index) => (
        <div key={`sec-${index}`} className="sitio-web-fieldset sitio-web-shimmer-section">
          <div className="sitio-web-shimmer-section-row">
            <div className="sitio-web-fieldset-toggle-text">
              <ShimmerLine width={row.title} height="0.95rem" />
              <ShimmerLine width={row.summary} height="0.7rem" />
            </div>
            <Shimmer className="nf-shimmer-icon" />
          </div>
        </div>
      ))}

      <div className="sitio-web-fieldset sitio-web-shimmer-section is-open-preview">
        <div className="sitio-web-shimmer-section-row">
          <div className="sitio-web-fieldset-toggle-text">
            <ShimmerLine width="70%" height="0.95rem" />
            <ShimmerLine width="34%" height="0.7rem" />
          </div>
          <Shimmer className="nf-shimmer-icon" />
        </div>
        <div className="sitio-web-fieldset-body">
          <div className="sitio-web-grid-2">
            <div className="sitio-web-shimmer-field">
              <ShimmerLine width="42%" height="0.7rem" />
              <Shimmer className="nf-shimmer-input" />
            </div>
            <div className="sitio-web-shimmer-field">
              <ShimmerLine width="48%" height="0.7rem" />
              <Shimmer className="nf-shimmer-input" />
            </div>
          </div>
          {[0, 1, 2].map((i) => (
            <div key={`proj-${i}`} className="sitio-web-project-block is-collapsed">
              <div className="sitio-web-project-head">
                <div className="sitio-web-project-toggle" aria-hidden>
                  <Shimmer className="nf-shimmer-icon nf-shimmer-icon-sm" />
                  <div className="sitio-web-project-toggle-label">
                    <ShimmerLine width={`${58 - i * 8}%`} height="0.9rem" />
                    <ShimmerLine width="28%" height="0.65rem" />
                  </div>
                </div>
                <Shimmer className="nf-shimmer-chip" />
              </div>
            </div>
          ))}
          <Shimmer className="nf-shimmer-button" />
        </div>
      </div>

      <div className="hero-actions">
        <Shimmer className="nf-shimmer-button nf-shimmer-button-primary" />
      </div>
    </div>
  )
}

/** Skeleton genérico de formulario admin (contacto / formularios cortos). */
export function AdminFormShimmer({ fields = 4 }: { fields?: number }) {
  return (
    <div className="sitio-web-form sitio-web-shimmer" aria-busy="true" aria-label="Cargando formulario">
      <div className="sitio-web-fieldset sitio-web-shimmer-section is-open-preview">
        <div className="sitio-web-shimmer-section-row">
          <ShimmerLine width="46%" height="0.95rem" />
          <Shimmer className="nf-shimmer-icon" />
        </div>
        <div className="sitio-web-fieldset-body">
          {Array.from({ length: fields }, (_, i) => (
            <div key={`field-${i}`} className="sitio-web-shimmer-field">
              <ShimmerLine width={`${36 + (i % 3) * 8}%`} height="0.7rem" />
              <Shimmer className="nf-shimmer-input" />
            </div>
          ))}
        </div>
      </div>
      <div className="hero-actions">
        <Shimmer className="nf-shimmer-button nf-shimmer-button-primary" />
      </div>
    </div>
  )
}

/** Skeleton de grilla de cards (dashboard / listados). */
export function CardGridShimmer({ count = 4 }: { count?: number }) {
  return (
    <div className="proyectos-grid" aria-busy="true" aria-label="Cargando proyectos">
      {Array.from({ length: count }, (_, i) => (
        <article key={`card-${i}`} className="proyecto-card nf-shimmer-card">
          <ShimmerLine width="62%" height="1rem" />
          <ShimmerLine width="88%" height="0.75rem" />
          <ShimmerLine width="44%" height="0.75rem" />
          <div className="nf-shimmer-card-foot">
            <Shimmer className="nf-shimmer-chip" />
            <Shimmer className="nf-shimmer-chip nf-shimmer-chip-wide" />
          </div>
        </article>
      ))}
    </div>
  )
}
