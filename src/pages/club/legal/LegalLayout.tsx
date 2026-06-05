import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ClubBackdrop from "@/components/club/ClubBackdrop";
import ClubFooter from "@/components/club/ClubFooter";

const GOLD = "#E8C688";
const GOLD_DEEP = "#A68E61";

export type LegalSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

interface Props {
  title: string;
  effectiveDate?: string;
  intro?: string[];
  sections: LegalSection[];
}

export default function LegalLayout({ title, effectiveDate = "June 2026", intro, sections }: Props) {
  return (
    <div className="relative min-h-screen text-white" style={{ backgroundColor: "#A0000D" }}>
      <ClubBackdrop />
      <div className="relative max-w-2xl mx-auto px-5 pt-6 pb-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs tracking-[0.25em] uppercase mb-6"
          style={{ color: GOLD }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <header className="text-center mb-8">
          <div className="w-12 h-px mx-auto mb-5" style={{ backgroundColor: GOLD }} />
          <h1
            className="font-faberge text-3xl sm:text-4xl leading-tight mb-3"
            style={{ color: GOLD }}
          >
            {title}
          </h1>
          <p
            className="font-faberge text-[10px] tracking-[0.4em] uppercase"
            style={{ color: GOLD_DEEP }}
          >
            Effective Date: {effectiveDate}
          </p>
          <p
            className="font-faberge text-[10px] tracking-[0.4em] uppercase mt-1"
            style={{ color: GOLD_DEEP }}
          >
            Joker Casino Ltd · Trading as Premier Casino
          </p>
          <div className="w-12 h-px mx-auto mt-5" style={{ backgroundColor: GOLD }} />
        </header>

        {intro && (
          <div className="space-y-3 mb-8">
            {intro.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                {p}
              </p>
            ))}
          </div>
        )}

        <div className="space-y-7">
          {sections.map((s, idx) => (
            <section key={idx}>
              <h2
                className="font-faberge text-base tracking-[0.2em] uppercase mb-3"
                style={{ color: GOLD }}
              >
                {idx + 1}. {s.heading}
              </h2>
              {s.paragraphs?.map((p, i) => (
                <p
                  key={i}
                  className="text-sm leading-relaxed mb-2"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="space-y-1.5 mt-2">
                  {s.bullets.map((b, i) => (
                    <li
                      key={i}
                      className="text-sm leading-relaxed pl-4 relative"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      <span
                        className="absolute left-0 top-0"
                        style={{ color: GOLD }}
                      >
                        ·
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <ClubFooter />
      </div>
    </div>
  );
}
