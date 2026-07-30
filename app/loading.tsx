/**
 * Route-level loading fallback. Every page is force-dynamic, so navigation
 * waits on a server render with nothing on screen; this gives immediate
 * feedback instead. Applies to any segment without its own loading.tsx.
 */
export default function Loading() {
  return (
    <main className="loading-page" aria-busy="true" aria-live="polite">
      <section className="panel">
        <span className="loading-label">Loading…</span>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line is-short" />
      </section>
    </main>
  );
}
