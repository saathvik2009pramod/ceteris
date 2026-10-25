import { useState } from "react";
import { templates, type Project } from "../models/project";
const groups: Record<string, string> = {
  market: "Markets",
  surplus: "Markets",
  tax: "Policy",
  subsidy: "Policy",
  control: "Policy",
  externality: "Policy",
  trade: "World economy",
};
export function Cover({
  onChoose,
  onResume,
  onOpen,
  message,
}: {
  onChoose: (id: Project["template"]) => void;
  onResume: () => void;
  onOpen: () => void;
  message: string;
}) {
  const [filter, setFilter] = useState("All diagrams");
  return (
    <main className="ceteris-cover">
      <header className="cover-masthead">
        <a href="#" className="wordmark" aria-label="Ceteris home">
          ceteris<span>.</span>
        </a>
        <span className="masthead-note">A DRAWING DESK FOR ECONOMICS</span>
        <nav aria-label="Project actions">
          <button onClick={onOpen}>Open a project</button>
          <button onClick={onResume}>
            Continue working <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>
      <section className="cover-intro">
        <div className="intro-copy">
          <p className="eyebrow">MODELS, MADE VISIBLE</p>
          <h1>
            Give your argument
            <br />a <em>clearer shape.</em>
          </h1>
          <p className="intro-description">
            A shift in demand. The cost of a tariff. A benefit the market
            misses. Draw the economics, put the labels where you need them, and
            take the finished figure with you.
          </p>
          <a className="index-link" href="#diagram-index">
            Choose a starting point <span aria-hidden="true">↓</span>
          </a>
        </div>
        <figure className="cover-figure">
          <svg
            viewBox="0 0 460 300"
            role="img"
            aria-label="Supply and demand with a rightward demand shift and a higher equilibrium price"
          >
            <g fill="none" strokeWidth="1.8">
              <path d="M55 24V250H414" stroke="#393c32" />
              <path d="M55 220L390 52" stroke="#59634e" />
              <path d="M65 55L340 245M140 38L415 228" stroke="#973f35" />
              <path
                d="M55 145H205V250M55 116H263V250"
                stroke="#a6a293"
                strokeDasharray="4 5"
                strokeWidth="1"
              />
              <path d="M185 59h45m-7-5 7 5-7 5" stroke="#973f35" />
            </g>
            <g fill="#393c32">
              <circle cx="205" cy="145" r="4" />
              <circle cx="263" cy="116" r="4" />
            </g>
            <g fontFamily="Georgia, serif" fontSize="16" fill="#393c32">
              <text x="30" y="28">
                P
              </text>
              <text x="420" y="255">
                Q
              </text>
              <text x="25" y="150">
                P₁
              </text>
              <text x="25" y="121">
                P₂
              </text>
              <text x="194" y="273">
                Q₁
              </text>
              <text x="252" y="273">
                Q₂
              </text>
              <text x="395" y="50">
                S
              </text>
              <text x="344" y="247">
                D₁
              </text>
              <text x="420" y="229">
                D₂
              </text>
            </g>
          </svg>
          <figcaption>
            <span>FIG. 01</span> One change. A different equilibrium.
          </figcaption>
        </figure>
      </section>
      <section
        id="diagram-index"
        className="diagram-index"
        aria-label="Choose a diagram"
      >
        <div className="index-heading">
          <h2>The diagram index</h2>
          <p>
            {templates.length.toString().padStart(2, "0")} starting points. Make
            each one your own.
          </p>
        </div>
        <div
          className="index-filters"
          role="group"
          aria-label="Filter diagrams"
        >
          {["All diagrams", "Markets", "Policy", "World economy"].map((x) => (
            <button
              key={x}
              aria-pressed={filter === x}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="index-list">
          {templates.map((t, i) =>
            filter !== "All diagrams" && groups[t.id] !== filter ? null : (
              <button
                key={t.id}
                className="index-entry"
                onClick={() => onChoose(t.id)}
              >
                <span className="entry-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="entry-name">{t.name}</span>
                <span className="entry-description">{t.description}</span>
                <span className="entry-action">
                  Draw <span aria-hidden="true">↗</span>
                </span>
              </button>
            ),
          )}
        </div>
      </section>
      <footer className="cover-footer">
        <div>
          <strong>Ceteris paribus.</strong>
          <span> All other things being equal.</span>
        </div>
        <p>Editable labels · PNG & SVG exports · Saved in your browser</p>
      </footer>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
