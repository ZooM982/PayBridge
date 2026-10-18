export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between" data-reveal>
      <div>
        {eyebrow && <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-volt-600">{eyebrow}</p>}
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
