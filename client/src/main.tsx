import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
    <div className="dark">
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </div>
);
