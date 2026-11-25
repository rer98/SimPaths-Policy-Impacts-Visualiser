/**
 * StaticPage.js — shows one of the standalone HTML pages in public/
 * (interpreting-results.html, citation.html, funders.html) inside a tab of
 * the app, so each page's content lives in exactly one place.
 *
 * It fetches the page, keeps only the main content (the `.container` block —
 * the page's own header and footer are dropped, since the app has its own),
 * and scopes the page's CSS to this component so it can't affect the rest of
 * the app. Links between these pages (e.g. "How do I cite this? →") switch
 * tabs instead of leaving the app.
 *
 * The standalone pages still work on their own if opened directly.
 */
import { useEffect, useState } from "react";

/** Standalone page file → app tab id, for links between pages. */
export const STATIC_PAGE_TABS = {
  "interpreting-results.html": "interpreting-results",
  "citation.html": "citation",
  "funders.html": "funders",
};

/** Scope a page's CSS to `.sp-page` using CSS nesting: `:root` variables
 *  become the wrapper's own, and every other rule only matches inside it. */
function scopeCss(css) {
  return `.sp-page{${css.replace(/:root/g, "&")}}`;
}

export default function StaticPage({ file, onNavigate }) {
  const [page, setPage] = useState({ html: "", css: "", error: "" });

  useEffect(() => {
    let cancelled = false;
    setPage({ html: "", css: "", error: "" });
    fetch(`${process.env.PUBLIC_URL}/${file}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(text => {
        const doc = new DOMParser().parseFromString(text, "text/html");
        const main = doc.querySelector(".container");
        if (!main) throw new Error("page has no .container section");
        // Point relative image paths (e.g. "UKRILogo.png") at the public folder,
        // so they load whatever the current page URL looks like.
        const base = new URL(`${process.env.PUBLIC_URL}/`, window.location.origin);
        main.querySelectorAll("img[src]").forEach(img => {
          const src = img.getAttribute("src");
          if (!/^(https?:|data:|\/)/.test(src)) img.setAttribute("src", new URL(src, base).href);
        });
        const css = [...doc.querySelectorAll("style")].map(s => s.textContent).join("\n");
        if (!cancelled) setPage({ html: main.innerHTML, css: scopeCss(css), error: "" });
      })
      .catch(err => { if (!cancelled) setPage({ html: "", css: "", error: err.message }); });
    return () => { cancelled = true; };
  }, [file]);

  // Links to the other standalone pages switch tabs inside the app.
  const handleClick = (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    const href = (a.getAttribute("href") || "").split("#")[0].replace(/^\.?\//, "");
    const tab = STATIC_PAGE_TABS[href];
    if (tab) { e.preventDefault(); onNavigate?.(tab); }
  };

  if (page.error) {
    return (
      <p style={{ padding: 24, color: "#b91c1c" }}>
        Could not load this page ({page.error}).{" "}
        <a href={`${process.env.PUBLIC_URL}/${file}`} target="_blank" rel="noopener noreferrer">Open it directly</a>.
      </p>
    );
  }
  if (!page.html) return <p style={{ padding: 24, color: "#475569" }}>Loading…</p>;

  return (
    <div className="sp-page" onClick={handleClick}>
      <style>{page.css}</style>
      <div className="container" dangerouslySetInnerHTML={{ __html: page.html }} />
    </div>
  );
}
