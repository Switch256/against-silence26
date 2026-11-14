import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  /** short secondary text after the title */
  meta?: ReactNode;
  /** right-aligned header content (tags, counters) */
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** A console panel: flat surface, hairline border, a 40 px header with title + meta. */
export function Panel({ title, meta, right, className = "", bodyClassName = "", children }: Props) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`}>
      <header className="panel-header shrink-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="panel-title truncate">{title}</h2>
          {meta && <span className="truncate text-[12px] text-fg-3">{meta}</span>}
        </div>
        {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A titled sub-section inside a panel. Separated by space, not lines. */
export function Section({ title, right, children, className = "" }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`px-4 pt-2.5 ${className}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="caps">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
