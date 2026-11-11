"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ background: "#FFFDFB", color: "#1A1A1A", fontFamily: "sans-serif", margin: 0 }}>
        <main id="main" style={{ padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 32 }}>Something went wrong</h1>
          <p>Tharkoo could not load. Try again, or go back home.</p>
          <p>
            <form action="/" method="get">
              <button type="submit" style={{ color: "#A63A5E", background: "none", border: 0, font: "inherit" }}>
                Back to home
              </button>
            </form>
          </p>
          <button type="button" onClick={reset}>
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
