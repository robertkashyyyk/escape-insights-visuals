import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the push service worker. updateViaCache:'none' forces the browser to
// revalidate /sw.js on every load, so a stale worker behind a CDN cache can't
// get stuck (see the deploy note about DO cache headers on /sw.js).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  });
}
