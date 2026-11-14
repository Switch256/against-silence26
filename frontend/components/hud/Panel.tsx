import type { ReactNode } from "react";

interface Props {
  title: string;
  kicker?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Glass mission-control panel with a mono header line. */
export function Panel({ title, kicker, right, className = "", bodyClassName = "", children }: Props) {
  return (
    <section className={`glass pointer-events-auto flex min-h-0 flex-col ${className}`}>
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="label !text-[10.5px] !text-ink/90">{title}</h2>
          {kicker && <span className="truncate font-mono text-[10px] text-faint">{kicker}</span>}
        </div>
        {right}
      </header>
      <div className={`min-h-0 flex-1 px-4 pb-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
