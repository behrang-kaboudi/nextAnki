import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-card">
      <div className="px-4 py-8 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted">
            © {new Date().getFullYear()} Anki Bridge
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link className="text-muted hover:text-foreground" href="/docs">
              Docs
            </Link>
            <Link className="text-muted hover:text-foreground" href="/about">
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
