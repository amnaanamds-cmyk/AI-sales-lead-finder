/** Entry point for the self-contained demo page (npm run build:demo). */
import { createRoot } from "react-dom/client";
import { DemoApp } from "./DemoApp";

declare const DEMO_SIGNUP_URL: string;
declare const DEMO_SIGNUP_LABEL: string;

createRoot(document.getElementById("root")!).render(
  <DemoApp signupHref={DEMO_SIGNUP_URL} signupLabel={DEMO_SIGNUP_LABEL} canPrint={false} />,
);
