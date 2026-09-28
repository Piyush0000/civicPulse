import Link from "next/link";
import { PulseLogo } from "./AppShell";

export default function PublicNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/75 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <PulseLogo size={28} />
          <span className="font-semibold tracking-tight">CivicPulse</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/submit" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink sm:block">Report</Link>
          <Link href="/track" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink sm:block">Track</Link>
          <Link href="/ussd" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink md:block">Feature phone</Link>
          <Link href="/transparency" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink md:block">Transparency</Link>
          <Link href="/about" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink md:block">About</Link>
          <Link href="/citizen" className="hidden rounded-lg px-3 py-1.5 text-mute hover:text-ink sm:block">My complaints</Link>
          <Link href="/app" className="btn-ghost px-3 py-1.5 text-xs">Government login</Link>
        </nav>
      </div>
    </header>
  );
}
