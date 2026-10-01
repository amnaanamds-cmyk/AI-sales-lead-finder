// Builds the live demo as one self-contained HTML file: dist/demo/index.html.
// React loads from cdnjs; the app code and CSS are inlined. Host it anywhere static.
//   DEMO_SIGNUP_URL=https://your-site.pk/login DEMO_SIGNUP_LABEL="Sign up free" npm run build:demo
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";

const signupUrl = process.env.DEMO_SIGNUP_URL ?? "https://github.com/amnaanamds-cmyk/AI-sales-lead-finder";
const signupLabel = process.env.DEMO_SIGNUP_LABEL ?? "Set up LeadNama";
const REACT = "18.3.1";
const out = "dist/demo";
mkdirSync(out, { recursive: true });

// Use the React UMD globals instead of bundling React.
const reactGlobals = {
  name: "react-globals",
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({ path: args.path, namespace: "react-global" }));
    b.onLoad({ filter: /.*/, namespace: "react-global" }, (args) => {
      if (args.path === "react/jsx-runtime") {
        return {
          contents: `const R = window.React;
            export const Fragment = R.Fragment;
            export function jsx(type, props, key) { return R.createElement(type, key === undefined ? props : { ...props, key }); }
            export const jsxs = jsx;`,
          loader: "js",
        };
      }
      const g = args.path.startsWith("react-dom") ? "ReactDOM" : "React";
      return { contents: `module.exports = window.${g};`, loader: "js" };
    });
  },
};

const result = await build({
  entryPoints: ["src/app/demo/standalone.tsx"],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  logLevel: "warning",
  plugins: [reactGlobals],
  define: {
    "process.env.NODE_ENV": '"production"',
    DEMO_SIGNUP_URL: JSON.stringify(signupUrl),
    DEMO_SIGNUP_LABEL: JSON.stringify(signupLabel),
  },
});
const js = result.outputFiles[0].text;

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/demo/standalone.css", "-o", `${out}/demo.css`, "--minify"], { stdio: "inherit" });
const css = readFileSync(`${out}/demo.css`, "utf8");

const safe = (s) => s.replace(/<\/(script|style)/gi, "<\\/$1");
const html = `<title>LeadNama Live Demo</title>
<meta name="description" content="Find local Pakistani businesses that need your service, see their gaps, and pitch them on WhatsApp in Urdu, Roman Urdu or English. Sample data.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap">
<style>${safe(css)}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/${REACT}/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/${REACT}/umd/react-dom.production.min.js"></script>
<script>${safe(js)}</script>
`;
writeFileSync(`${out}/index.html`, html);
console.log(`Wrote ${out}/index.html (${Math.round(html.length / 1024)} KB)`);
