// scripts/build-pages.js
//
// Stitches shared partials (head/header/mobile-menu/footer/modals/scripts)
// together with each page's own content fragment to produce plain, static
// HTML files. No templating engine, no framework -- just string
// substitution, run at deploy time via `npm run build`. Output is
// ordinary HTML/CSS/vanilla-JS served as-is by Vercel.
//
// Edit partials/*.html or content/*.html, never the generated *.html
// files at the repo root directly -- they're overwritten on every build.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

const head = read("partials/head.html");
const header = read("partials/header.html");
const mobileMenu = read("partials/mobile-menu.html");
const footer = read("partials/footer.html");
const modals = read("partials/modals.html");
const scriptsFooter = read("partials/scripts-footer.html");

// viewId matches the existing navigateTo()/ROUTE_MAP keys in app.js, and
// becomes <body data-view="..."> so shared app.js knows which page it's on.
const PAGES = [
  {
    outputFile: "index.html",
    viewId: "home",
    contentFile: "content/home.html",
    title: "Studio Photuna | Korean-Style Photobooth Business Software",
    description: "Studio Photuna is photo booth business software for Korean-style photobooth operators: event setup, template design, guest booth flow, printing, QR sharing, and a photo booth booking & management app in one Pro subscription.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "book-event.html",
    viewId: "book-event",
    contentFile: "content/book-event.html",
    title: "Book an Event | Studio Photuna",
    description: "Book Studio Photuna for your event: review pricing, check real-time availability, and secure your event details in a simple 5-step wizard.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "account.html",
    viewId: "account",
    contentFile: "content/account.html",
    title: "My Account | Studio Photuna",
    description: "Manage your Studio Photuna account, subscription plan, and profile settings.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "bookings-admin.html",
    viewId: "bookings-admin",
    contentFile: "content/bookings-admin.html",
    title: "Admin Dashboard | Studio Photuna",
    description: "Studio Photuna operator dashboard: manage bookings, payment proofs, support tickets, and reviews.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "download.html",
    viewId: "download",
    contentFile: "content/download.html",
    title: "Download | Studio Photuna",
    description: "Download the Studio Photuna desktop app for Windows and get set up in minutes.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "help-support.html",
    viewId: "help-support",
    contentFile: "content/help-support.html",
    title: "Help & Support | Studio Photuna",
    description: "Get help with Studio Photuna: contact support, browse FAQs, and find answers fast.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "operator-agreement.html",
    viewId: "operator-agreement",
    contentFile: "content/operator-agreement.html",
    title: "Terms of Service | Studio Photuna",
    description: "Studio Photuna Terms of Service / Operator Agreement.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "privacy-framework.html",
    viewId: "privacy-framework",
    contentFile: "content/privacy-framework.html",
    title: "Privacy Policy | Studio Photuna",
    description: "Studio Photuna Privacy Policy, including how we handle personal data under the Data Privacy Act of 2012 (RA 10173).",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "refund-policy.html",
    viewId: "refund-policy",
    contentFile: "content/refund-policy.html",
    title: "Refund & Cancellation Policy | Studio Photuna",
    description: "Studio Photuna Refund & Cancellation Policy.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "cookie-policy.html",
    viewId: "cookie-policy",
    contentFile: "content/cookie-policy.html",
    title: "Cookie Policy | Studio Photuna",
    description: "Studio Photuna Cookie Policy.",
    mainClass: "min-h-screen pt-20",
  },
  {
    outputFile: "data-processing.html",
    viewId: "data-processing",
    contentFile: "content/data-processing.html",
    title: "Data Processing Disclosure | Studio Photuna",
    description: "Studio Photuna Data Processing Disclosure.",
    mainClass: "min-h-screen pt-20",
  },
];

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPage(page) {
  const content = read(page.contentFile);
  const html = `<!doctype html>
<html lang="en" class="scroll-smooth">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
${head}
  </head>
  <body class="bg-warm text-[#5f6678] font-sans overflow-x-hidden custom-scrollbar" data-view="${page.viewId}">

    <div id="toast-container" class="fixed top-6 right-6 z-50 flex flex-col gap-3 pointer-events-none"></div>

${header}
${mobileMenu}
    <main class="${page.mainClass}">
${content}
    </main>

${footer}
${modals}
${scriptsFooter}
  </body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, page.outputFile), html);
  console.log("built", page.outputFile);
}

for (const page of PAGES) buildPage(page);
console.log(`\nBuilt ${PAGES.length} pages.`);
