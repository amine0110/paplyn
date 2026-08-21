import Link from "next/link";
import { Nav } from "@/components/nav";
import { Button } from "@/components/ui/button";
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";
import { FileText, Users, Sparkles, Server } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      <main>
        {/* Journal-style hero */}
        <section className="border-b border-border">
          <div className="max-w-3xl mx-auto px-4 py-20 md:py-28 text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-ink-faint mb-6">
              {PRODUCT.tagline}
            </p>
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-medium text-ink leading-[1.15] mb-6">
              {PRODUCT.headline}<br />
              <span className="italic text-accent">{PRODUCT.headlineLine2}</span>
            </h1>
            <p className="text-base md:text-lg text-ink-muted max-w-xl mx-auto mb-10 leading-relaxed">
              {PRODUCT.name} {PRODUCT.landingLead}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/signup">
                <Button size="lg">Begin a manuscript</Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">Sign in</Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature imprint */}
        <section className="py-16 md:py-20">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-x-12 gap-y-10">
              {[
                { icon: FileText, title: "Manuscript-first editor", desc: "Warm paper sheet, generous type, LaTeX command suggestions as you write." },
                { icon: Users, title: "Shared writing", desc: "Real-time collaboration with presence and named cursors. Self-hosted Yjs, no lock-in." },
                { icon: Sparkles, title: "Writing assistant", desc: "Explain errors, tighten prose, add citations. OpenAI-compatible." },
                { icon: Server, title: "Your infrastructure", desc: "Run on our cloud or deploy with Docker on your own servers." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <Icon className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-serif text-lg font-medium mb-1.5">{title}</h3>
                    <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-paper py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="font-serif text-2xl font-medium text-center mb-10">Where you write</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border border-border rounded-sm p-6 bg-canvas">
                <h3 className="font-serif text-lg font-medium mb-2">{PRODUCT.hostedEditionName}</h3>
                <p className="text-sm text-ink-muted mb-4 leading-relaxed">
                  Fully managed with subscription plans. Free tier for getting started,
                  student and researcher plans for heavier use.
                </p>
                <ul className="text-sm space-y-1 text-ink-muted">
                  <li>Free — 3 projects, 50 compiles/mo</li>
                  <li>Student — 10 projects, 500 compiles/mo</li>
                  <li>Researcher — 50 projects, 5000 compiles/mo</li>
                </ul>
              </div>
              <div className="border border-border rounded-sm p-6 bg-canvas">
                <h3 className="font-serif text-lg font-medium mb-2">Self-hosted</h3>
                <p className="text-sm text-ink-muted mb-4 leading-relaxed">
                  {PRODUCT.selfHostBlurb}
                </p>
                <pre className="text-xs bg-paper rounded-sm border border-border-light p-3 font-mono text-ink-muted overflow-x-auto">
                  docker compose up
                </pre>
              </div>
            </div>
          </div>
        </section>

        {config.isSaas && (
          <section className="border-t border-border py-16">
            <div className="max-w-3xl mx-auto px-4 text-center">
              <h2 className="font-serif text-2xl font-medium mb-3">Plans</h2>
              <p className="text-ink-muted mb-10 text-sm">Start free. Upgrade when your research demands it.</p>
              <div className="grid md:grid-cols-3 gap-5 text-left">
                {[
                  { name: "Free", price: "$0", features: ["3 projects", "50 compiles/mo", "20 AI requests/mo"] },
                  { name: "Student", price: "$9/mo", features: ["10 projects", "500 compiles/mo", "200 AI requests/mo"] },
                  { name: "Researcher", price: "$29/mo", features: ["50 projects", "5000 compiles/mo", "2000 AI requests/mo"] },
                ].map((plan) => (
                  <div key={plan.name} className="border border-border rounded-sm p-5 bg-paper">
                    <h3 className="font-serif font-medium text-lg">{plan.name}</h3>
                    <p className="text-2xl font-serif my-2 text-accent">{plan.price}</p>
                    <ul className="text-sm text-ink-muted space-y-1">
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-ink-faint">
        {PRODUCT.footerLine}
      </footer>
    </div>
  );
}
