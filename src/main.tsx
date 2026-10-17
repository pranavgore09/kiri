import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Builder from "./Builder";
import { catalog } from "./catalog";
import { checkCatalog } from "./checkCatalog";
import Home from "./Home";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./styles.css";

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onHash = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  const [route, product] = hash.slice(2).split("/");
  return route === "design" ? <Builder key={product} start={product} /> : <Home />;
}

// A mistake in catalog.yaml shows as a plain list of what's wrong, not a broken page.
function CatalogProblems({ problems }: { problems: string[] }) {
  return (
    <main style={{ padding: 24, fontFamily: "monospace" }}>
      <h1>catalog.yaml needs fixing</h1>
      <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
    </main>
  );
}

const problems = checkCatalog(catalog);
createRoot(document.getElementById("root")!).render(
  <StrictMode>{problems.length ? <CatalogProblems problems={problems} /> : <App />}</StrictMode>,
);
