import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Builder from "./Builder";
import Home from "./Home";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
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
  return hash === "#/design" ? <Builder /> : <Home />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
