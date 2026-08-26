import Link from "next/link";
import { Nav } from "@/components/nav";
import { LandingHero } from "@/components/landing-hero";
import { IntegrationsStrip } from "@/components/integrations-strip";
import { config } from "@/lib/config";
import { PRODUCT } from "@/lib/product";
import { getLandingIntegrations } from "@/lib/integrations";
import { FileText, Users, Sparkles, Server } from "lucide-react";

export default function LandingPage() {
  const integrations = getLandingIntegrations({ isSelfHosted: config.isSelfHosted });

  return (
    <div className="min-h-screen">
      <Nav />

      <main>
        <section className="max-w-4xl mx-auto px-4 py-24 text-center">
          <h1 className="font-serif text-5xl md:text-6xl font-semibold text-navy leading-tight mb-6">
            {PRODUCT.headline}<br />{PRODUCT.headlineLine2}
          </h1>
          <p className="text-lg text-ink-muted max-w-2xl mx-auto mb-10">
            {PRODUCT.name} {PRODUCT.landingLead}
          </p>
          <LandingHero />
        </section>

        <IntegrationsStrip items={integrations} />

        <section className="bg-canvas-dark border-y border-border py-20">
          <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: FileText, title: "Multi-file editor", desc: "CodeMirror 6 with syntax highlighting, line numbers, and bracket matching." },
              { icon: Users, title: "Real-time collab", desc: "Shared editing with presence and named cursors. Self-hosted Yjs, no lock-in." },
              { icon: Sparkles, title: "AI assistant", desc: "Explain errors, tighten prose, add citations. OpenAI-compatible." },
              { icon: Server, title: "Your infrastructure", desc: "Run on our cloud or deploy with Docker on your own servers." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="space-y-3">
                <Icon className="h-6 w-6 text-navy" />
                <h3 className="font-serif text-lg font-medium">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 py-20">
          <h2 className="font-serif text-3xl font-semibold text-center mb-12">Deployment options</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="border border-border rounded-lg p-6 bg-surface">
              <h3 className="font-serif text-xl font-medium mb-2">{PRODUCT.hostedEditionName}</h3>
              <p className="text-sm text-ink-muted mb-4">
                Fully managed SaaS with subscription plans. Free tier for getting started,
                student and researcher plans for heavier use.
              </p>
              <ul className="text-sm space-y-1 text-ink-muted">
                <li>Free — 3 projects, 50 compiles/mo</li>
                <li>Student — 10 projects, 500 compiles/mo</li>
                <li>Researcher — 50 projects, 5000 compiles/mo</li>
              </ul>
            </div>
            <div className="border border-border rounded-lg p-6 bg-surface">
              <h3 className="font-serif text-xl font-medium mb-2">Self-hosted</h3>
              <p className="text-sm text-ink-muted mb-4">
                {PRODUCT.selfHostBlurb}
              </p>
              <pre className="text-xs bg-canvas-dark rounded p-3 font-mono text-ink-muted overflow-x-auto">
                docker compose up
              </pre>
            </div>
          </div>
        </section>

        {config.isSaas && (
          <section className="bg-navy text-white py-16">
            <div className="max-w-3xl mx-auto px-4 text-center">
              <h2 className="font-serif text-2xl font-semibold mb-4">Simple pricing</h2>
              <p className="text-white/80 mb-8">Start free. Upgrade when your research demands it.</p>
              <div className="grid md:grid-cols-3 gap-6 text-left">
                {[
                  { name: "Free", price: "$0", features: ["3 projects", "50 compiles/mo", "20 AI requests/mo"] },
                  { name: "Student", price: "$9/mo", features: ["10 projects", "500 compiles/mo", "200 AI requests/mo"] },
                  { name: "Researcher", price: "$29/mo", features: ["50 projects", "5000 compiles/mo", "2000 AI requests/mo"] },
                ].map((plan) => (
                  <div key={plan.name} className="bg-white/10 rounded-lg p-5">
                    <h3 className="font-medium text-lg">{plan.name}</h3>
                    <p className="text-2xl font-serif my-2">{plan.price}</p>
                    <ul className="text-sm text-white/70 space-y-1">
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
        <p>{PRODUCT.footerLine}</p>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/docs" className="text-accent hover:underline cursor-pointer">
            Documentation
          </Link>
          <Link href="/report" className="text-accent hover:underline cursor-pointer">
            Report an issue
          </Link>
        </p>
      </footer>
    </div>
  );
}
