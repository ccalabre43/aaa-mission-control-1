export function Header() {
  return (
    <header className="bg-secondary text-secondary-content">
      <div className="mx-auto flex max-w-[90rem] items-center gap-4 px-4 py-4 sm:px-6">
        <p className="font-display text-2xl font-semibold tracking-wide sm:text-3xl">
          AAA of Michigan
        </p>
        <span className="hidden h-8 w-px bg-white/40 sm:block" aria-hidden="true" />
        <p className="text-sm font-semibold sm:text-base">Project tracker</p>
      </div>
    </header>
  );
}
