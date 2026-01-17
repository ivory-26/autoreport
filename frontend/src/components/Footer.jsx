import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-background text-foreground py-12 mt-auto">
      <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start">
          <h1 className="text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">
            AUTOREPORT
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Zero-Click Documentation for Developers
          </p>
        </div>

        <div className="flex flex-col items-center md:items-end gap-2">
          <p className="text-sm font-medium">
            &copy; 2026 ivory-26
          </p>
          <Link
            href="https://github.com/ivory-26"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-primary transition-colors hover:underline"
          >
            GitHub Profile
          </Link>
        </div>
      </div>
    </footer>
  );
}
