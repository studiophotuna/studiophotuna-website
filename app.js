// ===================================================================
// app.js — Studio Photuna main application script
// Extracted from index.html with Supabase-driven package management
// ===================================================================

// Supabase Keys
const SUPABASE_URL = "https://elthktbvojsmvhtxxqnz.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdGhrdGJ2b2pzbXZodHh4cW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzYzMjUsImV4cCI6MjA5MDI1MjMyNX0.5QrzeI0WKJclFLHEBgZH7WxsHPdKBJmdEtpqlyXg9PQ";
const ACCOUNT_SNAPSHOT_KEY = "studio-photuna-account-snapshot";

const supabaseClient = window.supabase?.createClient
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// DOM Target Selectors
const userDropdown = document.getElementById("userDropdown");
const dropdownButton = document.getElementById("dropdownButton");
const authModal = document.getElementById("authModal");
const gcashModal = document.getElementById("gcashModal");
const authForm = document.getElementById("authForm");
const authName = document.getElementById("authName");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authMessage = document.getElementById("authMessage");
const userPill = document.getElementById("userPill");
const adminBookingsOpen = document.getElementById("adminBookingsOpen");
const logoutAction = document.getElementById("logoutAction");
const hamburger = document.querySelector(".hamburger");
const proPlanBadge = document.getElementById("proPlanBadge");
const proPlanPrice = document.getElementById("proPlanPrice");
const proPlanNote = document.getElementById("proPlanNote");
const proPlanDetails = document.getElementById("proPlanDetails");
const proPlanCta = document.getElementById("proPlanCta");
const billingToggleButtons = document.querySelectorAll("[data-billing]");

// Wizard Elements
const eventBookingForm = document.getElementById("eventBookingForm");
const bookingDate = document.getElementById("bookingDate");
const bookingDateDisplay = document.getElementById("bookingDateDisplay");
const bookingTime = document.getElementById("bookingTime");
const bookingPhone = document.getElementById("bookingPhone");
const bookingPackage = document.getElementById("bookingPackage");
const bookingExtraHours = document.getElementById("bookingExtraHours");
const bookingGuests = document.getElementById("bookingGuests");
const bookingVenueCity = document.getElementById("bookingVenueCity");
const bookingVenueName = document.getElementById("bookingVenueName");
const bookingVenueAddress = document.getElementById("bookingVenueAddress");
const bookingMapsLink = document.getElementById("bookingMapsLink");
const packageBreakdown = document.getElementById("packageBreakdown");
const quoteSummaryList = document.getElementById("quoteSummaryList");
const quoteTotal = document.getElementById("quoteTotal");
const bookingWizardProgress = document.getElementById("bookingWizardProgress");
const bookingWizardActions = document.getElementById("bookingWizardActions");
const bookingPrevStep = document.getElementById("bookingPrevStep");
const bookingNextStep = document.getElementById("bookingNextStep");
const bookingMessage = document.getElementById("bookingMessage");
const bookingSubmit = document.getElementById("bookingSubmit");
const bookingCalendar = document.getElementById("bookingCalendar");
const bookingCalendarMonth = document.getElementById("bookingCalendarMonth");
const calendarPrev = document.getElementById("calendarPrev");
const calendarNext = document.getElementById("calendarNext");
const availabilityStatus = document.getElementById("availabilityStatus");

// Admin Panel Selectors
const bookingList = document.getElementById("bookingList");
const reviewList = document.getElementById("reviewList");
const refreshBookings = document.getElementById("refreshBookings");
const adminMessage = document.getElementById("adminMessage");
const adminMeta = document.getElementById("adminMeta");
const adminPanelTitle = document.getElementById("adminPanelTitle");
const filterButtons = document.querySelectorAll("[data-filter]");
const adminTabButtons = document.querySelectorAll("[data-admin-tab]");
const googleReviewsList = document.getElementById("googleReviewsList");

// Application State Variables
// Set by each page's <body data-view="..."> so shared app.js knows which
// page it's running on -- every page ships this same script.
const CURRENT_VIEW = document.body.dataset.view || 'home';
let authMode = "login";
let currentProfile = null;
let currentLicense = null;
let selectedBilling = "yearly";
let visibleBookingMonth = new Date();
let unavailableBookingDates = new Set();
let selectedBookingDate = "";
let currentBookingStep = 0;
const totalBookingSteps = 5;
const BOOKING_STEP_LABELS = ["Choose a date", "Packages & coverage", "Event schedule", "Contact & guest details", "Confirm & submit"];
let bookings = [];
let reviews = [];
let activeFilter = "all";
let activeAdminTab = "bookings";

// Package catalog — loaded from Supabase on init, with hardcoded fallback
let packageCatalog = {};
const COMBO_DISCOUNT = 2500;

// Fallback packages used if Supabase fetch fails
const FALLBACK_PACKAGES = {
  "enclosed": { name: "Enclosed Photobooth", price: 23000, extraRate: 2000, coverage: "3 hours", icon: "fa-camera", included: ["Private enclosed photobooth setup", "Custom strip template overlay designs", "Soft lighting configuration", "QR live download access", "On-site technical representative", "Complimentary travel within Metro Manila"] },
  "high-angle": { name: "High-Angle Photobooth", price: 20000, extraRate: 1500, coverage: "3 hours", icon: "fa-angles-up", included: ["High-angle perspective photobooth set", "Custom strip template overlay designs", "Soft overhead flash configuration", "QR live download access", "On-site technical representative", "Complimentary travel within Metro Manila"] },
  "polaroid": { name: "Polaroid Phone App", price: 5000, extraRate: 500, coverage: "3 hours", icon: "fa-mobile-screen", included: ["Polaroid-style phone app experience", "Instant digital prints via phone", "QR cloud sync storage"] },
  "phone-booth": { name: "Phone Booth", price: 4500, extraRate: 500, coverage: "3 hours", icon: "fa-phone-volume", included: ["Retro physical phone set", "Digital audio guest recording log", "Basic support frame", "QR cloud sync storage"] },
  "cafe": { name: "Cafe Booth", price: 20000, extraRate: 1500, coverage: "3 hours", icon: "fa-mug-hot", included: ["Cafe-themed photobooth setup", "Custom strip template overlay designs", "QR live download access", "On-site technical representative", "Complimentary travel within Metro Manila"] }
};

async function loadPackagesFromSupabase() {
  if (!supabaseClient) { packageCatalog = { ...FALLBACK_PACKAGES }; return; }
  try {
    const { data, error } = await supabaseClient
      .from("packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    if (!data || !data.length) { packageCatalog = { ...FALLBACK_PACKAGES }; return; }
    packageCatalog = {};
    data.forEach(row => {
      packageCatalog[row.key] = {
        name: row.name,
        price: row.price,
        extraRate: row.extra_rate || 1000,
        coverage: row.coverage || "3 hours",
        icon: row.icon || "fa-camera",
        included: row.included || []
      };
    });
  } catch (err) {
    console.warn("Failed to load packages from Supabase, using fallback:", err);
    packageCatalog = { ...FALLBACK_PACKAGES };
  }
}

const billingPlans = {
  monthly: { badge: "Flexible Plan", price: "₱1,800<small class='text-sm text-white/70'>/mo</small>", note: "Billed monthly. Ideal for pop-up event testing, seasonal hubs, and flexible slots.", details: ["Billed monthly", "Standard support ticket guidelines", "Unlimited image capture parameters", "Dynamic custom template coordinates"], cta: "Choose Monthly Plan" },
  yearly: { badge: "Best Value", price: "₱950<small class='text-sm text-white/70'>/mo</small>", note: "₱11,400 billed annually. Enjoy a 47% savings compared with monthly cycles.", details: ["Best value choice", "Continuous software feature releases", "Priority developer support queue", "Advanced custom branding frames"], cta: "Choose Yearly Plan" }
};

const PHP_AMOUNTS = { monthly: 1800, yearly: 11400 };

const PAYMENT_METHOD_LABELS = {
  stripe: "Card (Stripe)",
  paymongo: "PayMongo",
  xendit: "Xendit",
  paypal: "PayPal",
  manual_gcash: "GCash",
};

function formatPhp(amount) {
  return "₱" + Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 });
}

function formatPaymentDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
}

// Fills in a payment-receipt detail block (Transaction ID / Date & Time /
// Payment Method) shared by the app-subscription and booking-deposit
// success pages. Leaves the block hidden when there's no real data yet
// (e.g. payment still confirming) rather than showing empty placeholders.
function renderPaymentReceipt(prefix, { amount, txnId, date, provider }) {
  const detailsEl = document.getElementById(prefix + "ReceiptDetails");
  if (!detailsEl) return;
  const amountEl = document.getElementById(prefix + "Amount");
  if (amountEl && amount != null) amountEl.textContent = formatPhp(amount);
  if (!txnId && !date && !provider) return;
  document.getElementById(prefix + "TxnId").textContent = txnId || "—";
  document.getElementById(prefix + "Date").textContent = formatPaymentDate(date);
  document.getElementById(prefix + "Method").textContent = PAYMENT_METHOD_LABELS[provider] || provider || "—";
  detailsEl.classList.remove("hidden");
}

function copyPaymentField(elementId, btn) {
  const text = document.getElementById(elementId)?.textContent?.trim();
  if (!text || text === "—" || !navigator.clipboard) return;
  navigator.clipboard.writeText(text).then(() => {
    const icon = btn.querySelector("i");
    if (!icon) return;
    icon.className = "fa-solid fa-check";
    setTimeout(() => { icon.className = "fa-regular fa-copy"; }, 1500);
  });
}

// ===================================================================
// Navigation, Auth UI, Billing, Account
// ===================================================================

// Each viewId now lives on its own physical page. ROUTE_MAP is the single
// source of truth for viewId -> URL; navigateTo() keeps its original name
// and signature so the ~20+ existing onclick="navigateTo('x')" call sites
// in the shared header/footer/modal partials don't need to change.
const ROUTE_MAP = {
  'home': '/',
  'book-event': '/book-event',
  'bookings-admin': '/bookings-admin',
  'account': '/account',
  'download': '/download',
  'changelog': '/changelog',
  'help-support': '/help-support',
  'operator-agreement': '/operator-agreement',
  'privacy-framework': '/privacy-framework',
  'refund-policy': '/refund-policy',
  'cookie-policy': '/cookie-policy',
  'data-processing': '/data-processing',
  'privacy-request': '/privacy-request',
  'payment-app-success': '/payment/app_success',
  'payment-app-cancel': '/payment/app_cancel',
  'payment-book-success': '/payment/book_success',
  'payment-book-cancel': '/payment/book_cancel'
};

function navigateTo(viewId) {
  if (viewId === CURRENT_VIEW) { closeDropdown(); document.getElementById("mobile-menu")?.classList.add("hidden"); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const target = ROUTE_MAP[viewId];
  if (target) window.location.href = target;
}

function setActiveNav(viewId) {
  document.querySelectorAll('nav a[data-nav], #mobile-menu a[data-nav]').forEach(a => { a.classList.toggle('text-purple', a.dataset.nav === viewId); });
}

// Same-page anchor scroll if we're already on the home page (where
// #features/#pricing/#faq live); otherwise a real navigation to home
// with the section as a hash, picked up by the hash-check in window.onload.
function goToSection(elementId) {
  if (CURRENT_VIEW === 'home') { scrollAndHighlight(elementId); }
  else { window.location.href = '/#' + elementId; }
}

function scrollAndHighlight(elementId) {
  setTimeout(() => {
    const el = document.getElementById(elementId);
    if (el) { el.scrollIntoView({ behavior: 'smooth' }); el.classList.add('ring-4', 'ring-purple/20'); setTimeout(() => el.classList.remove('ring-4', 'ring-purple/20'), 1500); }
  }, 300);
}

function closeDropdown() {
  if (userDropdown) userDropdown.classList.remove("open");
  if (dropdownButton) dropdownButton.setAttribute("aria-expanded", "false");
}

function spawnToast(title, description, iconClass = 'fa-circle-check', type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = "bg-white border border-line p-4 rounded-2xl shadow-luxe flex items-start gap-3 w-80 pointer-events-auto cursor-pointer border-l-4 z-[9999]";
  if (type === 'success') { toast.classList.add('border-l-green'); }
  else if (type === 'warning') { toast.classList.add('border-l-yellow'); }
  else { toast.classList.add('border-l-purple'); }
  toast.innerHTML = `<div class="text-purple text-base pt-0.5"><i class="${iconClass}"></i></div><div class="flex-1"><h4 class="text-xs font-black text-title uppercase tracking-wider">${title}</h4><p class="text-[11px] text-body mt-0.5">${description}</p></div>`;
  toast.onclick = () => toast.remove();
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('opacity-0', 'transition-opacity', 'duration-500'); setTimeout(() => toast.remove(), 500); }, 4000);
}

function openAuthModal(mode = "landing") {
  authModal.classList.remove("hidden"); authModal.classList.add("grid"); authModal.setAttribute("aria-hidden", "false"); authMessage.textContent = "";
  if (mode === "signup") { setAuthMode("signup"); } else { showAuthLanding(); }
}
function closeAuthModal() { authModal.classList.add("hidden"); authModal.classList.remove("grid"); authModal.setAttribute("aria-hidden", "true"); }
function showAuthLanding() { document.getElementById("authLandingPanel").classList.remove("hidden"); document.getElementById("authFormPanel").classList.add("hidden"); }
function showAuthForm() { document.getElementById("authLandingPanel").classList.add("hidden"); document.getElementById("authFormPanel").classList.remove("hidden"); setTimeout(() => document.getElementById("authEmail").focus(), 50); }

// Shared handler for every "Start Free Trial" / "Sign Up Free" CTA (hero,
// pricing trial card, demo feedback prompt). A signed-in visitor should
// never see the login/signup modal again -- the trial itself is redeemed
// inside the desktop app, not on the website, so point them there instead.
function startFreeTrial() {
  if (window.currentSupabaseUser) { openStartTrialModal(); return; }
  openAuthModal("signup");
}

function openStartTrialModal() {
  const message = document.getElementById("startTrialMessage");
  if (message) {
    message.textContent = currentLicense?.trial_redeemed
      ? "Your account has already redeemed its one-time free trial. Download the app to sign in and pick up where you left off, or check your plan from your account page."
      : "Download the Studio Photuna Booth App and activate your 14-day free trial right from inside the app — no credit card required.";
  }
  const modal = document.getElementById("startTrialModal");
  modal.classList.remove("hidden"); modal.classList.add("grid"); modal.setAttribute("aria-hidden", "false");
}

function closeStartTrialModal() {
  const modal = document.getElementById("startTrialModal");
  modal.classList.add("hidden"); modal.classList.remove("grid"); modal.setAttribute("aria-hidden", "true");
}

function openTrialInfoModal() {
  const modal = document.getElementById("trialInfoModal");
  modal.classList.remove("hidden"); modal.classList.add("grid"); modal.setAttribute("aria-hidden", "false");
}

function closeTrialInfoModal() {
  const modal = document.getElementById("trialInfoModal");
  modal.classList.add("hidden"); modal.classList.remove("grid"); modal.setAttribute("aria-hidden", "true");
}

// Works for both first-time and returning users -- Supabase creates the
// auth.users row (and, via the on_auth_user_created DB trigger, the
// matching profiles row) automatically on first Google sign-in, so no
// separate signup path is needed here like the email/password flow has.
async function signInWithGoogle() {
  if (!supabaseClient) { spawnToast("Unavailable", "Supabase client not loaded.", "fa-solid fa-triangle-exclamation", "warning"); return; }
  setAuthMessage("Redirecting to Google...");
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/account` }
  });
  if (error) setAuthMessage(error.message || "Could not start Google sign-in.", true);
}

async function sendPasswordReset() {
  const email = document.getElementById("authEmail").value.trim();
  if (!email) { setAuthMessage("Enter your email above, then tap 'Forgot password?' again.", true); document.getElementById("authEmail").focus(); return; }
  if (!supabaseClient) { setAuthMessage("Service temporarily unavailable.", true); return; }
  setAuthMessage("Sending reset link...");
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
  if (error) setAuthMessage(error.message || "Could not send reset email.", true);
  else { setAuthMessage("Check your email for a password reset link.", false); spawnToast("Reset Link Sent", `We emailed a password reset link to ${email}.`, "fa-solid fa-envelope", "success"); }
}

function setAuthMode(mode) {
  authMode = mode;
  showAuthForm();
  document.querySelectorAll(".auth-tab").forEach((tab) => {
    const isActive = tab.dataset.authTab === mode;
    tab.classList.toggle("active", isActive); tab.classList.toggle("bg-white", isActive); tab.classList.toggle("text-purple", isActive); tab.classList.toggle("text-muted", !isActive);
  });
  authName.style.display = mode === "signup" ? "block" : "none";
  authName.toggleAttribute("required", mode === "signup");
  const authConsentEl = document.getElementById("authConsent");
  if (authConsentEl) { authConsentEl.classList.toggle("hidden", mode !== "signup"); authConsentEl.classList.toggle("flex", mode === "signup"); }
  const authForgotLinkEl = document.getElementById("authForgotLink");
  if (authForgotLinkEl) authForgotLinkEl.classList.toggle("hidden", mode !== "login");
  authPassword.setAttribute("placeholder", mode === "signup" ? "Create a Password" : "Password");
  authSubmit.textContent = mode === "signup" ? "Create Free Account" : "Sign In";
}

function setAuthMessage(message, isError = false) { authMessage.textContent = message; authMessage.style.color = isError ? "#dc2626" : "var(--body)"; }

function initialsFor(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0] || "";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderAvatar(container, avatarUrl, name, email) {
  if (!container) return;
  if (avatarUrl) {
    container.innerHTML = `<img src="${avatarUrl}" alt="Profile photo" class="w-full h-full object-cover" />`;
  } else {
    container.textContent = initialsFor(name, email);
  }
}

// The profile/license fetch feeds the header (avatar, admin badge) on
// EVERY page, so it always runs here. Writing the fetched data into
// #view-account's own fields is split out into populateAccountPage,
// which self-guards since that DOM only exists on account.html.
async function loadAccountState(user) {
  if (!user) { currentProfile = null; currentLicense = null; updateAuthUi(null); populateAccountPage(user); return; }
  if (supabaseClient) {
    try {
      const [{ data: profile }, { data: license }] = await Promise.all([
        supabaseClient.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabaseClient.from("licenses").select("*").eq("user_id", user.id).maybeSingle()
      ]);
      currentProfile = profile; currentLicense = license;
      // First sign-in via Google: backfill the profile photo from their
      // Google account once, without overwriting a custom-uploaded avatar.
      const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture;
      if (profile && !profile.avatar_url && googleAvatar) {
        supabaseClient.from("profiles").upsert({ id: user.id, avatar_url: googleAvatar }).then(({ error }) => {
          if (!error) { currentProfile.avatar_url = googleAvatar; renderAvatar(document.getElementById("navAvatar"), googleAvatar, profile.full_name, user.email); }
        });
      }
    } catch (err) { console.warn("Unable to fetch account/profile data", err); }
  }
  updateAuthUi(user);
  populateAccountPage(user);
}

function populateAccountPage(user) {
  const signedOutPanel = document.getElementById('signedOutPanel');
  const accountPanel = document.getElementById('accountPanel');
  if (!signedOutPanel || !accountPanel) return;
  if (!user) { signedOutPanel.classList.remove('hidden'); accountPanel.classList.add('hidden'); return; }
  signedOutPanel.classList.add('hidden'); accountPanel.classList.remove('hidden');
  const profile = currentProfile, license = currentLicense;
  document.getElementById("profileName").textContent = profile?.full_name || user.email;
  document.getElementById("profileMeta").textContent = user.email;
  renderAvatar(document.getElementById("avatarPreview"), profile?.avatar_url, profile?.full_name, user.email);
  document.getElementById("accountCompany").textContent = profile?.company || "-";
  document.getElementById("accountPhone").textContent = profile?.phone || "-";
  document.getElementById("accountPlan").textContent = formatStatus(license?.plan || profile?.subscription_plan || "free");
  document.getElementById("accountStatus").textContent = formatStatus(license?.state || "unsubscribed");
  document.getElementById("accountTrial").textContent = license?.trial_redeemed ? "Yes" : "No";
  document.getElementById("accountGallery").textContent = (() => {
    // Show the gallery tier (Free / Plus / Business); fall back to the legacy boolean.
    const tier = license?.gallery_tier || (license?.gallery_addon ? "plus" : "free");
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  })();
  document.getElementById("profileFullName").value = profile?.full_name || "";
  document.getElementById("profileCompany").value = profile?.company || "";
  document.getElementById("profilePhone").value = profile?.phone || "";
  renderRenewalBanner(license); setBillingPlan(selectedBilling);
}

function renderRenewalBanner(license) {
  const banner = document.getElementById("renewalBanner");
  const title = document.getElementById("renewalBannerTitle");
  const subtitle = document.getElementById("renewalBannerSubtitle");
  const btn = document.getElementById("renewalBannerBtn");
  if (!banner) return;
  if (!license || license.state === "pending") { banner.classList.remove("flex"); banner.classList.add("hidden"); return; }
  if (license.state === "pending_verification") {
    banner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 bg-blue-50 border border-blue-300 rounded-2xl p-5";
    title.className = "text-sm font-bold text-blue-900"; title.textContent = "Payment under review";
    subtitle.textContent = "We received your GCash payment proof and are verifying it — this usually takes under a day."; btn.classList.add("hidden"); return;
  }
  const periodEnd = license.current_period_end ? new Date(license.current_period_end) : null;
  const now = new Date();
  const daysLeft = periodEnd ? Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24)) : null;
  const formattedDate = periodEnd ? periodEnd.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : null;
  banner.classList.remove("hidden"); banner.classList.add("flex");
  if (license.state === "active" && daysLeft !== null && daysLeft > 7) {
    banner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 bg-grey border border-line rounded-2xl p-5";
    title.className = "text-sm font-bold text-title"; title.textContent = "Plan active";
    subtitle.textContent = `Renews manually -- valid through ${formattedDate}.`; btn.classList.add("hidden");
  } else if (license.state === "active" && daysLeft === null) {
    banner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 bg-grey border border-line rounded-2xl p-5";
    title.className = "text-sm font-bold text-title"; title.textContent = "Plan active";
    subtitle.textContent = "No renewal date on file -- contact support if this looks wrong."; btn.classList.add("hidden");
  } else if (license.state === "active" && daysLeft !== null && daysLeft >= 0) {
    banner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 bg-yellow-50 border border-yellow-300 rounded-2xl p-5";
    title.className = "text-sm font-bold text-yellow-900";
    title.textContent = `Plan expires ${daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}`;
    subtitle.textContent = `Valid through ${formattedDate}. Renew now to keep access without interruption.`; btn.classList.remove("hidden");
  } else {
    banner.className = "flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-50 border border-red-300 rounded-2xl p-5";
    title.className = "text-sm font-bold text-red-900"; title.textContent = "Plan expired";
    subtitle.textContent = formattedDate ? `Access lapsed on ${formattedDate}. Renew to restore Pro features.` : "Renew to unlock Pro features."; btn.classList.remove("hidden");
  }
}

function formatStatus(value) { if (!value) return "None"; return String(value).replace(/[_-]/g, " ").replace(/\b\w/g, l => l.toUpperCase()); }

function updateAuthUi(user) {
  if (user) {
    userPill.textContent = user.email; userDropdown.classList.remove("hidden"); userDropdown.classList.add("inline-block");
    renderAvatar(document.getElementById("navAvatar"), currentProfile?.avatar_url, currentProfile?.full_name, user.email);
    document.getElementById("loginOpen").style.display = "none";
    if (adminBookingsOpen) { adminBookingsOpen.classList.toggle("hidden", !isAdminProfile(currentProfile)); adminBookingsOpen.classList.toggle("flex", isAdminProfile(currentProfile)); }
  } else {
    userDropdown.classList.add("hidden"); userDropdown.classList.remove("inline-block"); document.getElementById("loginOpen").style.display = "inline-flex";
  }
}

function isAdminProfile(profile) { return ["admin", "superadmin"].includes(String(profile?.role || "").toLowerCase()); }

let _appliedDiscount = null; // {code, discount_type, discount_value} once validated via applyDiscountCode()

function setBillingPlan(plan) {
  selectedBilling = billingPlans[plan] ? plan : "yearly";
  const selected = billingPlans[selectedBilling];
  clearAppliedDiscount(); // discount validity/eligibility can differ per billing cycle -- require re-checking
  billingToggleButtons.forEach((button) => {
    const isActive = button.dataset.billing === selectedBilling;
    button.classList.toggle("active", isActive); button.classList.toggle("bg-white", isActive); button.classList.toggle("text-title", isActive);
    if (isActive) { button.classList.add("shadow-sm"); } else { button.classList.remove("shadow-sm"); }
  });
  if (proPlanBadge) proPlanBadge.textContent = selected.badge;
  if (proPlanPrice) proPlanPrice.innerHTML = selected.price;
  if (proPlanNote) proPlanNote.textContent = selected.note;
  if (proPlanDetails) { proPlanDetails.innerHTML = selected.details.map(d => `<li class="flex items-center gap-2"><i class="fa-solid fa-circle-check text-purple"></i> ${d}</li>`).join(""); }
  if (proPlanCta) {
    proPlanCta.dataset.plan = selectedBilling;
    const blocker = getSubscriptionBlocker(currentLicense, selectedBilling);
    if (blocker?.type === "block" && blocker.title === "Plan Already Active") {
      proPlanCta.textContent = "Current Plan -- Active"; proPlanCta.disabled = true; proPlanCta.classList.add("opacity-60", "cursor-not-allowed");
    } else { proPlanCta.textContent = selected.cta; proPlanCta.disabled = false; proPlanCta.classList.remove("opacity-60", "cursor-not-allowed"); }
  }
}

billingToggleButtons.forEach((button) => {
  button.addEventListener("click", () => { setBillingPlan(button.dataset.billing); spawnToast("Billing Plan Updated", `Switched pricing plan views to ${button.dataset.billing}.`, "fa-solid fa-sync", "success"); });
});

// ===================================================================
// Subscription, GCash payment, checkout
// ===================================================================

// Admin-configurable via the Bookings Admin > Settings tab. Falls back to
// manual_gcash (the safe, always-working default) on any error so a
// settings-fetch hiccup never blocks a subscription attempt. Only Stripe
// has real recurring billing wired up right now -- PayMongo/Xendit/PayPal
// fall back to the Manual GCash flow the same way, until each gets its own
// recurring-billing integration.
async function getActiveAppGateway() {
  if (!supabaseClient) return "manual_gcash";
  try {
    const { data, error } = await supabaseClient.from("payment_gateway_settings").select("provider").eq("context", "app").maybeSingle();
    if (error || !data) return "manual_gcash";
    return data.provider;
  } catch { return "manual_gcash"; }
}

// supabase-js's functions.invoke() only ever sets error.message to a
// generic "Edge Function returned a non-2xx status code" on failure --
// the actual `{ error: "..." }` reason our own functions return in the
// response body has to be read separately from error.context (the raw
// Response object).
async function resolveFunctionError(error) {
  if (error?.context && typeof error.context.json === "function") {
    try {
      const body = await error.context.json();
      if (body?.error) return new Error(body.error);
    } catch (_) { /* body wasn't JSON, or was already consumed -- fall through */ }
  }
  return error;
}

function clearAppliedDiscount() {
  _appliedDiscount = null;
  const msg = document.getElementById("discountCodeMessage");
  if (msg) { msg.textContent = ""; msg.classList.add("hidden"); msg.classList.remove("text-green-300", "text-red-300"); }
}

// Read-only pre-check via validate-discount-code -- lets a visitor see
// whether their code actually works (and what it's worth) before they
// commit to checkout. The code isn't consumed here; that only happens
// once payment clears, inside create-subscription-checkout-session and
// the payment-confirmation webhooks.
async function applyDiscountCode() {
  const input = document.getElementById("discountCodeField");
  const btn = document.getElementById("discountApplyBtn");
  const msg = document.getElementById("discountCodeMessage");
  const code = input?.value?.trim();
  if (!msg) return;
  if (!code) { msg.textContent = "Enter a code first."; msg.classList.remove("hidden", "text-green-300"); msg.classList.add("text-red-300"); return; }
  if (!window.currentSupabaseUser) {
    spawnToast("Sign In Required", "Log in first so we can check this code against your account.", "fa-solid fa-user-lock", "warning");
    openAuthModal("signup");
    return;
  }
  if (!supabaseClient) { msg.textContent = "Service temporarily unavailable."; msg.classList.remove("hidden", "text-green-300"); msg.classList.add("text-red-300"); return; }
  clearAppliedDiscount();
  const originalLabel = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = "Checking..."; }
  msg.classList.remove("hidden", "text-green-300", "text-red-300");
  msg.textContent = "Checking code...";
  try {
    const { data, error } = await supabaseClient.functions.invoke("validate-discount-code", { body: { code, plan: selectedBilling } });
    if (error) throw await resolveFunctionError(error);
    if (!data?.valid) throw new Error(data?.error || "This code isn't valid.");
    _appliedDiscount = { code: data.code, discount_type: data.discount_type, discount_value: data.discount_value };
    const baseAmount = PHP_AMOUNTS[selectedBilling];
    const discounted = data.discount_type === "percent"
      ? Math.max(0, Math.round(baseAmount * (1 - data.discount_value / 100)))
      : Math.max(0, Math.round(baseAmount - data.discount_value));
    msg.textContent = `"${data.code}" applied — new total ${formatPhp(discounted)} (was ${formatPhp(baseAmount)}).`;
    msg.classList.add("text-green-300");
  } catch (err) {
    msg.textContent = err.message || "Could not validate this code.";
    msg.classList.add("text-red-300");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = originalLabel; }
  }
}

async function handleSubscribePlan(triggerId) {
  if (!window.currentSupabaseUser) { spawnToast("Authentication Needed", "Please log in before choosing a license plan.", "fa-solid fa-user-lock", "warning"); openAuthModal("signup"); return; }
  if (!supabaseClient) { spawnToast("Unavailable", "Supabase client not loaded.", "fa-solid fa-triangle-exclamation", "warning"); return; }
  const requestedBilling = triggerId === "renewalBannerBtn"
    ? (currentLicense?.plan === "pro_yearly" ? "yearly" : currentLicense?.plan === "pro_monthly" ? "monthly" : selectedBilling)
    : selectedBilling;
  const blocker = getSubscriptionBlocker(currentLicense, requestedBilling);
  if (blocker) { if (blocker.type === "confirm") { if (!window.confirm(blocker.message)) return; } else { spawnToast(blocker.title, blocker.message, "fa-solid fa-circle-info", "warning"); return; } }
  const gateway = await getActiveAppGateway();
  if (gateway === "manual_gcash") { openGcashModal(requestedBilling); return; }
  const ctas = [document.getElementById("proPlanCta"), document.getElementById("renewalBannerBtn")].filter(Boolean);
  const originalLabels = ctas.map((el) => el.textContent);
  ctas.forEach((el) => { el.disabled = true; el.textContent = "Redirecting to checkout..."; });
  spawnToast("Processing", "Connecting to checkout...", "fa-solid fa-arrows-spin", "info");
  const discountCode = document.getElementById("discountCodeField")?.value?.trim() || null;
  try {
    // Stripe keeps its own true recurring subscription; PayMongo/Xendit/
    // PayPal charge once for the selected billing period (no
    // auto-renewal yet) via a separate function.
    const functionName = gateway === "stripe" ? "create-checkout-session" : "create-subscription-checkout-session";
    const { data, error } = await supabaseClient.functions.invoke(functionName, { body: { billing: requestedBilling, discount_code: discountCode } });
    if (error) throw await resolveFunctionError(error);
    if (!data?.url) {
      // A discount-code validation failure (bad/expired/already-used code)
      // surfaces here as a clean error message instead of a checkout URL --
      // stop and show it rather than silently proceeding at full price.
      throw new Error(data?.error || "No checkout URL returned.");
    }
    window.location.href = data.url;
  } catch (err) {
    console.error("Checkout session error:", err);
    ctas.forEach((el, i) => { el.disabled = false; el.textContent = originalLabels[i]; });
    if (discountCode && /discount|code/i.test(err.message || "")) {
      spawnToast("Discount Code", err.message, "fa-solid fa-tag", "warning");
      return;
    }
    if (gateway !== "stripe") {
      // Non-Stripe online checkout failed (e.g. missing provider
      // credentials) -- fall back to the always-working Manual GCash
      // flow instead of leaving the customer with no way to pay.
      openGcashModal(requestedBilling);
      return;
    }
    spawnToast("Checkout Failed", err.message || "Could not start checkout. Please try again.", "fa-solid fa-circle-exclamation", "warning");
  }
}

function getSubscriptionBlocker(license, requestedBilling) {
  if (!license) return null;
  if (license.state === "pending_verification") { return { type: "block", title: "Payment Already Under Review", message: "Your last GCash payment proof is still being verified. Please wait for confirmation before submitting another payment, or contact support if it's been more than a day." }; }
  if (license.state === "active" && license.current_period_end) {
    const daysLeft = Math.ceil((new Date(license.current_period_end) - new Date()) / (1000 * 60 * 60 * 24));
    const currentBilling = license.plan === "pro_yearly" ? "yearly" : license.plan === "pro_monthly" ? "monthly" : null;
    if (daysLeft > 7 && currentBilling) {
      const formattedDate = new Date(license.current_period_end).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
      if (currentBilling === requestedBilling) { return { type: "block", title: "Plan Already Active", message: `You already have an active ${requestedBilling} plan, valid through ${formattedDate}. No need to pay again yet -- check back closer to your renewal date.` }; }
      return { type: "confirm", message: `You have an active ${currentBilling} plan through ${formattedDate}. Switching to ${requestedBilling} now starts a new period once verified, and the remaining ${currentBilling} time won't be automatically refunded or carried over. Continue anyway?` };
    }
  }
  return null;
}

let gcashModalBilling = "monthly";
function openGcashModal(defaultBilling) {
  document.getElementById("gcashMessage").textContent = ""; document.getElementById("gcashProofForm").reset();
  setGcashModalBilling(defaultBilling || selectedBilling);
  gcashModal.classList.remove("hidden"); gcashModal.classList.add("grid"); gcashModal.setAttribute("aria-hidden", "false");
}

function setGcashModalBilling(billing) {
  gcashModalBilling = PHP_AMOUNTS[billing] !== undefined ? billing : "monthly";
  document.querySelectorAll(".gcash-billing-toggle").forEach((btn) => {
    const isActive = btn.dataset.gcashBilling === gcashModalBilling;
    btn.classList.toggle("active", isActive); btn.classList.toggle("bg-white", isActive); btn.classList.toggle("text-title", isActive); btn.classList.toggle("shadow-sm", isActive); btn.classList.toggle("text-muted", !isActive);
  });
  const amount = PHP_AMOUNTS[gcashModalBilling] || 0;
  const perMonth = gcashModalBilling === "yearly" ? ` · ₱${Math.round(amount / 12).toLocaleString("en-PH")}/mo` : "";
  document.getElementById("gcashAmountDue").textContent = `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}${perMonth}`;
}

function closeGcashModal() { gcashModal.classList.add("hidden"); gcashModal.classList.remove("grid"); gcashModal.setAttribute("aria-hidden", "true"); }

async function handleGcashProofSubmit(evt) {
  evt.preventDefault();
  if (!window.currentSupabaseUser || !supabaseClient) { spawnToast("Authentication Needed", "Please log in first.", "fa-solid fa-user-lock", "warning"); return; }
  const message = document.getElementById("gcashMessage");
  const submitBtn = document.getElementById("gcashSubmitBtn");
  const senderName = document.getElementById("gcashSenderName").value.trim();
  const referenceNumber = document.getElementById("gcashReferenceNumber").value.trim();
  const fileInput = document.getElementById("gcashScreenshot");
  const file = fileInput.files?.[0];
  if (!file) { message.className = "text-center text-xs font-bold text-red-600"; message.textContent = "Please attach a screenshot of your GCash receipt."; return; }
  submitBtn.disabled = true; submitBtn.textContent = "Checking...";
  message.className = "text-center text-xs font-bold text-body"; message.textContent = "";
  try {
    const { data: existing } = await supabaseClient.from("payment_proofs").select("id, status, billing, created_at").eq("user_id", window.currentSupabaseUser.id).in("status", ["pending", "approved"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      const isPending = existing.status === "pending";
      message.className = "text-center text-xs font-bold text-red-600";
      message.textContent = isPending ? "You already have a payment proof under review. Please wait for it to be verified before submitting another." : "Your current plan is already active. No additional payment is needed until your plan expires.";
      submitBtn.disabled = false; submitBtn.textContent = "Submit Proof"; return;
    }
    submitBtn.textContent = "Uploading...";
    const user = window.currentSupabaseUser;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage.from("payment-proofs").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) throw uploadError;
    submitBtn.textContent = "Submitting...";
    const { data: submitData, error: submitError } = await supabaseClient.functions.invoke("submit-payment-proof", { body: { billing: gcashModalBilling, amount_php: PHP_AMOUNTS[gcashModalBilling] || 0, gcash_reference_number: referenceNumber, gcash_sender_name: senderName || null, screenshot_path: path } });
    if (submitError) throw submitError;
    if (submitData?.error) throw new Error(submitData.error);
    spawnToast("Payment Proof Submitted", "We'll verify and activate your plan shortly.", "fa-solid fa-circle-check", "success");
    closeGcashModal(); await loadAccountState(user); navigateTo("account");
  } catch (err) {
    console.error("Payment proof submission error:", err);
    message.className = "text-center text-xs font-bold text-red-600"; message.textContent = err.message || "Could not submit your proof. Please try again.";
  } finally { submitBtn.disabled = false; submitBtn.textContent = "Submit Payment Proof"; }
}

async function verifyPendingPayment() {
  if (!window.currentSupabaseUser || !supabaseClient) return;
  spawnToast("Confirming Payment", "Checking your payment status...", "fa-solid fa-arrows-spin", "info");
  try {
    const { data, error } = await supabaseClient.functions.invoke("verify-checkout-session", { body: {} });
    if (error) throw error;
    if (data?.verified) { spawnToast("Payment Confirmed", "Your Pro plan is now active.", "fa-solid fa-circle-check", "success"); }
    else { spawnToast("Still Processing", "We couldn't confirm payment yet. If you paid via GCash/Maya and this persists, contact support to activate manually.", "fa-solid fa-circle-info", "warning"); }
  } catch (err) { console.error("Verify payment error:", err); spawnToast("Couldn't Confirm Payment", "Please refresh, or contact support if you were charged.", "fa-solid fa-circle-exclamation", "warning"); }
  finally { await loadAccountState(window.currentSupabaseUser); }
}

// ===================================================================
// Booking Wizard
// ===================================================================

function buildWizardProgress() {
  if (!bookingWizardProgress) return;
  bookingWizardProgress.innerHTML = "";
  for (let i = 0; i < totalBookingSteps; i++) {
    const dot = document.createElement("span");
    dot.className = "wizard-dot h-1.5 rounded-full bg-[#e7e8ef] transition-all duration-300";
    bookingWizardProgress.appendChild(dot);
  }
}

function showBookingStep(step) {
  currentBookingStep = Math.min(totalBookingSteps - 1, Math.max(0, step));
  document.querySelectorAll(".flow-step[data-step]").forEach((el) => { el.classList.toggle("active", Number(el.dataset.step) === currentBookingStep); el.classList.toggle("hidden", Number(el.dataset.step) !== currentBookingStep); });
  document.querySelectorAll(".wizard-dot").forEach((dot, idx) => { dot.classList.toggle("active", idx <= currentBookingStep); dot.classList.toggle("bg-purple", idx <= currentBookingStep); dot.classList.toggle("bg-[#e7e8ef]", idx > currentBookingStep); });
  if (bookingPrevStep) bookingPrevStep.disabled = currentBookingStep === 0;
  const isLast = currentBookingStep === totalBookingSteps - 1;
  bookingNextStep.classList.toggle("hidden", isLast);
  bookingSubmit.classList.toggle("hidden", !isLast);
  const showQuote = currentBookingStep >= 1;
  document.getElementById("quoteSummary")?.classList.toggle("hidden", !showQuote);
  setBookingMessage("");
  renderBookingProgress();
}

function renderBookingProgress() {
  const list = document.getElementById("bookingProgressList");
  if (!list) return;
  list.innerHTML = BOOKING_STEP_LABELS.map((label, idx) => {
    const isDone = idx < currentBookingStep;
    const isCurrent = idx === currentBookingStep;
    const dotClass = isDone
      ? "bg-purple text-white border-purple"
      : isCurrent
      ? "bg-white text-purple border-purple ring-4 ring-purple/15"
      : "bg-white text-muted border-line";
    const labelClass = isCurrent ? "text-title font-black" : isDone ? "text-title font-bold" : "text-muted font-bold";
    const connector = idx < BOOKING_STEP_LABELS.length - 1
      ? `<div class="w-0.5 flex-1 min-h-[14px] ${isDone ? "bg-purple" : "bg-line"}"></div>`
      : "";
    return `<div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div class="w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors ${dotClass}">${isDone ? '<i class="fa-solid fa-check text-[10px]"></i>' : idx + 1}</div>
        ${connector}
      </div>
      <div class="${idx < BOOKING_STEP_LABELS.length - 1 ? "pb-4" : ""}">
        <p class="text-xs ${labelClass}">${label}</p>
      </div>
    </div>`;
  }).join("");
}

function validateCurrentStep() {
  if (currentBookingStep === 0 && !selectedBookingDate) { setBookingMessage("Please choose your event date from the availability calendar."); return false; }
  if (currentBookingStep === 1 && !selectedPackages().length) { setBookingMessage("Please select at least one package before proceeding."); return false; }
  if (currentBookingStep === 2) {
    if (!bookingDate.value) { setBookingMessage("Choose your event date from the calendar step."); return false; }
    if (!bookingVenueCity.value || !bookingVenueName.value || !bookingVenueAddress.value) { setBookingMessage("Complete all schedule and city fields before proceeding."); return false; }
  }
  if (currentBookingStep === 3) {
    if (!document.getElementById("bookingName").value || !bookingPhone.value || !bookingGuests.value) { setBookingMessage("Complete your contact names and expected guest metrics."); return false; }
    const guests = Number(bookingGuests.value);
    if (guests < 1) { setBookingMessage("Please enter a valid expected guest count."); return false; }
  }
  return true;
}

function selectedPackage() { const sel = selectedPackages(); return sel.length ? sel[0] : null; }

function selectedPackages() {
  return Object.values(packageCatalog).filter(pkg => {
    const key = Object.keys(packageCatalog).find(k => packageCatalog[k] === pkg);
    const el = document.getElementById(`wpkg_${key}`);
    return el && el.checked;
  });
}

function getCheckedPackageKeys() { return Object.keys(packageCatalog).filter(k => document.getElementById(`wpkg_${k}`)?.checked); }

function selectedExtraHours() { return Math.min(3, Math.max(0, Number(bookingExtraHours?.value || 0))); }

function calculateQuote() {
  const pkgs = selectedPackages(); const extraHours = selectedExtraHours();
  const subtotal = pkgs.reduce((s, p) => s + p.price, 0);
  const extraCost = pkgs.reduce((s, p) => s + extraHours * p.extraRate, 0);
  const discount = pkgs.length >= 2 ? COMBO_DISCOUNT : 0;
  const total = subtotal + extraCost - discount;
  return { pkgs, extraHours, subtotal, extraCost, discount, total };
}

function renderQuote() {
  const { pkgs, extraHours, subtotal, extraCost, discount, total } = calculateQuote();
  const guests = parseInt(bookingGuests?.value || "0"); const isCustom = guests > 300;
  if (packageBreakdown) {
    if (!pkgs.length) { packageBreakdown.innerHTML = `<h4 class="font-bold text-title text-sm">Select packages to see inclusions</h4>`; }
    else { packageBreakdown.innerHTML = pkgs.map(pkg => `<div class="mb-3"><h4 class="font-bold text-title text-sm">${pkg.name}</h4><ul class="text-xs text-body space-y-1 mt-1">${pkg.included.map(inc => `<li>• ${inc}</li>`).join("")}</ul></div>`).join('<hr class="border-line my-2" />'); }
  }
  if (quoteSummaryList) {
    if (isCustom) {
      quoteSummaryList.innerHTML = pkgs.map(p => `<li class="flex justify-between"><span>${p.name}</span><strong>PHP ${p.price.toLocaleString()}</strong></li>`).join("")
        + `<li class="flex justify-between border-t border-white/10 pt-2 mt-2"><span colspan="2" class="text-yellow-300 text-xs"><i class="fa-solid fa-circle-info mr-1"></i>300+ guests — Custom Quote required. Our team will reach out to you with a personalized rate.</span></li>`;
    } else {
      quoteSummaryList.innerHTML = pkgs.map(p => `<li class="flex justify-between"><span>${p.name}</span><strong>PHP ${p.price.toLocaleString()}</strong></li>`).join("")
        + (discount ? `<li class="flex justify-between text-yellow-300"><span>Combo Discount</span><strong>-PHP ${discount.toLocaleString()}</strong></li>` : "")
        + `<li class="flex justify-between"><span>Overtime (${extraHours} hrs)</span><strong>PHP ${extraCost.toLocaleString()}</strong></li>`
        + `<li class="flex justify-between border-t border-white/10 pt-1 mt-1 font-bold"><span>50% Deposit</span><strong>PHP ${pkgs.length ? ((total) / 2).toLocaleString() : "0"}</strong></li>`;
    }
  }
  if (quoteTotal) { quoteTotal.textContent = isCustom ? "Custom Quote" : `PHP ${total.toLocaleString()}`; }
}

function toDateKey(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

function renderBookingCalendar() {
  if (!bookingCalendar || !bookingCalendarMonth) return;
  const monthStart = new Date(visibleBookingMonth.getFullYear(), visibleBookingMonth.getMonth(), 1);
  const monthEnd = new Date(visibleBookingMonth.getFullYear(), visibleBookingMonth.getMonth() + 1, 0);
  bookingCalendarMonth.textContent = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(monthStart);
  bookingCalendar.innerHTML = "";
  for (let i = 0; i < monthStart.getDay(); i++) { const space = document.createElement("span"); space.className = "calendar-day empty"; bookingCalendar.appendChild(space); }
  const todayKey = toDateKey(new Date());
  for (let d = 1; d <= monthEnd.getDate(); d++) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), d);
    const dateKey = toDateKey(date); const blocked = unavailableBookingDates.has(dateKey); const past = dateKey < todayKey;
    const cell = document.createElement("button"); cell.type = "button";
    cell.className = "calendar-day min-h-[40px] text-xs font-bold rounded-lg transition-colors border"; cell.textContent = d;
    if (blocked) { cell.className += " bg-red-100 text-red-700 border-red-200 cursor-not-allowed"; cell.disabled = true; }
    else if (past) { cell.className += " bg-grey text-muted border-transparent opacity-40 cursor-not-allowed"; cell.disabled = true; }
    else { cell.className += " bg-white text-title border-line hover:border-purple"; }
    if (dateKey === selectedBookingDate) { cell.className = "calendar-day min-h-[40px] text-xs font-black rounded-lg transition-colors border bg-purple text-white border-purple shadow-sm"; }
    cell.onclick = () => { selectedBookingDate = dateKey; bookingDate.value = dateKey; bookingDateDisplay.value = date.toLocaleDateString("en", { dateStyle: "long" }); renderBookingCalendar(); spawnToast("Slot Selected", `Selected event date: ${bookingDateDisplay.value}`, "fa-solid fa-calendar-check", "success"); };
    bookingCalendar.appendChild(cell);
  }
}

async function loadBookingAvailability() {
  if (!supabaseClient) { if (availabilityStatus) availabilityStatus.textContent = "Supabase client not loaded."; return; }
  try {
    // Query both tables for booked dates
    const [calRes, bookRes] = await Promise.all([
      supabaseClient.from("booking_calendar_days").select("event_date"),
      supabaseClient.from("event_bookings").select("event_date").not("status", "eq", "cancelled").not("status", "eq", "declined")
    ]);
    unavailableBookingDates = new Set();
    ((calRes.data || []).concat(bookRes.data || [])).forEach(r => r.event_date && unavailableBookingDates.add(r.event_date));
    if (availabilityStatus) availabilityStatus.textContent = "Live calendar slots synced.";
    renderBookingCalendar();
  } catch (err) { console.warn("Unable to fetch booking availability limits", err); }
}

function setBookingMessage(message, isError = true) { if (!bookingMessage) return; bookingMessage.textContent = message || ""; bookingMessage.style.color = isError ? "#dc2626" : "#22c55e"; }

// Admin-configurable via the Bookings Admin > Settings tab. Falls back to
// manual_gcash (today's default) on any error so a settings-fetch hiccup
// never blocks a booking submission.
async function getActiveBookingGateway() {
  if (!supabaseClient) return "manual_gcash";
  try {
    const { data, error } = await supabaseClient.from("payment_gateway_settings").select("provider").eq("context", "book").maybeSingle();
    if (error || !data) return "manual_gcash";
    return data.provider;
  } catch { return "manual_gcash"; }
}

const ONLINE_BOOKING_GATEWAYS = ["stripe", "paymongo", "xendit", "paypal"];

async function applyBookingPaymentModeNote() {
  const el = document.getElementById("bookingPaymentModeNote");
  if (!el) return;
  const gateway = await getActiveBookingGateway();
  if (ONLINE_BOOKING_GATEWAYS.includes(gateway)) {
    el.innerHTML = 'A 50% deposit is collected securely online right after you submit this request. The remaining balance is payable on or before event day unless coordinated otherwise. Confirmation replies will arrive from <span class="text-purple">notification@studiophotuna.com</span>.';
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  if (!supabaseClient) { setBookingMessage("Database gateway offline. Try again shortly."); return; }
  const submitBtn = document.getElementById("bookingSubmit"); submitBtn.disabled = true; setBookingMessage("Submitting your request details...", false);
  const { pkgs, extraHours, subtotal, extraCost, discount, total } = calculateQuote();
  const guests = Number(bookingGuests.value); const isCustom = guests > 300;
  const bookingId = crypto.randomUUID();
  const payload = {
    id: bookingId,
    full_name: document.getElementById("bookingName").value, contact_number: bookingPhone.value,
    email: document.getElementById("bookingEmail").value || null, package_name: pkgs.map(p => p.name).join(", ") || null,
    event_date: selectedBookingDate, start_time: bookingTime.value, event_type: document.getElementById("bookingType").value,
    estimated_guests: guests, venue_location: `${bookingVenueName.value}, ${bookingVenueAddress.value}, ${bookingVenueCity.value}, Metro Manila`,
    notes: document.getElementById("bookingNotes").value || null, service_area: "Metro Manila",
    status: "pending", reservation_status: "unpaid", estimated_total: isCustom ? null : total, is_custom_quote: isCustom,
  };
  try {
    const { error } = await supabaseClient.from("event_bookings").insert(payload);
    if (error) throw error;

    // Check the payment gateway (and attempt the redirect) BEFORE resetting
    // the wizard back to step 0 -- otherwise the guest briefly sees the form
    // jump back to the date picker right before being sent to checkout,
    // which reads as "did my booking just get wiped?" for a moment.
    if (!isCustom && total > 0) {
      const gateway = await getActiveBookingGateway();
      if (ONLINE_BOOKING_GATEWAYS.includes(gateway)) {
        setBookingMessage("Redirecting you to secure payment for your deposit...", false);
        const { data: sessionData, error: fnError } = await supabaseClient.functions.invoke("create-booking-checkout-session", { body: { booking_id: bookingId } });
        if (!fnError && sessionData?.url) { window.location.href = sessionData.url; return; }
        console.warn("Booking checkout session error, falling back to manual payment instructions:", fnError || sessionData?.error);
      }
    }

    eventBookingForm.reset(); selectedBookingDate = ""; bookingDate.value = ""; bookingDateDisplay.value = "";
    renderQuote(); showBookingStep(0);

    const msg = isCustom ? "Booking request sent! Your guest count (>300) requires a custom quote — we'll email you with pricing." : "Booking request completed! Updates will arrive from notification@studiophotuna.com.";
    spawnToast("Request Sent", "Booking request received. Check email for confirmation.", "fa-solid fa-circle-check", "success");
    setBookingMessage(msg, false);
  } catch (err) { setBookingMessage(err.message || "Insert transaction failed."); console.warn(err); }
  finally { submitBtn.disabled = false; }
}

// ===================================================================
// Support Tickets
// ===================================================================

async function handleSupportSubmit(event) {
  event.preventDefault();
  const supportBtn = document.getElementById("supportSubmitBtn");
  supportBtn.disabled = true; supportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Sending Ticket...';
  // Generate the id client-side instead of reading it back via .select()
  // after insert: guests submit this form as the anon role, and
  // support_tickets has no anon SELECT policy (by design, so guests can't
  // browse each other's tickets), so RETURNING comes back empty for them
  // and .single() would throw even though the insert itself succeeded.
  const ticketId = crypto.randomUUID();
  const ticketPayload = { id: ticketId, name: document.getElementById("supportName").value.trim(), email: document.getElementById("supportEmail").value.trim(), category: document.getElementById("supportCategory").value, priority: document.getElementById("supportPriority").value, message: document.getElementById("supportMessage").value.trim(), status: "open" };
  try {
    if (supabaseClient) {
      const { error } = await supabaseClient.from("support_tickets").insert(ticketPayload);
      if (error) throw error;
    }
    const form = document.getElementById("supportTicketForm");
    form.innerHTML = `<div class="text-center py-10 space-y-4"><div class="w-16 h-16 rounded-full bg-green/10 flex items-center justify-center mx-auto text-3xl text-green"><i class="fa-solid fa-envelope-circle-check"></i></div><h3 class="text-xl font-black text-title">Ticket Submitted!</h3><p class="text-sm text-body max-w-sm mx-auto">Your support request has been received. A confirmation will be sent to <strong>${ticketPayload.email}</strong> from <span class="text-brand">notification@studiophotuna.com</span>.</p><button type="button" onclick="resetSupportForm()" class="btn-animation mt-4 border border-line hover:bg-grey px-6 py-2.5 rounded-full font-extrabold text-sm text-title transition-colors">Submit Another Ticket</button></div>`;
    spawnToast("Ticket Created", "Sending your confirmation email…", "fa-solid fa-envelope-circle-check", "success");
    const { error: emailErr } = await supabaseClient.functions.invoke("send-ticket-email", { body: { type: "confirmation", ticket_id: ticketId } });
    if (emailErr) { console.warn("Ticket confirmation email failed (non-fatal):", emailErr); spawnToast("Ticket Saved", "Your ticket was received, but the confirmation email couldn't be sent. Our team can still see it.", "fa-solid fa-triangle-exclamation", "warning"); }
  } catch (err) { spawnToast("Failed", err.message || "Submission error. Try again.", "fa-solid fa-circle-exclamation", "warning"); supportBtn.disabled = false; supportBtn.innerHTML = 'Submit Support Request'; }
}

function resetSupportForm() {
  const container = document.getElementById("supportTicketForm");
  container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><div class="field space-y-2"><label class="font-extrabold text-title text-xs uppercase" for="supportName">Your Name</label><input id="supportName" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" required /></div><div class="field space-y-2"><label class="font-extrabold text-title text-xs uppercase" for="supportEmail">Your Email Address</label><input id="supportEmail" type="email" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" required /></div></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-4"><div class="field space-y-2"><label class="font-extrabold text-title text-xs uppercase" for="supportCategory">Inquiry Type</label><select id="supportCategory" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" required><option value="hardware">Hardware Setup & Synchronization</option><option value="licensing">Licensing & Payments</option><option value="events">Event Booking Requests</option><option value="other">General Technical Inquiries</option></select></div><div class="field space-y-2"><label class="font-extrabold text-title text-xs uppercase" for="supportPriority">Priority Level</label><select id="supportPriority" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" required><option value="normal">Normal Support Response</option><option value="high">Urgent (Upcoming Live Event)</option></select></div></div><div class="field space-y-2"><label class="font-extrabold text-title text-xs uppercase" for="supportMessage">Describe your Technical Issue</label><textarea id="supportMessage" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none h-32 resize-none" placeholder="Provide as much details as possible, including camera model and operating systems..." required></textarea></div><button class="btn-animation w-full bg-purple hover:bg-purple-dark text-white font-extrabold py-3.5 rounded-xl text-sm uppercase transition-colors shadow-sm" type="submit" id="supportSubmitBtn">Submit Support Request</button><div class="text-xs text-center text-muted font-medium pt-2">An automatic notification thread from <span class="text-purple">notification@studiophotuna.com</span> will be dispatched to verify your request.</div>`;
}

// ===================================================================
// Admin: Bookings
// ===================================================================

async function loadBookings() {
  if (!supabaseClient) { setMessage(adminMessage, "Supabase client not available.", true); return; }
  if (!window.currentSupabaseUser) {
    setMessage(adminMessage, "Verifying session...");
    try { const { data } = await supabaseClient.auth.getSession(); window.currentSupabaseUser = data?.session?.user || null; if (window.currentSupabaseUser) loadAccountState(window.currentSupabaseUser); } catch (_) { }
    if (!window.currentSupabaseUser) { setMessage(adminMessage, "Sign in to access admin dashboard.", true); return; }
  }
  if (adminMeta) adminMeta.textContent = "Logged in as " + window.currentSupabaseUser.email;
  setMessage(adminMessage, "Loading bookings...");
  try {
    const { data, error } = await supabaseClient.from("event_bookings").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    bookings = data || [];
    const msg = bookings.length ? `${bookings.length} booking(s) loaded.` : "No bookings found. If you expect records here, make sure your profile has role = 'admin' and that 06_admin_rls_policies.sql has been run.";
    setMessage(adminMessage, msg, !bookings.length);
    supabaseClient.from("payment_proofs").select("id,status").eq("status", "pending").then(({ data }) => { proofs = proofs.length ? proofs : (data || []); updateStats(); });
    renderBookings();
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

function setMessage(element, text, isError = false) { if (!element) return; element.textContent = text || ""; element.style.color = isError ? "#dc2626" : "#5f6678"; }

function updateStats() {
  const pending = bookings.filter(b => b.status === "pending").length;
  const approved = bookings.filter(b => b.status === "approved").length;
  const paid = bookings.filter(b => ["partial_paid", "paid"].includes(b.reservation_status)).length;
  const customQuotes = bookings.filter(b => b.is_custom_quote).length;
  document.getElementById("statPending").textContent = pending;
  document.getElementById("statApproved").textContent = approved;
  document.getElementById("statPaid").textContent = paid;
  document.getElementById("statTotal").textContent = bookings.length;
  const cqEl = document.getElementById("statCustomQuotes"); if (cqEl) cqEl.textContent = customQuotes;
  const pendingProofs = proofs.filter(p => p.status === "pending").length;
  document.getElementById("statProofsPending").textContent = pendingProofs;
  const badge = document.getElementById("proofsTabBadge"); if (badge) { badge.textContent = pendingProofs; badge.classList.toggle("hidden", !pendingProofs); }
  const cqBadge = document.getElementById("customQuoteTabBadge"); if (cqBadge) { cqBadge.textContent = customQuotes; cqBadge.classList.toggle("hidden", !customQuotes); }
  updateSupportGroupBadge();
}

function updateSupportGroupBadge() {
  const total = ["proofsTabBadge", "ticketsTabBadge", "inboxTabBadge"].reduce((sum, id) => {
    const el = document.getElementById(id);
    return sum + (el && !el.classList.contains("hidden") ? parseInt(el.textContent, 10) || 0 : 0);
  }, 0);
  const groupBadge = document.getElementById("supportGroupBadge");
  if (groupBadge) { groupBadge.textContent = total; groupBadge.classList.toggle("hidden", !total); }
}

const STATUS_COLORS = { pending: "bg-yellow-100 text-yellow-800", approved: "bg-green-100 text-green-800", declined: "bg-red-100 text-red-800", cancelled: "bg-gray-200 text-gray-700" };
const PAYMENT_COLORS = { unpaid: "bg-red-100 text-red-700", partial_paid: "bg-yellow-100 text-yellow-800", paid: "bg-green-100 text-green-800" };

function renderBookings() {
  updateStats(); bookingList.innerHTML = "";
  const search = (document.getElementById("bookingSearch")?.value || "").toLowerCase();
  let filtered = bookings.filter(b => {
    if (activeFilter === "custom_quote") return !!b.is_custom_quote;
    if (activeFilter === "paid_any") return ["partial_paid", "paid"].includes(b.reservation_status);
    if (activeFilter !== "all" && b.status !== activeFilter) return false;
    if (!search) return true;
    return [b.full_name, b.event_type, b.venue_location, b.notes, b.profiles?.email].some(v => (v || "").toLowerCase().includes(search));
  });
  if (!filtered.length) { bookingList.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-10 text-center text-muted space-y-2"><i class="fa-solid fa-folder-open text-4xl text-line"></i><p class="font-bold text-sm">No bookings match this filter.</p></div>`; return; }
  filtered.forEach(b => {
    const statusCls = STATUS_COLORS[b.status] || "bg-grey text-body";
    const paymentCls = PAYMENT_COLORS[b.reservation_status] || "bg-grey text-body";
    const submittedAt = b.created_at ? new Date(b.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
    const isCustom = !!b.is_custom_quote;
    const card = document.createElement("div");
    card.className = "border border-line rounded-2xl bg-white shadow-sm overflow-hidden" + (isCustom ? " ring-2 ring-purple/30" : "");
    card.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-grey/40"><div class="flex items-center gap-3 flex-wrap"><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusCls}">${b.status}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${paymentCls}">${b.reservation_status}</span>${isCustom ? `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple"><i class="fa-solid fa-envelope mr-1"></i>Custom Quote</span>` : ""}</div><span class="text-[10px] text-muted font-bold">Submitted ${submittedAt}</span></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start"><div class="lg:col-span-8 space-y-4"><div><h3 class="text-xl font-black text-title">${b.full_name}</h3>${b.email ? `<p class="text-xs text-muted">${b.email}</p>` : ""}</div><div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-calendar-day text-muted"></i><strong class="text-title font-bold">${b.event_date || "—"}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-camera text-muted"></i><strong class="text-title font-bold">${b.event_type || "—"}</strong></span><span class="inline-flex items-center gap-1.5 ${isCustom ? "text-orange-600" : "text-body"}"><i class="fa-solid fa-users ${isCustom ? "text-orange-500" : "text-muted"}"></i><strong class="font-bold ${isCustom ? "text-orange-600" : "text-title"}">${b.estimated_guests || "—"} guests${isCustom ? " ⚠" : ""}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-box text-muted"></i><strong class="text-title font-bold">${b.package_name || "—"}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-peso-sign text-muted"></i><strong class="text-title font-bold">${isCustom ? "Custom" : (b.estimated_total ? "₱" + Number(b.estimated_total).toLocaleString() : "—")}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-clock text-muted"></i><strong class="text-title font-bold">${b.hours || "—"} hrs</strong></span></div><div class="text-xs space-y-1 border-t border-line pt-3"><span class="text-[10px] uppercase font-bold text-muted block">Venue</span><strong class="text-title">${b.venue_location || "—"}</strong></div>${b.notes ? `<div class="text-xs space-y-1 border-t border-line pt-3"><span class="text-[10px] uppercase font-bold text-muted block">Client Notes</span><p class="text-body">${b.notes}</p></div>` : ""}</div><div class="lg:col-span-4 space-y-3 bg-grey border border-line rounded-2xl p-5"><p class="text-[10px] uppercase font-extrabold text-muted tracking-wider">Admin Actions</p>${isCustom ? `<div class="bg-purple/10 border border-purple/20 rounded-xl p-3 space-y-2"><p class="text-[10px] font-black text-purple uppercase tracking-wider"><i class="fa-solid fa-envelope mr-1"></i>Custom Quote Required</p><p class="text-[10px] text-body">${b.estimated_guests}+ guests — send custom rate to client email.</p><button onclick="openQuoteModal('${b.id}','${(b.email || b.phone || "").replace(/'/g, "\\'")}','${(b.full_name || "").replace(/'/g, "\\'")}','${(b.package_name || "").replace(/'/g, "\\'")}',${b.estimated_guests || 0})" class="btn-animation w-full bg-purple text-white text-[10px] font-black py-2 rounded-lg flex items-center justify-center gap-1"><i class="fa-solid fa-paper-plane"></i> Send Custom Quote</button></div>` : ""}<div class="grid grid-cols-2 gap-3"><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Status</label><select class="status-select w-full border border-line rounded-lg px-3 py-2 text-xs bg-white">${["pending", "approved", "declined", "cancelled"].map(s => `<option value="${s}" ${b.status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join("")}</select></div><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Payment</label><select class="payment-select w-full border border-line rounded-lg px-3 py-2 text-xs bg-white"><option value="unpaid" ${b.reservation_status === "unpaid" ? "selected" : ""}>Unpaid</option><option value="partial_paid" ${b.reservation_status === "partial_paid" ? "selected" : ""}>50% Paid</option><option value="paid" ${b.reservation_status === "paid" ? "selected" : ""}>Fully Paid</option></select></div></div><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Admin Note (optional)</label><textarea class="admin-note w-full border border-line rounded-lg px-3 py-2 text-xs bg-white resize-none h-20" placeholder="Internal note visible only to admins…">${b.admin_note || ""}</textarea></div><button onclick="saveAdminBookingChange('${b.id}', this)" class="btn-animation w-full bg-purple text-white hover:bg-purple-dark text-xs font-bold py-2.5 rounded-xl">Save Changes</button></div></div>`;
    bookingList.appendChild(card);
  });
}

async function saveAdminBookingChange(id, btn) {
  if (!supabaseClient) return;
  const parent = btn.closest(".bg-grey"); const status = parent.querySelector(".status-select").value;
  const reservation_status = parent.querySelector(".payment-select").value; const admin_note = parent.querySelector(".admin-note")?.value?.trim() || null;
  btn.disabled = true; btn.textContent = "Saving…"; spawnToast("Saving", "Updating booking record…", "fa-solid fa-circle-notch", "info");
  try { const { error } = await supabaseClient.from("event_bookings").update({ status, reservation_status, admin_note }).eq("id", id); if (error) throw error; spawnToast("Saved", "Booking updated successfully.", "fa-solid fa-circle-check", "success"); loadBookings(); }
  catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); btn.disabled = false; btn.textContent = "Save Changes"; }
}

// ===================================================================
// Admin: Support Tickets
// ===================================================================
let tickets = [];

async function loadTickets() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  setMessage(adminMessage, "Loading support tickets...");
  try {
    const { data, error } = await supabaseClient.from("support_tickets").select("*, ticket_replies(id, message, is_admin, created_at)").order("created_at", { ascending: false });
    if (error) throw error; tickets = data || [];
    const openCount = tickets.filter(t => t.status === "open").length;
    const badge = document.getElementById("ticketsTabBadge"); if (badge) { badge.textContent = openCount; badge.classList.toggle("hidden", !openCount); }
    updateSupportGroupBadge();
    setMessage(adminMessage, tickets.length ? `${tickets.length} ticket(s) loaded.` : "No support tickets yet."); renderTickets();
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

function renderTickets() {
  const ticketList = document.getElementById("ticketList"); if (!ticketList) return; ticketList.innerHTML = "";
  if (!tickets.length) { ticketList.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-10 text-center text-muted space-y-2"><i class="fa-solid fa-ticket text-4xl text-line"></i><p class="font-bold text-sm">No support tickets yet.</p></div>`; return; }
  tickets.forEach(t => {
    const submittedAt = new Date(t.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const statusCls = t.status === "open" ? "bg-yellow-100 text-yellow-800" : t.status === "resolved" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600";
    const replies = t.ticket_replies || [];
    const card = document.createElement("div"); card.className = "border border-line rounded-2xl bg-white shadow-sm overflow-hidden";
    card.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-grey/40"><div class="flex items-center gap-3"><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusCls}">${t.status}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${t.category || "General"}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-50 text-red-600">${t.priority || "normal"}</span></div><span class="text-[10px] text-muted font-bold">${submittedAt}</span></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6"><div class="lg:col-span-8 space-y-4"><div><p class="font-black text-title">${t.name || "Anonymous"}</p><p class="text-xs text-muted">${t.email || ""}</p></div><div class="bg-grey rounded-xl p-4 text-sm text-body">${t.message}</div>${replies.length ? `<div class="space-y-2 border-t border-line pt-4"><p class="text-[10px] uppercase font-black text-muted">Thread (${replies.length})</p>${replies.map(r => `<div class="rounded-xl p-3 text-xs ${r.is_admin ? "bg-purple/10 text-purple border border-purple/20 ml-4" : "bg-grey text-body"}"><p class="font-bold mb-1">${r.is_admin ? "You (Admin)" : t.name || "Guest"} · ${new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p><p>${r.message}</p></div>`).join("")}</div>` : ""}</div><div class="lg:col-span-4 space-y-3 bg-grey border border-line rounded-2xl p-5"><p class="text-[10px] uppercase font-extrabold text-muted tracking-wider">Reply</p><textarea id="reply-${t.id}" rows="4" class="w-full border border-line rounded-xl px-3 py-2 text-xs bg-white resize-none" placeholder="Type your reply to ${t.name || "the guest"}…"></textarea><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Status after reply</label><select id="reply-status-${t.id}" class="w-full border border-line rounded-lg px-3 py-2 text-xs bg-white"><option value="open" ${t.status === "open" ? "selected" : ""}>Keep Open</option><option value="in_progress" ${t.status === "in_progress" ? "selected" : ""}>In Progress</option><option value="resolved" ${t.status === "resolved" ? "selected" : ""}>Resolved</option><option value="closed" ${t.status === "closed" ? "selected" : ""}>Closed</option></select></div><button onclick="replyToTicket('${t.id}', this)" class="btn-animation w-full bg-purple text-white text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-2"><i class="fa-solid fa-paper-plane"></i> Send Reply</button></div></div>`;
    ticketList.appendChild(card);
  });
}

async function replyToTicket(ticketId, btn) {
  const message = document.getElementById(`reply-${ticketId}`)?.value?.trim();
  const newStatus = document.getElementById(`reply-status-${ticketId}`)?.value;
  if (!message) { spawnToast("Empty Reply", "Type a message before sending.", "fa-solid fa-circle-info", "warning"); return; }
  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sending…`;
  try {
    const { error: replyErr } = await supabaseClient.from("ticket_replies").insert({ ticket_id: ticketId, message, is_admin: true }); if (replyErr) throw replyErr;
    await supabaseClient.from("support_tickets").update({ status: newStatus }).eq("id", ticketId);
    const { error: emailErr } = await supabaseClient.functions.invoke("send-ticket-email", { body: { type: "reply", ticket_id: ticketId, reply_message: message } });
    if (emailErr) { spawnToast("Reply Saved", "The reply was saved, but the email to the submitter couldn't be sent.", "fa-solid fa-triangle-exclamation", "warning"); }
    else { spawnToast("Reply Sent", "The reply has been saved and emailed to the submitter.", "fa-solid fa-circle-check", "success"); }
    loadTickets();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Reply`; }
}

// ===================================================================
// Admin: Privacy Requests (submitted via /privacy-request -- guests and
// operators exercising GDPR/UK GDPR/RA 10173 rights). RLS grants
// authenticated admins SELECT/UPDATE via is_admin(); everyone else only
// has INSERT, so non-admins loading this tab just see an empty list.
// ===================================================================
let privacyRequestsAdmin = [];
let activePrivacyFilter = "all";

const PRIVACY_REQUEST_TYPE_LABELS = { access: "Access", erasure: "Erasure", correction: "Correction", portability: "Portability", objection: "Objection" };
const PRIVACY_STATUS_COLORS = { pending: "bg-yellow-100 text-yellow-800", in_progress: "bg-blue-100 text-blue-700", completed: "bg-green-100 text-green-800", rejected: "bg-gray-200 text-gray-600" };

async function loadPrivacyRequestsAdmin() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  setMessage(adminMessage, "Loading privacy requests...");
  try {
    const { data, error } = await supabaseClient.from("privacy_requests").select("*").order("deadline_at", { ascending: true });
    if (error) throw error;
    privacyRequestsAdmin = data || [];
    const openCount = privacyRequestsAdmin.filter(r => r.status === "pending" || r.status === "in_progress").length;
    const badge = document.getElementById("privacyGroupBadge"); if (badge) { badge.textContent = openCount; badge.classList.toggle("hidden", !openCount); }
    const msg = privacyRequestsAdmin.length
      ? `${privacyRequestsAdmin.length} privacy request(s) loaded.`
      : "No privacy requests found. If you expect records here, make sure your profile has role = 'admin'.";
    setMessage(adminMessage, msg, !privacyRequestsAdmin.length);
    renderPrivacyRequestsAdmin();
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

function formatPrivacyDeadline(deadlineAt, status) {
  if (status === "completed" || status === "rejected") return { text: "Closed", cls: "bg-gray-200 text-gray-600" };
  const daysLeft = Math.ceil((new Date(deadlineAt) - Date.now()) / 86400000);
  if (daysLeft < 0) return { text: `Overdue by ${Math.abs(daysLeft)}d`, cls: "bg-red-100 text-red-700" };
  if (daysLeft <= 7) return { text: `${daysLeft}d left`, cls: "bg-yellow-100 text-yellow-800" };
  return { text: `${daysLeft}d left`, cls: "bg-green-100 text-green-800" };
}

function renderPrivacyRequestsAdmin() {
  const list = document.getElementById("privacyRequestList"); if (!list) return; list.innerHTML = "";
  const filtered = activePrivacyFilter === "all" ? privacyRequestsAdmin : privacyRequestsAdmin.filter(r => r.status === activePrivacyFilter);
  if (!filtered.length) { list.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-10 text-center text-muted space-y-2"><i class="fa-solid fa-user-shield text-4xl text-line"></i><p class="font-bold text-sm">No privacy requests match this filter.</p></div>`; return; }
  filtered.forEach(r => {
    const submittedAt = new Date(r.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const statusCls = PRIVACY_STATUS_COLORS[r.status] || PRIVACY_STATUS_COLORS.pending;
    const deadline = formatPrivacyDeadline(r.deadline_at, r.status);
    const card = document.createElement("div"); card.className = "border border-line rounded-2xl bg-white shadow-sm overflow-hidden";
    card.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-grey/40"><div class="flex items-center gap-3"><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusCls}">${r.status.replace("_", " ")}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${PRIVACY_REQUEST_TYPE_LABELS[r.request_type] || r.request_type}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${deadline.cls}">${deadline.text}</span>${r.identity_verified ? `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple"><i class="fa-solid fa-shield-check"></i> Verified</span>` : ""}</div><span class="text-[10px] text-muted font-bold">${submittedAt}</span></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6"><div class="lg:col-span-7 space-y-3"><div><p class="font-black text-title">${r.requester_name}</p><p class="text-xs text-muted">${r.requester_email}</p></div>${(r.event_venue || r.event_date) ? `<p class="text-xs text-body"><i class="fa-solid fa-location-dot text-muted mr-1"></i>${[r.event_venue, r.event_date].filter(Boolean).join(" · ")}</p>` : ""}${r.session_description ? `<div class="bg-grey rounded-xl p-4 text-xs text-body">${r.session_description}</div>` : ""}${r.notes ? `<div class="border-t border-line pt-3"><p class="text-[10px] uppercase font-black text-muted mb-1">Internal Notes</p><p class="text-xs text-body">${r.notes}</p></div>` : ""}</div><div class="lg:col-span-5 space-y-3 bg-grey border border-line rounded-2xl p-5"><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Status</label><select id="privacy-status-${r.id}" class="w-full border border-line rounded-lg px-3 py-2 text-xs bg-white"><option value="pending" ${r.status === "pending" ? "selected" : ""}>Pending</option><option value="in_progress" ${r.status === "in_progress" ? "selected" : ""}>In Progress</option><option value="completed" ${r.status === "completed" ? "selected" : ""}>Completed</option><option value="rejected" ${r.status === "rejected" ? "selected" : ""}>Rejected</option></select></div><label class="flex items-center gap-2 text-xs font-bold text-title"><input type="checkbox" id="privacy-verified-${r.id}" ${r.identity_verified ? "checked" : ""} class="rounded border-line" /> Identity verified</label><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Internal notes</label><textarea id="privacy-notes-${r.id}" rows="3" class="w-full border border-line rounded-xl px-3 py-2 text-xs bg-white resize-none" placeholder="Notes for other admins (not sent to the requester)...">${r.notes || ""}</textarea></div><button onclick="updatePrivacyRequestAdmin('${r.id}', this)" class="btn-animation w-full bg-purple text-white text-xs font-black py-2.5 rounded-xl flex items-center justify-center gap-2"><i class="fa-solid fa-floppy-disk"></i> Save</button></div></div>`;
    list.appendChild(card);
  });
}

async function updatePrivacyRequestAdmin(requestId, btn) {
  const status = document.getElementById(`privacy-status-${requestId}`)?.value;
  const identityVerified = document.getElementById(`privacy-verified-${requestId}`)?.checked || false;
  const notes = document.getElementById(`privacy-notes-${requestId}`)?.value?.trim() || null;
  const existing = privacyRequestsAdmin.find(r => r.id === requestId);
  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…`;
  try {
    const updates = { status, identity_verified: identityVerified, notes };
    // First status change away from "pending" counts as our initial response;
    // moving into a closed state (completed/rejected) logs when it was resolved.
    if (existing && existing.status === "pending" && status !== "pending" && !existing.responded_at) updates.responded_at = new Date().toISOString();
    if ((status === "completed" || status === "rejected") && !existing?.resolved_at) updates.resolved_at = new Date().toISOString();
    const { error } = await supabaseClient.from("privacy_requests").update(updates).eq("id", requestId);
    if (error) throw error;
    spawnToast("Saved", "Privacy request updated.", "fa-solid fa-circle-check", "success");
    loadPrivacyRequestsAdmin();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save`; }
}

// ===================================================================
// Admin: Inbox (replies guests send to support@studiophotuna.com,
// captured via the receive-inbound-email webhook)
// ===================================================================
let inboxEmails = [];
let activeInboxFilter = "all";

async function loadInboxEmails() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  setMessage(adminMessage, "Loading inbox...");
  try {
    const { data, error } = await supabaseClient.from("inbound_emails").select("*").order("received_at", { ascending: false });
    if (error) throw error;
    inboxEmails = data || [];
    const unreadCount = inboxEmails.filter(e => !e.is_read).length;
    const badge = document.getElementById("inboxTabBadge"); if (badge) { badge.textContent = unreadCount; badge.classList.toggle("hidden", !unreadCount); }
    updateSupportGroupBadge();
    setMessage(adminMessage, inboxEmails.length ? `${inboxEmails.length} email(s) loaded.` : "No received emails yet.");
    renderInboxEmails();
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

const INBOX_RECIPIENTS = {
  "support@studiophotuna.com": { label: "Support", cls: "bg-grey text-body" },
  "dpo@studiophotuna.com": { label: "DPO Request", cls: "bg-red-100 text-red-700" },
  "notification@studiophotuna.com": { label: "Notification", cls: "bg-purple/10 text-purple" },
};

function inboxRecipientInfo(toAddress) {
  return INBOX_RECIPIENTS[(toAddress || "").toLowerCase()] || { label: toAddress || "Unknown recipient", cls: "bg-grey text-body" };
}

function renderInboxEmails() {
  const inboxList = document.getElementById("inboxList"); if (!inboxList) return; inboxList.innerHTML = "";
  const filtered = inboxEmails.filter(e => activeInboxFilter === "all" || (e.to_address || "").toLowerCase() === activeInboxFilter);
  if (!filtered.length) { inboxList.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-10 text-center text-muted space-y-2"><i class="fa-solid fa-inbox text-4xl text-line"></i><p class="font-bold text-sm">No received emails match this filter.</p><p class="text-xs">Mail sent to support@, dpo@, or notification@studiophotuna.com shows up here.</p></div>`; return; }
  filtered.forEach(e => {
    const receivedAt = new Date(e.received_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const card = document.createElement("div");
    card.className = "border border-line rounded-2xl bg-white shadow-sm overflow-hidden" + (e.is_read ? "" : " ring-2 ring-purple/20");
    const replyBlock = e.admin_reply
      ? `<div class="rounded-xl p-3 text-xs bg-purple/10 text-purple border border-purple/20"><p class="font-bold mb-1">You replied · ${new Date(e.replied_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p><p>${e.admin_reply}</p></div>`
      : `<div class="space-y-2"><textarea id="inbox-reply-${e.id}" rows="3" class="w-full border border-line rounded-xl px-3 py-2 text-xs bg-white resize-none" placeholder="Type your reply to ${e.from_name || e.from_address || "this sender"}…"></textarea><button onclick="replyToInboxEmail('${e.id}', this)" class="btn-animation w-full sm:w-auto bg-purple text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center justify-center gap-2"><i class="fa-solid fa-paper-plane"></i> Send Reply</button></div>`;
    const fetchErrorNote = e.fetch_error ? `<div class="rounded-xl p-3 text-xs bg-yellow-100 text-yellow-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Couldn't load the full message: ${e.fetch_error}</div>` : "";
    const recipient = inboxRecipientInfo(e.to_address);
    card.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-grey/40"><div class="flex items-center gap-3 flex-wrap">${e.is_read ? "" : `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">New</span>`}<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${recipient.cls}"><i class="fa-solid fa-inbox mr-1"></i>${recipient.label}</span>${e.ticket_id ? `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-800"><i class="fa-solid fa-link mr-1"></i>Linked to ticket</span>` : ""}</div><span class="text-[10px] text-muted font-bold">${receivedAt}</span></div><div class="p-6 space-y-3"><div><p class="font-black text-title">${e.from_name || e.from_address || "Unknown sender"}</p><p class="text-xs text-muted">${e.from_address || ""} <span class="text-line">&rarr;</span> ${e.to_address || "—"}</p></div><p class="text-sm font-bold text-title">${e.subject || "(no subject)"}</p><div class="bg-grey rounded-xl p-4 text-sm text-body whitespace-pre-wrap">${e.text_body || "(no plain-text body available)"}</div>${fetchErrorNote}${!e.is_read ? `<button onclick="markInboxEmailRead('${e.id}', this)" class="btn-animation border border-line hover:bg-grey px-4 py-2 rounded-full font-bold text-xs text-title transition-colors"><i class="fa-solid fa-envelope-open mr-1"></i> Mark as Read</button>` : ""}${replyBlock}</div>`;
    inboxList.appendChild(card);
  });
}

async function markInboxEmailRead(id, btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Marking..."; }
  try {
    const { error } = await supabaseClient.from("inbound_emails").update({ is_read: true }).eq("id", id);
    if (error) throw error;
    loadInboxEmails();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); if (btn) { btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-envelope-open mr-1"></i> Mark as Read`; } }
}

async function replyToInboxEmail(id, btn) {
  const message = document.getElementById(`inbox-reply-${id}`)?.value?.trim();
  if (!message) { spawnToast("Empty Reply", "Type a message before sending.", "fa-solid fa-circle-info", "warning"); return; }
  const email = inboxEmails.find(e => e.id === id);
  if (!email) return;
  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Sending…`;
  try {
    const body = email.ticket_id
      ? { type: "reply", ticket_id: email.ticket_id, reply_message: message }
      : { type: "reply", to_email: email.from_address, to_name: email.from_name, reply_message: message };
    const { error: emailErr } = await supabaseClient.functions.invoke("send-ticket-email", { body });
    if (emailErr) throw emailErr;
    if (email.ticket_id) {
      await supabaseClient.from("ticket_replies").insert({ ticket_id: email.ticket_id, message, is_admin: true });
    }
    const { error: updateErr } = await supabaseClient.from("inbound_emails").update({ admin_reply: message, replied_at: new Date().toISOString(), is_read: true }).eq("id", id);
    if (updateErr) throw updateErr;
    spawnToast("Reply Sent", "Your reply has been emailed.", "fa-solid fa-circle-check", "success");
    loadInboxEmails();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Send Reply`; }
}

// ===================================================================
// Admin: Analytics
//
// Derived straight from tables that already have real data (profiles,
// payment_proofs, licenses) rather than the empty analytics_registrations /
// analytics_subscriptions / analytics_revenue tables sitting unused in the
// schema -- those are shaped for Stripe webhook events, and Stripe isn't
// wired up yet (GCash-only for now), so nothing will ever write to them
// until that integration exists.
// ===================================================================

async function loadAnalytics() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  setMessage(adminMessage, "Loading analytics...");
  try {
    const [profilesRes, proofsRes, licensesRes, bookingsRes, boothsRes, ticketsRes, repliesRes, galleriesRes] = await Promise.all([
      supabaseClient.from("profiles").select("created_at"),
      supabaseClient.from("payment_proofs").select("amount_php, billing, created_at, reviewed_at").eq("status", "approved"),
      supabaseClient.from("licenses").select("user_id, plan, state, gallery_addon, current_period_end"),
      supabaseClient.from("event_bookings").select("created_at, status"),
      supabaseClient.from("booths").select("is_online"),
      supabaseClient.from("support_tickets").select("created_at"),
      supabaseClient.from("ticket_replies").select("created_at, is_admin"),
      supabaseClient.from("galleries").select("created_at"),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (proofsRes.error) throw proofsRes.error;
    if (licensesRes.error) throw licensesRes.error;
    if (bookingsRes.error) throw bookingsRes.error;
    if (boothsRes.error) throw boothsRes.error;
    if (ticketsRes.error) throw ticketsRes.error;
    if (repliesRes.error) throw repliesRes.error;
    if (galleriesRes.error) throw galleriesRes.error;
    renderAnalytics(
      profilesRes.data || [], proofsRes.data || [], licensesRes.data || [],
      bookingsRes.data || [], boothsRes.data || [], ticketsRes.data || [], repliesRes.data || [], galleriesRes.data || []
    );
    setMessage(adminMessage, "Analytics loaded.");
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

function bucketByWeek(items, dateField, valueField) {
  const weekStart = (d) => { const dt = new Date(d); const day = dt.getUTCDay(); const diff = (day === 0 ? 6 : day - 1); dt.setUTCDate(dt.getUTCDate() - diff); dt.setUTCHours(0, 0, 0, 0); return dt.getTime(); };
  const totals = new Map();
  items.forEach(item => {
    if (!item[dateField]) return;
    const key = weekStart(item[dateField]);
    const value = valueField ? Number(item[valueField]) || 0 : 1;
    totals.set(key, (totals.get(key) || 0) + value);
  });
  const timestamps = [...totals.keys()];
  const earliest = timestamps.length ? Math.min(...timestamps) : weekStart(new Date());
  const buckets = [];
  for (let t = earliest; t <= weekStart(new Date()); t += 7 * 24 * 60 * 60 * 1000) {
    buckets.push({ weekStart: t, total: totals.get(t) || 0 });
  }
  return buckets.slice(-16); // cap at the most recent 16 weeks so the chart stays readable
}

function renderBarChart(buckets, barColorClass, valueFormatter) {
  const max = Math.max(1, ...buckets.map(b => b.total));
  const bars = buckets.map((b, i) => {
    const heightPct = Math.max(Math.round((b.total / max) * 100), b.total > 0 ? 6 : 0);
    const label = new Date(b.weekStart).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
    const isLast = i === buckets.length - 1;
    return `<div class="group relative flex-1 min-w-[20px] flex flex-col items-center justify-end" style="height: 128px;">
      ${isLast ? `<span class="text-[10px] font-black text-title mb-1 whitespace-nowrap">${valueFormatter(b.total)}</span>` : ""}
      <div class="w-full max-w-[22px] rounded-t-[4px] ${barColorClass} transition-all" style="height: ${heightPct}%"></div>
      <div class="hidden group-hover:flex absolute -top-7 left-1/2 -translate-x-1/2 bg-title text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-10">${valueFormatter(b.total)}</div>
      <span class="mt-1.5 text-[9px] text-muted font-bold whitespace-nowrap">${label}</span>
    </div>`;
  }).join("");
  return `<div class="flex items-end gap-2 overflow-x-auto pb-1">${bars}</div>`;
}

function renderAnalytics(profiles, proofs, licenses, bookings, booths, tickets, replies, galleries) {
  const panel = document.getElementById("analyticsPanel"); if (!panel) return;

  const totalSignups = profiles.length;
  const totalRevenue = proofs.reduce((sum, p) => sum + (Number(p.amount_php) || 0), 0);
  const activeLicenses = licenses.filter(l => l.state === "active");
  const monthlyCount = activeLicenses.filter(l => (l.plan || "").toLowerCase().includes("month")).length;
  const yearlyCount = activeLicenses.filter(l => (l.plan || "").toLowerCase().includes("year")).length;
  const galleryAddonCount = licenses.filter(l => l.gallery_addon).length;

  const signupBuckets = bucketByWeek(profiles, "created_at");
  // reviewed_at is always set by reviewProof() the moment a proof is approved,
  // so bucketing by it (rather than created_at) reflects when revenue actually landed.
  const revenueBuckets = bucketByWeek(proofs, "reviewed_at", "amount_php");

  const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");

  // -- Subscription health (MRR, churn, trial-to-paid conversion) ---------
  // A `licenses` row is only ever created once a payment goes through
  // (submit-payment-proof / stripe-webhook upsert it), never at signup --
  // so its mere existence already means "this profile converted." There is
  // also no distinct "cancelled"/"expired" state ever written; a lapsed
  // subscriber just stays state="active" with a past current_period_end.
  // "Lapsed" below reconstructs churn from that date instead of a status
  // string, since the app never records one.
  const now = Date.now();
  const isLapsed = (l) => l.current_period_end && new Date(l.current_period_end).getTime() < now;
  const activeAndCurrent = activeLicenses.filter(l => !isLapsed(l));
  const activeAndLapsed = activeLicenses.filter(l => isLapsed(l));
  const mrr = activeAndCurrent.reduce((sum, l) => sum + ((l.plan || "").toLowerCase().includes("year") ? PHP_AMOUNTS.yearly / 12 : PHP_AMOUNTS.monthly), 0);
  const churnDenominator = activeAndCurrent.length + activeAndLapsed.length;
  const churnRate = churnDenominator ? Math.round((activeAndLapsed.length / churnDenominator) * 100) : null;
  const convertedProfileCount = new Set(activeLicenses.map(l => l.user_id)).size;
  const conversionRate = totalSignups ? Math.round((convertedProfileCount / totalSignups) * 100) : null;

  // -- Booking activity -----------------------------------------------
  const bookingBuckets = bucketByWeek(bookings, "created_at");
  const approvedBookings = bookings.filter(b => b.status === "approved").length;
  const declinedBookings = bookings.filter(b => b.status === "declined").length;
  const cancelledBookings = bookings.filter(b => b.status === "cancelled").length;
  const pendingBookings = bookings.length - approvedBookings - declinedBookings - cancelledBookings;
  const decidedBookings = approvedBookings + declinedBookings;
  const approvalRate = decidedBookings ? Math.round((approvedBookings / decidedBookings) * 100) : null;

  // -- Support load ------------------------------------------------------
  const ticketBuckets = bucketByWeek(tickets, "created_at");
  const adminReplies = replies.filter(r => r.is_admin).length;
  const guestReplies = replies.length - adminReplies;

  // -- Booth / device usage -----------------------------------------------
  const boothsOnline = booths.filter(b => b.is_online).length;
  const boothOnlinePct = booths.length ? Math.round((boothsOnline / booths.length) * 100) : 0;

  // -- Gallery / session activity -------------------------------------------
  const galleryBuckets = bucketByWeek(galleries, "created_at");

  panel.innerHTML = `
    <p class="text-[10px] uppercase font-black tracking-widest text-muted mb-3">Growth &amp; Revenue</p>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-user-plus"></i></div>
        <div class="min-w-0"><small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Total Signups</small><strong class="text-2xl font-black text-title">${totalSignups}</strong></div>
      </div>
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-sack-dollar"></i></div>
        <div class="min-w-0"><small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Total Revenue</small><strong class="text-2xl font-black text-title">${peso(totalRevenue)}</strong></div>
      </div>
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-id-badge"></i></div>
        <div class="min-w-0"><small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Active Subscribers</small><strong class="text-2xl font-black text-title">${activeLicenses.length}</strong></div>
      </div>
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-images"></i></div>
        <div class="min-w-0"><small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Gallery Add-ons</small><strong class="text-2xl font-black text-title">${galleryAddonCount}</strong></div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2 mt-4">
      <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${monthlyCount} Monthly</span>
      <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${yearlyCount} Yearly</span>
    </div>

    <p class="text-[10px] uppercase font-black tracking-widest text-muted mt-8 mb-3">Subscription Health</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-chart-line"></i></div>
        <div class="min-w-0">
          <small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">MRR</small>
          <strong class="text-2xl font-black text-title">${peso(mrr)}</strong>
          <p class="text-[10px] text-muted mt-0.5">Recurring revenue at today's run-rate</p>
        </div>
      </div>
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-user-slash"></i></div>
        <div class="min-w-0">
          <small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Churn Rate</small>
          <strong class="text-2xl font-black text-title">${churnRate !== null ? `${churnRate}%` : "—"}</strong>
          <p class="text-[10px] text-muted mt-0.5">${churnRate !== null ? `${activeAndLapsed.length} of ${churnDenominator} paid subscribers lapsed` : "No paid subscribers have lapsed yet"}</p>
        </div>
      </div>
      <div class="border border-line rounded-2xl bg-white p-4 shadow-sm flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-purple/10 text-purple flex items-center justify-center text-sm shrink-0"><i class="fa-solid fa-right-left"></i></div>
        <div class="min-w-0">
          <small class="text-[10px] uppercase font-black tracking-widest text-muted block mb-0.5">Trial &rarr; Paid</small>
          <strong class="text-2xl font-black text-title">${conversionRate !== null ? `${conversionRate}%` : "—"}</strong>
          <p class="text-[10px] text-muted mt-0.5">${convertedProfileCount} of ${totalSignups} signups converted to a paid plan</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-sm font-extrabold text-title mb-4">Signups per week</p>
        ${signupBuckets.some(b => b.total > 0) ? renderBarChart(signupBuckets, "bg-purple", (v) => `${v} signup${v === 1 ? "" : "s"}`) : `<p class="text-xs text-muted text-center py-10">No signups yet.</p>`}
      </div>
      <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-sm font-extrabold text-title mb-4">Revenue per week (approved GCash payments)</p>
        ${revenueBuckets.some(b => b.total > 0) ? renderBarChart(revenueBuckets, "bg-green-500", peso) : `<p class="text-xs text-muted text-center py-10">No approved payments yet.</p>`}
      </div>
    </div>

    <p class="text-[11px] text-muted mt-4">Revenue reflects manually-approved GCash payment proofs only. Stripe/PayMongo revenue will appear here once that integration is active.</p>

    <p class="text-[10px] uppercase font-black tracking-widest text-muted mt-8 mb-3">Booking Activity</p>
    <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p class="text-sm font-extrabold text-title">Event bookings per week</p>
        <div class="flex flex-wrap gap-2">
          <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-blue-100 text-blue-700">${pendingBookings} Pending</span>
          <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-green-100 text-green-700">${approvedBookings} Approved</span>
          <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700">${declinedBookings} Declined</span>
          <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-grey-2 text-muted">${cancelledBookings} Cancelled</span>
          ${approvalRate !== null ? `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${approvalRate}% Approval Rate</span>` : ""}
        </div>
      </div>
      ${bookingBuckets.some(b => b.total > 0) ? renderBarChart(bookingBuckets, "bg-blue-500", (v) => `${v} booking${v === 1 ? "" : "s"}`) : `<p class="text-xs text-muted text-center py-10">No bookings yet.</p>`}
    </div>

    <p class="text-[10px] uppercase font-black tracking-widest text-muted mt-8 mb-3">Support &amp; Operations</p>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p class="text-sm font-extrabold text-title">Support tickets per week</p>
          <div class="flex flex-wrap gap-2">
            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${adminReplies} Admin ${adminReplies === 1 ? "Reply" : "Replies"}</span>
            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-grey-2 text-muted">${guestReplies} Guest ${guestReplies === 1 ? "Reply" : "Replies"}</span>
          </div>
        </div>
        ${ticketBuckets.some(b => b.total > 0) ? renderBarChart(ticketBuckets, "bg-slate-500", (v) => `${v} ticket${v === 1 ? "" : "s"}`) : `<p class="text-xs text-muted text-center py-10">No support tickets yet.</p>`}
      </div>
      <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
        <p class="text-sm font-extrabold text-title mb-4">Booth / device usage</p>
        <div class="flex items-baseline gap-2 mb-3">
          <strong class="text-2xl font-black text-title">${boothsOnline}</strong>
          <span class="text-sm text-muted font-bold">of ${booths.length} booths online</span>
        </div>
        <div class="w-full h-2.5 rounded-full bg-blue-100 overflow-hidden">
          <div class="h-full rounded-full bg-blue-500" style="width: ${boothOnlinePct}%"></div>
        </div>
        <p class="text-[11px] text-muted mt-3">A booth counts as online if the desktop app last checked in recently. Idle booths are still registered but not currently running an event.</p>
      </div>
    </div>

    <p class="text-[10px] uppercase font-black tracking-widest text-muted mt-8 mb-3">Usage</p>
    <div class="border border-line rounded-2xl bg-white p-5 shadow-sm">
      <p class="text-sm font-extrabold text-title mb-4">Galleries created per week</p>
      ${galleryBuckets.some(b => b.total > 0) ? renderBarChart(galleryBuckets, "bg-orange-500", (v) => `${v} galler${v === 1 ? "y" : "ies"}`) : `<p class="text-xs text-muted text-center py-10">No galleries yet.</p>`}
      <p class="text-[11px] text-muted mt-4">Galleries are created per finished event session and are a proxy for actual guest-facing usage, distinct from signups or revenue.</p>
    </div>
  `;
}

// ===================================================================
// Admin: Payment Proofs
// ===================================================================
let proofs = [];
let activeProofFilter = "all";

async function loadProofs() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  setMessage(adminMessage, "Loading payment proofs...");
  try {
    const { data, error } = await supabaseClient.from("payment_proofs").select("*").order("created_at", { ascending: false });
    if (error) throw error; proofs = data || [];
    setMessage(adminMessage, proofs.length ? `${proofs.length} proof(s) loaded.` : "No payment proofs found.");
    updateStats(); renderProofs();
  } catch (err) { setMessage(adminMessage, `Load error: ${err.message}`, true); }
}

function renderProofs() {
  proofList.innerHTML = "";
  const filtered = proofs.filter(p => activeProofFilter === "all" || p.status === activeProofFilter);
  if (!filtered.length) { proofList.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-10 text-center text-muted space-y-2"><i class="fa-solid fa-receipt text-4xl text-line"></i><p class="font-bold text-sm">No payment proofs match this filter.</p></div>`; return; }
  filtered.forEach(p => {
    const submittedAt = new Date(p.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const statusCls = p.status === "approved" ? "bg-green-100 text-green-800" : p.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800";
    const card = document.createElement("div"); card.className = "border border-line rounded-2xl bg-white shadow-sm overflow-hidden"; card.id = `proof-${p.id}`;
    const invoiceBtn = p.status === "approved" ? `<button onclick="generateInvoice('${p.id}')" class="btn-animation text-white text-[10px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1 col-span-2" style="background:#0c66e4"><i class="fa-solid fa-file-invoice"></i> View Invoice</button>` : "";
    card.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-line bg-grey/40"><div class="flex items-center gap-3"><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${statusCls}">${p.status}</span><span class="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-purple/10 text-purple">${p.billing}</span></div><span class="text-[10px] text-muted font-bold">Submitted ${submittedAt}</span></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start"><div class="lg:col-span-8 space-y-4"><div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-file-invoice-dollar text-muted"></i><strong class="text-title font-bold capitalize">${p.billing}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-peso-sign text-muted"></i><strong class="text-title font-bold">₱${Number(p.amount_php).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-hashtag text-muted"></i><strong class="text-title font-bold font-mono">${p.gcash_reference_number}</strong></span><span class="inline-flex items-center gap-1.5 text-body"><i class="fa-solid fa-user text-muted"></i><strong class="text-title font-bold">${p.gcash_sender_name || "—"}</strong></span></div><div class="border border-line rounded-xl overflow-hidden"><div class="px-4 py-2 bg-grey border-b border-line flex items-center justify-between"><span class="text-[10px] uppercase font-black text-muted">Screenshot</span><button type="button" onclick="viewProofScreenshot('${p.id}','${p.screenshot_path}')" class="text-[10px] text-purple font-black hover:underline flex items-center gap-1"><i class="fa-solid fa-eye"></i> View Screenshot</button></div><div id="screenshot-${p.id}" class="hidden p-4 bg-white"><img class="max-w-full rounded-lg border border-line" alt="Payment screenshot loading…" /><p class="text-[10px] text-muted mt-2">Cross-check the reference number and amount in your GCash app before approving.</p></div></div>${p.admin_note ? `<div class="text-xs border-t border-line pt-3"><span class="text-[10px] uppercase font-bold text-muted block">Admin Note</span><p class="text-body">${p.admin_note}</p></div>` : ""}</div><div class="lg:col-span-4 space-y-3 bg-grey border border-line rounded-2xl p-5"><p class="text-[10px] uppercase font-extrabold text-muted tracking-wider">Review Proof</p><div class="space-y-1"><label class="text-[10px] font-extrabold uppercase text-title">Admin Note (optional)</label><textarea id="proof-note-${p.id}" class="w-full border border-line rounded-lg px-3 py-2 text-xs bg-white resize-none h-16" placeholder="Reason for rejection, reference mismatch…">${p.admin_note || ""}</textarea></div><div class="grid grid-cols-2 gap-2 ${p.status !== "pending" ? "opacity-60 pointer-events-none" : ""}"><button onclick="reviewProof('${p.id}','${p.user_id}','${p.billing}', 'approved')" class="btn-animation text-white text-[10px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1" style="background:#16a34a"><i class="fa-solid fa-check"></i> Approve</button><button onclick="reviewProof('${p.id}','${p.user_id}','${p.billing}', 'rejected')" class="btn-animation text-white text-[10px] font-black py-2.5 rounded-xl flex items-center justify-center gap-1" style="background:#ef4444"><i class="fa-solid fa-xmark"></i> Reject</button></div>${invoiceBtn}${p.status !== "pending" ? `<p class="text-[10px] text-center text-muted">Already reviewed on ${p.reviewed_at ? new Date(p.reviewed_at).toLocaleDateString("en-PH") : "—"}</p>` : ""}</div></div>`;
    proofList.appendChild(card);
  });
}

async function viewProofScreenshot(proofId, path) {
  const container = document.getElementById(`screenshot-${proofId}`); if (!container) return;
  if (!container.classList.contains("hidden")) { container.classList.add("hidden"); return; }
  try {
    const { data, error } = await supabaseClient.storage.from("payment-proofs").createSignedUrl(path, 300);
    if (error) throw error; container.querySelector("img").src = data.signedUrl; container.classList.remove("hidden");
  } catch (err) { spawnToast("Screenshot Error", err.message, "fa-solid fa-circle-exclamation", "warning"); }
}

async function reviewProof(proofId, userId, billing, action) {
  if (!supabaseClient) return;
  const note = document.getElementById(`proof-note-${proofId}`)?.value?.trim() || null;
  spawnToast("Processing", action === "approved" ? "Activating license…" : "Rejecting proof…", "fa-solid fa-circle-notch", "info");
  try {
    const { error: proofErr } = await supabaseClient.from("payment_proofs").update({ status: action, reviewed_at: new Date().toISOString(), admin_note: note }).eq("id", proofId); if (proofErr) throw proofErr;
    if (action === "approved") {
      const isGallery = typeof billing === "string" && billing.startsWith("gallery_");
      if (isGallery) {
        // GALLERY ADD-ON — a tier (free | plus | business), independent of the
        // Pro subscription. Do NOT touch plan / subscription_plan here.
        const rawTier = billing.slice("gallery_".length);
        const galleryTier = ["free", "plus", "business"].includes(rawTier) ? rawTier : "free";
        const { error: licenseErr } = await supabaseClient.from("licenses").upsert({
          user_id: userId,
          gallery_tier: galleryTier,
          gallery_addon: galleryTier !== "free",
          last_payment_verified_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (licenseErr) throw licenseErr;
      } else {
        // PRO SUBSCRIPTION — monthly / yearly. Do NOT touch gallery fields here.
        // Per-tier entitlements:
        //   pro_monthly -> 20 events, 30 templates, no priority support
        //   pro_yearly  -> 50 events, 100 templates, priority support
        const isYearly = billing === "yearly";
        const months = isYearly ? 12 : 1;
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + months);
        const { error: licenseErr } = await supabaseClient.from("licenses").update({ state: "active", plan: isYearly ? "pro_yearly" : "pro_monthly", current_period_end: periodEnd.toISOString(), last_payment_verified_at: new Date().toISOString(), watermark: false, max_events: isYearly ? 50 : 20, templates: isYearly ? 100 : 30, priority_support: isYearly }).eq("user_id", userId); if (licenseErr) throw licenseErr;
        await supabaseClient.from("profiles").update({ subscription_plan: isYearly ? "pro_yearly" : "pro_monthly" }).eq("id", userId);
      }
      spawnToast("Approved", "License activated. Generating invoice...", "fa-solid fa-circle-check", "success");
      setTimeout(() => generateInvoice(proofId), 600);
    } else { spawnToast("Rejected", "Proof marked as rejected.", "fa-solid fa-circle-info", "info"); }
    loadProofs();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); }
}

// ===================================================================
// Public Review Submission
// ===================================================================

let selectedReviewRating = 5;
let selectedReviewDisplay = "name";

function setReviewRating(rating) {
  selectedReviewRating = rating;
  const ratingInput = document.getElementById("reviewRating");
  if (ratingInput) ratingInput.value = rating;
  document.querySelectorAll("#reviewStarPicker .review-star").forEach(btn => {
    const star = parseInt(btn.dataset.star);
    btn.classList.toggle("text-yellow-400", star <= rating);
    btn.classList.toggle("text-line", star > rating);
  });
}

function setReviewDisplayMode(mode) {
  selectedReviewDisplay = mode;
  document.querySelectorAll("#reviewDisplayToggle [data-display]").forEach(btn => {
    const isActive = btn.dataset.display === mode;
    btn.classList.toggle("active", isActive); btn.classList.toggle("bg-white", isActive); btn.classList.toggle("text-title", isActive); btn.classList.toggle("shadow-sm", isActive);
    btn.classList.toggle("text-body", !isActive);
  });
  const companyWrap = document.getElementById("reviewCompanyNameWrap");
  if (companyWrap) companyWrap.classList.toggle("hidden", mode !== "company");
}

async function handleReviewSubmit(event) {
  event.preventDefault();
  const submitBtn = document.getElementById("reviewSubmitBtn");
  const message = document.getElementById("reviewMessage");

  if (!window.currentSupabaseUser) {
    message.textContent = "Please sign in to submit a review.";
    message.style.color = "#dc2626";
    spawnToast("Sign In Required", "Log in to your account before submitting a review.", "fa-solid fa-user-lock", "warning");
    openAuthModal("login");
    return;
  }

  const name = document.getElementById("reviewName").value.trim();
  const reviewText = document.getElementById("reviewText").value.trim();
  const companyName = document.getElementById("reviewCompanyName").value.trim();
  const rating = selectedReviewRating;

  if (!name || !reviewText) {
    message.textContent = "Please fill in your name and review.";
    message.style.color = "#dc2626";
    return;
  }
  if (selectedReviewDisplay === "company" && !companyName) {
    message.textContent = "Please enter your company name, or choose a different display option.";
    message.style.color = "#dc2626";
    return;
  }

  const eventType = selectedReviewDisplay === "company" ? companyName
    : selectedReviewDisplay === "operator" ? "Photobooth Operator"
    : null;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Submitting...';
  message.textContent = "";

  try {
    if (!supabaseClient) throw new Error("Service temporarily unavailable. Please try again later.");
    const { error } = await supabaseClient.from("public_reviews").insert({
      user_id: window.currentSupabaseUser.id,
      name,
      review_text: reviewText,
      rating,
      event_type: eventType,
      source: "website",
      status: "pending",
      is_featured: false
    });
    if (error) throw error;

    document.getElementById("publicReviewForm").reset();
    setReviewRating(5);
    setReviewDisplayMode("name");
    message.textContent = "Thank you! Your review has been submitted and will appear after moderation.";
    message.style.color = "#22c55e";
    spawnToast("Review Submitted", "Your review will be visible once approved. Thank you!", "fa-solid fa-circle-check", "success");
  } catch (err) {
    message.textContent = err.message || "Could not submit your review. Please try again.";
    message.style.color = "#dc2626";
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i>Submit Review';
  }
}

// ===================================================================
// Admin: Reviews
// ===================================================================

async function loadReviewsAdmin() {
  if (!supabaseClient) return;
  if (!window.currentSupabaseUser) { try { const { data } = await supabaseClient.auth.getSession(); window.currentSupabaseUser = data?.session?.user || null; } catch (_) { } if (!window.currentSupabaseUser) return; }
  try { const { data, error } = await supabaseClient.from("public_reviews").select("*").order("created_at", { ascending: false }); if (error) throw error; reviews = data || []; renderReviewsAdmin(); } catch (err) { console.warn(err); }
}

function renderReviewsAdmin() {
  reviewList.innerHTML = "";
  if (!reviews.length) { reviewList.innerHTML = `<div class="border border-dashed border-line rounded-2xl p-8 text-center text-muted"><p class="font-bold text-sm">No reviews submitted for moderation yet.</p></div>`; return; }
  reviews.forEach(r => {
    const card = document.createElement("div"); card.className = "border border-line rounded-2xl bg-white p-6 shadow-sm flex justify-between items-start";
    const showsAs = r.event_type ? `Shows as: ${r.event_type}` : "Shows as: real name";
    card.innerHTML = `<div class="space-y-2"><span class="text-xs bg-purple/15 text-purple font-black px-2 py-0.5 rounded uppercase">${r.status}</span><h4 class="font-bold text-title text-base">${r.name}</h4><p class="text-[10px] text-muted font-bold uppercase tracking-wide">${showsAs}</p><p class="text-xs text-yellow-500">${'★'.repeat(r.rating)}</p><p class="text-xs text-body font-medium">${r.review_text}</p></div><div class="flex gap-2"><button onclick="updateReviewStatus(${r.id}, 'approved')" class="bg-green-500 hover:bg-green-600 text-white font-extrabold px-3 py-1 text-[10px] rounded uppercase">Approve</button><button onclick="updateReviewStatus(${r.id}, 'rejected')" class="bg-red-500 hover:bg-red-600 text-white font-extrabold px-3 py-1 text-[10px] rounded uppercase">Decline</button></div>`;
    reviewList.appendChild(card);
  });
}

async function updateReviewStatus(id, status) {
  if (!supabaseClient) return;
  try { const { error } = await supabaseClient.from("public_reviews").update({ status }).eq("id", id); if (error) throw error; spawnToast("Review moderated", `Status marked as: ${status}`, "fa-solid fa-check", "success"); loadReviewsAdmin(); loadReviews(); } catch (err) { console.warn(err); }
}

function starIcons(rating) {
  const filled = Math.max(0, Math.min(5, Math.round(rating || 5)));
  return Array.from({ length: 5 }, (_, i) => `<i class="fa-solid fa-star${i < filled ? "" : " text-line"}"></i>`).join("");
}

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function reviewCardHtml(r) {
  const isOperator = r.event_type === "Photobooth Operator";
  const displayLabel = r.event_type || r.name;
  const avatarContent = isOperator ? '<i class="fa-solid fa-camera"></i>' : initials(displayLabel);
  return `<div class="stars text-yellow-400 text-sm">${starIcons(r.rating)}</div>
    <p class="text-lg font-bold text-title leading-snug mt-3">"${r.review_text}"</p>
    <div class="flex items-center gap-3 mt-5 pt-4 border-t border-line">
      <div class="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center font-black text-sm shrink-0">${avatarContent}</div>
      <p class="font-bold text-title text-sm">${displayLabel}</p>
    </div>`;
}

function renderReviews(payload) {
  if (!googleReviewsList) return; // only exists on the home page
  const list = Array.isArray(payload.reviews) ? payload.reviews.filter(r => r.review_text).slice(0, 4) : [];
  googleReviewsList.innerHTML = "";
  if (!list.length) {
    const defaults = [
      { rating: 5, name: "Patricia Santos", review_text: "Studio Photuna completely transformed our wedding experience in Manila! The high-angle booth perspective felt super unique, and the instant prints matched our theme frames perfectly." },
      { rating: 5, name: "Liam Mendoza", review_text: "Highly recommend the 14-day free trial app configurations. Calibrating connected DSLR camera variables worked smoothly, and local test sheets printed flawlessly." },
      { rating: 5, name: "Sloane Perez", review_text: "Our guests loved the retro filters and quick QR-scans on their phone. Exceptional technical support during our corporate anniversary event setup!" },
      { rating: 5, name: "Marco Villanueva", review_text: "Setup took minutes, not hours. Connected our DSLR and dye-sub printer, mapped a template, and we were running our first session the same afternoon." }
    ];
    defaults.forEach(r => {
      const card = document.createElement("article"); card.className = "review-card card-testimonial hover-lift";
      card.innerHTML = reviewCardHtml(r);
      googleReviewsList.appendChild(card);
    }); return;
  }
  list.forEach(r => {
    const card = document.createElement("article"); card.className = "review-card card-testimonial hover-lift";
    card.innerHTML = reviewCardHtml(r);
    googleReviewsList.appendChild(card);
  });
  // Once a real approved review exists, the hero proof card upgrades from a
  // generic trial/pricing line to an actual quote instead of a fabricated one.
  const heroProofText = document.getElementById("heroProofText");
  const heroProofIcon = document.getElementById("heroProofIcon");
  if (heroProofText && list[0]) {
    heroProofText.textContent = `"${list[0].review_text}" — ${list[0].name}`;
    if (heroProofIcon) heroProofIcon.innerHTML = '<span class="text-yellow-300 text-xs">' + starIcons(list[0].rating || 5) + '</span>';
  }
}

async function loadReviews() {
  if (!supabaseClient) { renderReviews({ reviews: [] }); return; }
  try { const { data, error } = await supabaseClient.from("public_reviews").select("*").eq("status", "approved").order("created_at", { ascending: false }); if (error) throw error; renderReviews({ reviews: data || [] }); }
  catch (err) { console.warn("Unable to fetch reviews list", err); renderReviews({ reviews: [] }); }
}

// ===================================================================
// Admin: Packages — with modal + delete + Supabase CRUD
// ===================================================================
let adminPackages = [];

async function loadAdminPackages() {
  await loadPackagesFromSupabase();
  adminPackages = Object.entries(packageCatalog).map(([key, p]) => ({ key, ...p }));
}

function renderPackagesAdmin() {
  const list = document.getElementById("packagesList"); if (!list) return;
  list.innerHTML = "";
  const customBookings = bookings.filter(b => b.is_custom_quote);
  list.insertAdjacentHTML("beforeend", `
    <div class="bg-white border border-line rounded-3xl shadow-sm overflow-hidden">
      <div class="px-6 py-4 border-b border-line bg-grey/40 flex items-center justify-between">
        <h3 class="font-black text-title text-base">Package Catalog</h3>
        <button onclick="openPackageModal('add')" class="btn-animation bg-purple text-white text-xs font-black px-4 py-2 rounded-full flex items-center gap-2"><i class="fa-solid fa-plus"></i> Add Package</button>
      </div>
      <div class="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="pkgCatalogGrid"></div>
    </div>
    ${customBookings.length ? `
    <div class="bg-white border border-purple/20 rounded-3xl shadow-sm overflow-hidden ring-1 ring-purple/20">
      <div class="px-6 py-4 border-b border-line bg-purple/5 flex items-center gap-3"><i class="fa-solid fa-envelope text-purple"></i><h3 class="font-black text-title text-base">Custom Quote Requests (${customBookings.length})</h3></div>
      <div class="p-6 space-y-4" id="customQuoteBookingList"></div>
    </div>` : `
    <div class="border border-dashed border-line rounded-2xl p-8 text-center text-muted"><i class="fa-solid fa-circle-check text-3xl text-green mb-3 block"></i><p class="font-bold text-sm">No custom quote requests pending.</p></div>`}`);

  const catalogGrid = document.getElementById("pkgCatalogGrid");
  if (catalogGrid) {
    adminPackages.forEach((pkg, idx) => {
      catalogGrid.insertAdjacentHTML("beforeend", `
        <div class="border border-line rounded-2xl p-5 space-y-3 bg-grey">
          <div class="flex items-start justify-between gap-2">
            <p class="font-extrabold text-title text-sm">${pkg.name}</p>
            <div class="flex items-center gap-2">
              <button onclick="openPackageModal('edit', ${idx})" class="text-[10px] text-purple font-black hover:underline"><i class="fa-solid fa-pen"></i> Edit</button>
              <button onclick="deletePackage(${idx})" class="text-[10px] text-red-500 font-black hover:underline"><i class="fa-solid fa-trash"></i> Delete</button>
            </div>
          </div>
          <p class="text-xl font-black text-purple">₱${pkg.price.toLocaleString()}</p>
          <p class="text-[10px] text-muted font-bold uppercase">+₱${pkg.extraRate.toLocaleString()}/extra hr · ${pkg.coverage}</p>
          <ul class="text-[10px] text-body space-y-0.5 border-t border-line pt-2">
            ${pkg.included.slice(0, 3).map(i => `<li>• ${i}</li>`).join("")}
            ${pkg.included.length > 3 ? `<li class="text-muted">+${pkg.included.length - 3} more…</li>` : ""}
          </ul>
        </div>`);
    });
  }

  const cqList = document.getElementById("customQuoteBookingList");
  if (cqList) {
    customBookings.forEach(b => {
      cqList.insertAdjacentHTML("beforeend", `
        <div class="border border-line rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div class="space-y-1"><p class="font-extrabold text-title">${b.full_name} <span class="text-[10px] font-bold text-muted ml-2">${b.email || b.phone || ""}</span></p><p class="text-xs text-body">${b.package_name || "No package selected"} · ${b.estimated_guests} guests · ${b.event_date}</p><p class="text-xs text-muted">${b.venue_location || ""}</p></div>
          <button onclick="openQuoteModal('${b.id}','${(b.email || "").replace(/'/g, "\\'")}','${(b.full_name || "").replace(/'/g, "\\'")}','${(b.package_name || "").replace(/'/g, "\\'")}',${b.estimated_guests || 0})" class="btn-animation shrink-0 bg-purple text-white text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2"><i class="fa-solid fa-paper-plane"></i> Send Custom Quote</button>
        </div>`);
    });
  }
}

// -----------------------------------------------------------------------
// Package Modal (replaces browser prompt())
// -----------------------------------------------------------------------
function openPackageModal(mode, idx) {
  const existing = document.getElementById("packageModal"); if (existing) existing.remove();
  const pkg = mode === "edit" ? adminPackages[idx] : null;
  const title = mode === "edit" ? "Edit Package" : "Add New Package";
  const modal = document.createElement("div"); modal.id = "packageModal";
  modal.className = "fixed inset-0 bg-[#111827]/50 backdrop-blur-md z-50 grid place-items-center p-4";
  modal.innerHTML = `
    <div class="w-full max-w-lg bg-white border border-line rounded-3xl shadow-luxe overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line">
        <h3 class="font-black text-title text-base">${title}</h3>
        <button onclick="document.getElementById('packageModal').remove()" class="w-9 h-9 border border-line rounded-full flex items-center justify-center hover:bg-grey text-lg">&times;</button>
      </div>
      <div class="p-6 space-y-4">
        <div class="space-y-1.5">
          <label class="text-xs font-extrabold text-title uppercase">Package Name *</label>
          <input id="pmName" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" value="${pkg ? pkg.name : ""}" placeholder="e.g. Premium Photobooth" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-extrabold text-title uppercase">Base Price (PHP) *</label>
            <input id="pmPrice" type="number" min="0" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" value="${pkg ? pkg.price : ""}" placeholder="e.g. 23000" />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-extrabold text-title uppercase">Extra Hour Rate (PHP)</label>
            <input id="pmExtraRate" type="number" min="0" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" value="${pkg ? pkg.extraRate : "1000"}" placeholder="e.g. 2000" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs font-extrabold text-title uppercase">Coverage</label>
            <input id="pmCoverage" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" value="${pkg ? pkg.coverage : "3 hours"}" placeholder="e.g. 3 hours" />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs font-extrabold text-title uppercase">Icon (FA class)</label>
            <input id="pmIcon" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" value="${pkg ? pkg.icon : "fa-camera"}" placeholder="e.g. fa-camera" />
          </div>
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-extrabold text-title uppercase">Inclusions (one per line)</label>
          <textarea id="pmIncluded" rows="4" class="w-full border border-line rounded-xl px-4 py-3 text-sm resize-none focus:border-purple outline-none" placeholder="Private enclosed photobooth setup&#10;Custom strip template overlay designs&#10;QR live download access">${pkg ? pkg.included.join("\n") : ""}</textarea>
        </div>
        <div class="flex gap-3">
          <button onclick="document.getElementById('packageModal').remove()" class="flex-1 border border-line hover:bg-grey py-3 rounded-full font-extrabold text-sm text-title">Cancel</button>
          <button onclick="savePackageModal('${mode}', ${idx !== undefined ? idx : -1})" class="btn-animation flex-1 bg-purple hover:bg-purple-dark text-white font-extrabold py-3 rounded-full text-sm"><i class="fa-solid fa-check mr-1"></i> ${mode === "edit" ? "Save Changes" : "Add Package"}</button>
        </div>
        <p id="packageModalMsg" class="text-center text-xs font-bold text-red-600 hidden"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);
  // Close on backdrop click
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
}

async function savePackageModal(mode, idx) {
  const name = document.getElementById("pmName")?.value?.trim();
  const price = parseInt(document.getElementById("pmPrice")?.value);
  const extraRate = parseInt(document.getElementById("pmExtraRate")?.value) || 1000;
  const coverage = document.getElementById("pmCoverage")?.value?.trim() || "3 hours";
  const icon = document.getElementById("pmIcon")?.value?.trim() || "fa-camera";
  const included = (document.getElementById("pmIncluded")?.value || "").split("\n").map(s => s.trim()).filter(Boolean);
  const msgEl = document.getElementById("packageModalMsg");

  if (!name) { msgEl.textContent = "Package name is required."; msgEl.classList.remove("hidden"); return; }
  if (isNaN(price) || price < 0) { msgEl.textContent = "Enter a valid base price."; msgEl.classList.remove("hidden"); return; }

  const key = mode === "edit" ? adminPackages[idx].key : name.toLowerCase().replace(/[^a-z0-9]/g, "-");

  // Save to Supabase
  if (supabaseClient) {
    try {
      if (mode === "edit") {
        const { error } = await supabaseClient.from("packages").update({ name, price, extra_rate: extraRate, coverage, icon, included }).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient.from("packages").insert({ key, name, price, extra_rate: extraRate, coverage, icon, included, sort_order: adminPackages.length, is_active: true });
        if (error) throw error;
      }
    } catch (err) {
      msgEl.textContent = err.message || "Failed to save to database."; msgEl.classList.remove("hidden"); return;
    }
  }

  // Update local state
  packageCatalog[key] = { name, price, extraRate, coverage, icon, included };
  adminPackages = Object.entries(packageCatalog).map(([k, p]) => ({ key: k, ...p }));

  document.getElementById("packageModal").remove();
  spawnToast(mode === "edit" ? "Package Updated" : "Package Added", `${name} — ₱${price.toLocaleString()}`, "fa-solid fa-circle-check", "success");
  renderPackagesAdmin();
  buildWizardPkgGrid();
  renderQuote();
}

async function deletePackage(idx) {
  const pkg = adminPackages[idx]; if (!pkg) return;
  if (!confirm(`Delete "${pkg.name}"? This cannot be undone.`)) return;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from("packages").delete().eq("key", pkg.key);
      if (error) throw error;
    } catch (err) { spawnToast("Delete Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); return; }
  }

  delete packageCatalog[pkg.key];
  adminPackages = Object.entries(packageCatalog).map(([k, p]) => ({ key: k, ...p }));
  spawnToast("Package Deleted", `${pkg.name} removed from catalog.`, "fa-solid fa-trash", "success");
  renderPackagesAdmin();
  buildWizardPkgGrid();
  renderQuote();
}

// Build wizard package checkboxes (called on load and after package changes)
function buildWizardPkgGrid() {
  const grid = document.getElementById("wizardPkgGrid"); if (!grid) return;
  grid.innerHTML = "";
  Object.entries(packageCatalog).forEach(([key, pkg]) => {
    grid.insertAdjacentHTML("beforeend", `
      <label class="flex items-start gap-3 border-2 border-line rounded-xl p-3 cursor-pointer hover:border-purple transition-all">
        <input type="checkbox" id="wpkg_${key}" onchange="renderQuote()" class="mt-0.5 accent-purple w-4 h-4 shrink-0" />
        <div class="flex-1">
          <p class="text-xs font-extrabold text-title">${pkg.name}</p>
          <p class="text-[10px] text-purple font-bold">₱${pkg.price.toLocaleString()}</p>
        </div>
      </label>`);
  });
}

// ===================================================================
// Custom Quote Modal
// ===================================================================
function openQuoteModal(bookingId, email, clientName, packageNames, guestCount) {
  const existing = document.getElementById("quoteModal"); if (existing) existing.remove();
  const modal = document.createElement("div"); modal.id = "quoteModal";
  modal.className = "fixed inset-0 bg-[#111827]/50 backdrop-blur-md z-50 grid place-items-center p-4";
  modal.innerHTML = `
    <div class="w-full max-w-lg bg-white border border-line rounded-3xl shadow-luxe overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line">
        <div><h3 class="font-black text-title text-base">Send Custom Quote</h3><p class="text-xs text-muted mt-0.5">For: <strong>${clientName}</strong>${email ? ` · ${email}` : ""}</p></div>
        <button onclick="document.getElementById('quoteModal').remove()" class="w-9 h-9 border border-line rounded-full flex items-center justify-center hover:bg-grey text-lg">&times;</button>
      </div>
      <div class="p-6 space-y-4">
        ${!email ? `<div class="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800 font-bold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>No email on file. Enter one below.</div>` : ""}
        <div class="space-y-1.5"><label class="text-xs font-extrabold text-title uppercase">Client Email *</label><input id="qEmail" type="email" value="${email}" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" placeholder="client@email.com" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5"><label class="text-xs font-extrabold text-title uppercase">Custom Rate (PHP) *</label><input id="qAmount" type="number" min="0" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" placeholder="e.g. 45000" oninput="const d=document.getElementById('qDeposit');if(this.value)d.value=Math.round(parseFloat(this.value)/2)" /></div>
          <div class="space-y-1.5"><label class="text-xs font-extrabold text-title uppercase">50% Deposit</label><input id="qDeposit" type="number" min="0" class="w-full border border-line rounded-xl px-4 py-3 text-sm focus:border-purple outline-none" placeholder="Auto-filled" /></div>
        </div>
        <div class="space-y-1.5"><label class="text-xs font-extrabold text-title uppercase">Message / Quote Details</label><textarea id="qMessage" rows="5" class="w-full border border-line rounded-xl px-4 py-3 text-sm resize-none focus:border-purple outline-none" placeholder="Hi ${clientName}, based on your event (${guestCount} guests, ${packageNames}), here is our custom rate…"></textarea></div>
        <div class="bg-grey border border-line rounded-xl p-3 text-xs text-body"><p class="font-bold text-title mb-1">How this works</p>The custom rate and message will be saved to the booking record as an admin note. Copy the details above and email the client manually from <span class="text-purple">notification@studiophotuna.com</span>.</div>
        <div class="flex gap-3">
          <button onclick="document.getElementById('quoteModal').remove()" class="flex-1 border border-line hover:bg-grey py-3 rounded-full font-extrabold text-sm text-title">Cancel</button>
          <button onclick="saveCustomQuote('${bookingId}', this)" class="btn-animation flex-1 bg-purple hover:bg-purple-dark text-white font-extrabold py-3 rounded-full text-sm"><i class="fa-solid fa-check mr-1"></i> Save Quote</button>
        </div>
        <p id="quoteModalMsg" class="text-center text-xs font-bold text-red-600 hidden"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function saveCustomQuote(bookingId, btn) {
  const email = document.getElementById("qEmail")?.value?.trim();
  const amount = parseFloat(document.getElementById("qAmount")?.value) || 0;
  const deposit = parseFloat(document.getElementById("qDeposit")?.value) || 0;
  const message = document.getElementById("qMessage")?.value?.trim() || "";
  const msgEl = document.getElementById("quoteModalMsg");
  if (!email) { msgEl.textContent = "Client email is required."; msgEl.classList.remove("hidden"); return; }
  if (!amount) { msgEl.textContent = "Enter a custom rate amount."; msgEl.classList.remove("hidden"); return; }
  btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Saving…`;
  const adminNote = `[CUSTOM QUOTE] Rate: ₱${amount.toLocaleString()} | Deposit: ₱${deposit.toLocaleString()} | Email: ${email}${message ? `\n\n${message}` : ""}`;
  try {
    const { error } = await supabaseClient.from("event_bookings").update({ estimated_total: amount, email, admin_note: adminNote }).eq("id", bookingId); if (error) throw error;
    document.getElementById("quoteModal").remove();
    spawnToast("Quote Saved", `Custom quote of ₱${amount.toLocaleString()} saved. Email ${email} with the details.`, "fa-solid fa-circle-check", "success"); loadBookings();
  } catch (err) { msgEl.textContent = err.message || "Failed to save."; msgEl.classList.remove("hidden"); btn.disabled = false; btn.innerHTML = `<i class="fa-solid fa-check mr-1"></i> Save Quote`; }
}

// ===================================================================
// Collapsible Sections: Review Form & FAQ Accordion
// ===================================================================

function toggleReviewForm() {
  const body = document.getElementById("reviewFormBody");
  const chevron = document.getElementById("reviewFormChevron");
  if (!body) return;
  body.classList.toggle("hidden");
  if (chevron) chevron.style.transform = body.classList.contains("hidden") ? "" : "rotate(180deg)";
}

function toggleFaq(btn) {
  const item = btn.closest(".faq-item");
  const answer = item.querySelector(".faq-answer");
  const chevron = btn.querySelector("i");
  if (!answer) return;
  // Close other open FAQs
  document.querySelectorAll(".faq-item").forEach(other => {
    if (other !== item) {
      other.querySelector(".faq-answer")?.classList.add("hidden");
      other.classList.remove("is-open");
      const otherChevron = other.querySelector("button i");
      if (otherChevron) otherChevron.style.transform = "";
    }
  });
  answer.classList.toggle("hidden");
  const isOpen = !answer.classList.contains("hidden");
  item.classList.toggle("is-open", isOpen);
  if (chevron) chevron.style.transform = isOpen ? "rotate(180deg)" : "";
}

// Hardware flow diagram: swap the shared detail panel's content based on
// which step icon is hovered/focused, instead of a small per-icon popup.
function showFlowStep(el, index, group) {
  const scope = group || "hardware";
  document.querySelectorAll('.flow-icon[data-flow-group="' + scope + '"]').forEach(icon => icon.classList.toggle("is-active", icon === el));
  document.querySelectorAll('.flow-detail-step[data-flow-group="' + scope + '"]').forEach(step => {
    step.classList.toggle("hidden", Number(step.dataset.flowDetail) !== index);
  });
}


// ===================================================================
// Init & Event Listeners
// ===================================================================

window.onload = async function () {
  // Load packages from Supabase first, then build UI
  await loadPackagesFromSupabase();
  adminPackages = Object.entries(packageCatalog).map(([key, p]) => ({ key, ...p }));

  setActiveNav(CURRENT_VIEW);
  setBillingPlan(selectedBilling); // guarded internally; Pro plan card can appear on more than one page

  if (CURRENT_VIEW === 'book-event') {
    buildWizardProgress(); buildWizardPkgGrid();
    showBookingStep(0); renderBookingCalendar(); loadBookingAvailability();
    applyBookingPaymentModeNote();
  } else if (CURRENT_VIEW === 'bookings-admin') {
    if (adminMessage) setMessage(adminMessage, "Loading bookings...");
    Promise.all([loadBookings(), loadReviewsAdmin()]).then(() => {
      const stamp = document.getElementById("adminLastUpdated");
      if (stamp) stamp.textContent = "Updated " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
    });
  } else if (CURRENT_VIEW === 'home') {
    loadReviews();
    if (window.location.hash) scrollAndHighlight(window.location.hash.slice(1));
  } else if (CURRENT_VIEW === 'privacy-request') {
    initPrivacyRequestPage();
  }

  if (supabaseClient) {
    supabaseClient.auth.getSession().then(({ data }) => {
      const user = data?.session?.user || null;
      window.currentSupabaseUser = user;
      loadAccountState(user).then(() => { handleCheckoutRedirectResult(); if (CURRENT_VIEW === 'payment-app-success') initPaymentSuccessPage(); });
    });
    supabaseClient.auth.onAuthStateChange((evt, session) => {
      const user = session?.user || null; window.currentSupabaseUser = user; loadAccountState(user);
      if (evt === "PASSWORD_RECOVERY" && CURRENT_VIEW === 'account') {
        document.getElementById("passwordForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
        spawnToast("Reset Your Password", "Enter a new password below to finish resetting your account.", "fa-solid fa-key", "info");
      }
    });
  } else { handleCheckoutRedirectResult(); if (CURRENT_VIEW === 'payment-app-success') initPaymentSuccessPage(); }

  if (CURRENT_VIEW === 'payment-book-success') initBookingSuccessPage();
};

async function initPaymentSuccessPage() {
  const statusMsg = document.getElementById("paymentStatusMessage");
  if (!statusMsg) return;
  if (!window.currentSupabaseUser || !supabaseClient) {
    statusMsg.textContent = "Sign in to your account to see your updated plan.";
    return;
  }

  // PayPal doesn't confirm payment via webhook in this flow -- after the
  // customer approves on paypal.com it redirects back here with `token`
  // (the order id), and the charge only actually happens once we call the
  // capture endpoint server-side.
  const paypalOrderId = new URLSearchParams(window.location.search).get("token");
  if (paypalOrderId) {
    statusMsg.textContent = "Finalizing your PayPal payment...";
    try {
      const { data, error } = await supabaseClient.functions.invoke("capture-subscription-payment", { body: { order_id: paypalOrderId } });
      statusMsg.textContent = (!error && data?.captured)
        ? "Your Pro plan is now active. Welcome aboard!"
        : "We couldn't finalize your PayPal payment automatically. Please contact support.";
    } catch (err) {
      console.error("PayPal subscription capture error:", err);
      statusMsg.textContent = "We couldn't finalize your PayPal payment automatically. Please contact support.";
    } finally {
      await loadAccountState(window.currentSupabaseUser);
      renderPaymentReceiptFromLicense();
    }
    return;
  }

  // PayMongo/Xendit are confirmed via webhook, not a client-side
  // verification call -- loadAccountState() already ran before this and
  // populated currentLicense, so just reflect what it currently shows.
  const provider = currentLicense?.payment_provider;
  if (provider === "paymongo" || provider === "xendit") {
    statusMsg.textContent = currentLicense?.state === "active"
      ? "Your Pro plan is now active. Welcome aboard!"
      : "We're still confirming your payment. This can take a moment -- refresh this page shortly, or contact support if it persists.";
    renderPaymentReceiptFromLicense();
    return;
  }

  try {
    const { data, error } = await supabaseClient.functions.invoke("verify-checkout-session", { body: {} });
    if (error) throw error;
    statusMsg.textContent = data?.verified
      ? "Your Pro plan is now active. Welcome aboard!"
      : "We're still confirming your payment. Check your account page in a moment, or contact support if this persists.";
  } catch (err) {
    console.error("Payment verification error:", err);
    statusMsg.textContent = "We couldn't confirm your payment automatically. Please check your account page, or contact support if you were charged.";
  } finally {
    await loadAccountState(window.currentSupabaseUser);
    renderPaymentReceiptFromLicense();
  }
}

function renderPaymentReceiptFromLicense() {
  if (!currentLicense) return;
  const billing = currentLicense.plan === "pro_yearly" ? "yearly" : currentLicense.plan === "pro_monthly" ? "monthly" : null;
  renderPaymentReceipt("payment", {
    amount: billing ? PHP_AMOUNTS[billing] : null,
    txnId: currentLicense.payment_session_id || currentLicense.stripe_subscription_id || currentLicense.paymongo_checkout_session_id,
    date: currentLicense.last_payment_verified_at || currentLicense.updated_at,
    provider: currentLicense.payment_provider,
  });
}

// Runs regardless of login state -- booking guests aren't signed into a
// Studio Photuna account, so this reads a narrow public-safe status via a
// SECURITY DEFINER RPC rather than the (auth-gated) event_bookings table.
async function initBookingSuccessPage() {
  const statusMsg = document.getElementById("bookingPaymentStatusMessage");
  if (!statusMsg || !supabaseClient) return;
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get("booking_id");
  if (!bookingId) { statusMsg.textContent = ""; return; }

  // PayPal doesn't confirm payment via webhook in this flow -- after the
  // guest approves on paypal.com it redirects back here with `token` (the
  // order id), and the charge only actually happens once we call the
  // capture endpoint server-side.
  const paypalOrderId = params.get("token");
  if (paypalOrderId) {
    statusMsg.textContent = "Finalizing your PayPal payment...";
    try {
      const { data, error } = await supabaseClient.functions.invoke("capture-booking-payment", { body: { booking_id: bookingId, order_id: paypalOrderId } });
      if (error || !data?.captured) {
        statusMsg.textContent = "We couldn't finalize your PayPal payment automatically. Please contact support.";
        return;
      }
    } catch (err) {
      console.error("PayPal capture error:", err);
      statusMsg.textContent = "We couldn't finalize your PayPal payment automatically. Please contact support.";
      return;
    }
  }

  try {
    const { data, error } = await supabaseClient.rpc("get_public_booking_payment_status", { p_booking_id: bookingId });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    statusMsg.textContent = (row?.reservation_status === "partial_paid" || row?.reservation_status === "paid")
      ? "Your deposit payment is confirmed."
      : "We're still confirming your payment. This can take a moment -- refresh this page shortly, or contact support if it persists.";
    renderPaymentReceipt("bookingPayment", {
      amount: row?.deposit_amount,
      txnId: row?.payment_session_id,
      date: row?.reservation_paid_at,
      provider: row?.payment_provider,
    });
  } catch (err) {
    console.error("Booking payment verification error:", err);
    statusMsg.textContent = "";
  }
}

// Runs regardless of login state -- this form is for anyone (booth guests
// without an account included) to submit a GDPR/UK GDPR/RA 10173 data
// request. The privacy_requests RLS policy only grants anon/authenticated
// INSERT (no SELECT), by design -- a public SELECT policy would let anyone
// holding the public anon key dump every submitted name/email/event detail.
// That means .insert().select() can't read the row back (Postgres RLS
// requires a SELECT policy to return anything from INSERT ... RETURNING),
// so the reference id is generated client-side and sent as part of the
// insert instead.
function initPrivacyRequestPage() {
  const form = document.getElementById("privacyRequestForm");
  if (!form) return;
  const errorBanner = document.getElementById("privacyRequestError");
  const formCard = document.getElementById("privacyRequestFormCard");
  const successCard = document.getElementById("privacyRequestSuccessCard");
  const submitBtn = document.getElementById("privacyRequestSubmitBtn");

  form.onsubmit = async (event) => {
    event.preventDefault();
    errorBanner.classList.add("hidden"); errorBanner.textContent = "";

    const requestType = document.getElementById("privacyRequestType").value;
    const requesterName = document.getElementById("privacyRequesterName").value.trim();
    const requesterEmail = document.getElementById("privacyRequesterEmail").value.trim();
    const eventDate = document.getElementById("privacyEventDate").value || null;
    const eventVenue = document.getElementById("privacyEventVenue").value.trim() || null;
    const sessionDescription = document.getElementById("privacySessionDescription").value.trim() || null;

    const showError = (msg) => { errorBanner.textContent = msg; errorBanner.classList.remove("hidden"); errorBanner.scrollIntoView({ behavior: "smooth", block: "nearest" }); };
    if (!requestType) { showError("Please select a request type."); return; }
    if (!requesterName) { showError("Please enter your full name."); return; }
    if (!requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) { showError("Please enter a valid email address."); return; }

    submitBtn.disabled = true; submitBtn.textContent = "Submitting…";
    try {
      if (!supabaseClient) throw new Error("Service unavailable. Please email dpo@studiophotuna.com directly.");
      const requestId = crypto.randomUUID();
      const { error } = await supabaseClient.from("privacy_requests").insert({
        id: requestId,
        request_type: requestType,
        requester_name: requesterName,
        requester_email: requesterEmail,
        event_date: eventDate,
        event_venue: eventVenue,
        session_description: sessionDescription,
      });
      if (error) throw error;

      const shortRef = "PR-" + requestId.slice(0, 8).toUpperCase();
      document.getElementById("privacyRequestConfirmEmail").textContent = requesterEmail;
      document.getElementById("privacyRequestRefBadge").textContent = shortRef;
      formCard.classList.add("hidden");
      successCard.classList.remove("hidden");
      successCard.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      console.error("Privacy request submission error:", err);
      showError(err.message || "Something went wrong. Please try again or email dpo@studiophotuna.com directly.");
      submitBtn.disabled = false; submitBtn.textContent = "Submit Request";
    }
  };
}

function handleCheckoutRedirectResult() {
  const params = new URLSearchParams(window.location.search);
  const result = params.get("checkout"); if (!result) return;
  if (result === "success") { navigateTo('account'); verifyPendingPayment(); }
  else if (result === "cancelled") { spawnToast("Checkout Cancelled", "No charge was made. You can subscribe anytime.", "fa-solid fa-circle-info", "info"); }
  params.delete("checkout"); params.delete("provider"); params.delete("session_id");
  const cleanUrl = window.location.pathname + (params.toString() ? `?${params}` : "") + window.location.hash;
  window.history.replaceState({}, document.title, cleanUrl);
}

// The visible bar is .header-shell inside the transparent .site-header
// shell, so the scrolled state is styled off `.scrolled .header-shell` in
// head.html -- including its own shadow, which is why no shadow utility is
// toggled on the header element itself any more.
window.addEventListener("scroll", () => { const header = document.querySelector(".site-header"); if (header) { header.classList.toggle("scrolled", window.scrollY > 10); } });

function toggleMobileMenu() { const menu = document.getElementById("mobile-menu"); menu.classList.toggle("hidden"); }
if (hamburger) hamburger.onclick = toggleMobileMenu;

// Guarded as a single block since all 4 elements only exist on the
// book-event page -- on any other page these are null, and an unguarded
// dereference here would throw synchronously and abort every subsequent
// top-level statement in this file (header wiring, admin tabs, auth
// modal, etc.), not just booking-wizard code.
if (eventBookingForm) {
  bookingPrevStep.onclick = () => showBookingStep(currentBookingStep - 1);
  bookingNextStep.onclick = () => { if (!validateCurrentStep()) return; showBookingStep(currentBookingStep + 1); };
  bookingExtraHours.onchange = () => { renderQuote(); };
  eventBookingForm.onsubmit = handleBookingSubmit;
}

if (dropdownButton) {
  dropdownButton.onclick = (e) => {
    e.stopPropagation(); const open = userDropdown.classList.toggle("open");
    dropdownButton.setAttribute("aria-expanded", String(open));
    document.querySelector(".dropdown-menu").classList.toggle("hidden", !open);
    document.querySelector(".dropdown-menu").classList.toggle("flex", open);
  };
}
document.onclick = () => { closeDropdown(); document.querySelector(".dropdown-menu")?.classList.add("hidden"); };

const proofList = document.getElementById("proofList");
const proofFilterButtons = document.querySelectorAll("[data-proof-filter]");

const ADMIN_TAB_TITLES = { bookings: "Bookings", proofs: "Payment Proofs", tickets: "Support Tickets", packages: "Packages", privacy: "Privacy Requests", reviews: "Reviews", inbox: "Inbox", analytics: "Analytics", settings: "Settings", discounts: "Discount Codes", "manual-sub": "Manual Subscription" };
const ADMIN_GROUPS = { bookings: ["bookings", "packages"], support: ["proofs", "tickets", "inbox"], privacy: ["privacy"], reviews: ["reviews"], analytics: ["analytics"], settings: ["settings", "discounts", "manual-sub"] };
let activeAdminGroup = "bookings";
const adminGroupButtons = document.querySelectorAll(".admin-group-tabs [data-admin-group]");
const adminSubtabsRow = document.getElementById("adminSubtabsRow");

async function loadActiveAdminTab() {
  let task;
  if (activeAdminTab === "bookings") task = loadBookings();
  else if (activeAdminTab === "proofs") task = loadProofs();
  else if (activeAdminTab === "tickets") task = loadTickets();
  else if (activeAdminTab === "packages") task = loadAdminPackages().then(() => renderPackagesAdmin());
  else if (activeAdminTab === "inbox") task = loadInboxEmails();
  else if (activeAdminTab === "privacy") task = loadPrivacyRequestsAdmin();
  else if (activeAdminTab === "analytics") task = loadAnalytics();
  else if (activeAdminTab === "settings") task = loadPaymentGatewaySettings();
  else if (activeAdminTab === "discounts") task = loadDiscountCodes();
  else if (activeAdminTab === "manual-sub") task = loadManualSubPanel();
  else task = loadReviewsAdmin();
  await task;
  const stamp = document.getElementById("adminLastUpdated");
  if (stamp) stamp.textContent = "Updated " + new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

// Jumps a stat card click to the matching group/tab, then simulates a click
// on the filter button that reproduces exactly what the stat counted.
function jumpToAdminFilter(group, tab, filterBtnId) {
  activateAdminGroup(group, tab);
  const btn = document.getElementById(filterBtnId);
  if (btn) btn.click();
}

function activateAdminTab(tab) {
  activeAdminTab = tab;
  if (adminPanelTitle) adminPanelTitle.textContent = ADMIN_TAB_TITLES[activeAdminTab] || "Bookings";
  adminTabButtons.forEach(b => {
    const isActive = b.dataset.adminTab === activeAdminTab;
    b.classList.toggle("active", isActive); b.classList.toggle("border-purple/40", isActive); b.classList.toggle("bg-purple/5", isActive); b.classList.toggle("text-purple", isActive);
    b.classList.toggle("border-line", !isActive); b.classList.toggle("bg-white", !isActive); b.classList.toggle("text-body", !isActive);
  });
  bookingList.classList.toggle("hidden", activeAdminTab !== "bookings");
  proofList.classList.toggle("hidden", activeAdminTab !== "proofs");
  const ticketList = document.getElementById("ticketList"); if (ticketList) ticketList.classList.toggle("hidden", activeAdminTab !== "tickets");
  const packagesList = document.getElementById("packagesList"); if (packagesList) packagesList.classList.toggle("hidden", activeAdminTab !== "packages");
  reviewList.classList.toggle("hidden", activeAdminTab !== "reviews");
  const inboxList = document.getElementById("inboxList"); if (inboxList) inboxList.classList.toggle("hidden", activeAdminTab !== "inbox");
  const privacyRequestList = document.getElementById("privacyRequestList"); if (privacyRequestList) privacyRequestList.classList.toggle("hidden", activeAdminTab !== "privacy");
  const analyticsPanel = document.getElementById("analyticsPanel"); if (analyticsPanel) analyticsPanel.classList.toggle("hidden", activeAdminTab !== "analytics");
  const settingsPanel = document.getElementById("settingsPanel"); if (settingsPanel) settingsPanel.classList.toggle("hidden", activeAdminTab !== "settings");
  const discountsPanel = document.getElementById("discountsPanel"); if (discountsPanel) discountsPanel.classList.toggle("hidden", activeAdminTab !== "discounts");
  const manualSubPanel = document.getElementById("manualSubPanel"); if (manualSubPanel) manualSubPanel.classList.toggle("hidden", activeAdminTab !== "manual-sub");
  const bookingSubToolbar = document.getElementById("bookingSubToolbar");
  const proofsSubToolbar = document.getElementById("proofsSubToolbar");
  const inboxSubToolbar = document.getElementById("inboxSubToolbar");
  const privacySubToolbar = document.getElementById("privacySubToolbar");
  if (bookingSubToolbar) bookingSubToolbar.classList.toggle("hidden", activeAdminTab !== "bookings");
  if (proofsSubToolbar) { proofsSubToolbar.classList.toggle("hidden", activeAdminTab !== "proofs"); proofsSubToolbar.classList.toggle("flex", activeAdminTab === "proofs"); }
  if (inboxSubToolbar) { inboxSubToolbar.classList.toggle("hidden", activeAdminTab !== "inbox"); inboxSubToolbar.classList.toggle("flex", activeAdminTab === "inbox"); }
  if (privacySubToolbar) { privacySubToolbar.classList.toggle("hidden", activeAdminTab !== "privacy"); privacySubToolbar.classList.toggle("flex", activeAdminTab === "privacy"); }
  loadActiveAdminTab();
}

function activateAdminGroup(group, preferredTab) {
  activeAdminGroup = group;
  const tabsInGroup = ADMIN_GROUPS[group] || [];
  adminGroupButtons.forEach(b => {
    const isActive = b.dataset.adminGroup === group;
    b.classList.toggle("active", isActive); b.classList.toggle("bg-white", isActive); b.classList.toggle("text-purple", isActive); b.classList.toggle("shadow-sm", isActive);
    b.classList.toggle("text-body", !isActive);
  });
  adminTabButtons.forEach(b => { b.classList.toggle("hidden", b.dataset.adminGroup !== group); });
  if (adminSubtabsRow) adminSubtabsRow.classList.toggle("hidden", tabsInGroup.length <= 1);
  const targetTab = (preferredTab && tabsInGroup.includes(preferredTab)) ? preferredTab : tabsInGroup[0];
  activateAdminTab(targetTab);
}

adminGroupButtons.forEach(btn => { btn.onclick = () => activateAdminGroup(btn.dataset.adminGroup); });
adminTabButtons.forEach(btn => { btn.onclick = () => activateAdminTab(btn.dataset.adminTab); });

async function loadPaymentGatewaySettings() {
  if (!supabaseClient) return;
  try {
    const { data, error } = await supabaseClient.from("payment_gateway_settings").select("context, provider, updated_at");
    if (error) throw error;
    const appRow = (data || []).find(r => r.context === "app");
    const bookRow = (data || []).find(r => r.context === "book");
    const appSelect = document.getElementById("gatewayAppSelect");
    const bookSelect = document.getElementById("gatewayBookSelect");
    if (appSelect && appRow) appSelect.value = appRow.provider;
    if (bookSelect && bookRow) bookSelect.value = bookRow.provider;
    const meta = document.getElementById("gatewaySettingsMeta");
    const latest = (data || []).map(r => r.updated_at).filter(Boolean).sort().slice(-1)[0];
    if (meta) meta.textContent = latest ? `Last updated ${new Date(latest).toLocaleString()}` : "";
  } catch (err) { console.warn("Unable to load payment gateway settings", err); }
}

async function savePaymentGatewaySettings() {
  if (!supabaseClient) return;
  const btn = document.getElementById("saveGatewaySettings");
  const appSelect = document.getElementById("gatewayAppSelect");
  const bookSelect = document.getElementById("gatewayBookSelect");
  if (!btn || !appSelect || !bookSelect) return;
  btn.disabled = true; btn.textContent = "Saving...";
  try {
    const updates = [
      { context: "app", provider: appSelect.value, updated_at: new Date().toISOString(), updated_by: window.currentSupabaseUser?.id || null },
      { context: "book", provider: bookSelect.value, updated_at: new Date().toISOString(), updated_by: window.currentSupabaseUser?.id || null },
    ];
    const { error } = await supabaseClient.from("payment_gateway_settings").upsert(updates, { onConflict: "context" });
    if (error) throw error;
    spawnToast("Saved", "Payment gateway settings updated.", "fa-solid fa-circle-check", "success");
    loadPaymentGatewaySettings();
  } catch (err) { spawnToast("Save Failed", err.message || "Could not save settings.", "fa-solid fa-circle-exclamation", "warning"); }
  finally { btn.disabled = false; btn.textContent = "Save Changes"; }
}

const saveGatewaySettingsBtn = document.getElementById("saveGatewaySettings");
if (saveGatewaySettingsBtn) saveGatewaySettingsBtn.onclick = savePaymentGatewaySettings;

/* ========================================================
   Discount Codes Admin
======================================================== */
let _discountCodes = [];
let _restrictedUsers = {}; // discount_code_id -> [{id, email}], for display + modal pre-fill

async function loadDiscountCodes() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  const panel = document.getElementById("discountsPanel"); if (!panel) return;
  panel.innerHTML = `<p class="text-center text-xs text-muted py-10 font-bold">Loading discount codes…</p>`;
  try {
    const { data, error } = await supabaseClient.from("discount_codes").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    _discountCodes = data || [];
    _restrictedUsers = {};
    if (_discountCodes.length) {
      const { data: restrictions } = await supabaseClient
        .from("discount_code_restricted_users")
        .select("discount_code_id, user_id")
        .in("discount_code_id", _discountCodes.map(c => c.id));
      const userIds = [...new Set((restrictions || []).map(r => r.user_id))];
      let emailsById = {};
      if (userIds.length) {
        const { data: profiles } = await supabaseClient.from("profiles").select("id, email").in("id", userIds);
        (profiles || []).forEach(p => { emailsById[p.id] = p.email; });
      }
      (restrictions || []).forEach(r => {
        if (!_restrictedUsers[r.discount_code_id]) _restrictedUsers[r.discount_code_id] = [];
        _restrictedUsers[r.discount_code_id].push({ id: r.user_id, email: emailsById[r.user_id] || "Unknown user" });
      });
    }
    renderDiscountCodes();
  } catch (err) {
    panel.innerHTML = `<p class="text-center text-xs text-red-500 py-10 font-bold">Load error: ${err.message}</p>`;
  }
}

function renderDiscountCodes() {
  const panel = document.getElementById("discountsPanel"); if (!panel) return;
  if (!_discountCodes.length) {
    panel.innerHTML = `
      <div class="flex flex-col items-center gap-4 py-16 text-center">
        <div class="w-14 h-14 rounded-2xl bg-purple/10 flex items-center justify-center text-purple text-xl"><i class="fa-solid fa-tags"></i></div>
        <p class="font-bold text-title">No discount codes yet</p>
        <p class="text-sm text-muted max-w-sm">Create your first discount code to offer promos on monthly, yearly, or gallery add-on plans.</p>
        <button type="button" onclick="openDiscountCodeModal('create')" class="btn-animation bg-purple hover:bg-purple-dark text-white font-extrabold px-6 py-2.5 rounded-full text-xs uppercase"><i class="fa-solid fa-plus mr-1.5"></i> Create Code</button>
      </div>`;
    return;
  }
  panel.innerHTML = `
    <div class="bg-white border border-line rounded-3xl shadow-sm overflow-hidden">
      <div class="flex items-center justify-between px-6 py-4 border-b border-line">
        <h3 class="font-extrabold text-title">Discount Codes</h3>
        <button type="button" onclick="openDiscountCodeModal('create')" class="btn-animation bg-purple hover:bg-purple-dark text-white font-extrabold px-5 py-2 rounded-full text-xs uppercase"><i class="fa-solid fa-plus mr-1.5"></i> Create Code</button>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-line bg-grey text-[10px] uppercase tracking-widest text-muted font-black">
              <th class="text-left px-5 py-3">Code</th>
              <th class="text-left px-5 py-3">Discount</th>
              <th class="text-left px-5 py-3">Plans</th>
              <th class="text-left px-5 py-3">Restricted To</th>
              <th class="text-left px-5 py-3">Uses</th>
              <th class="text-left px-5 py-3">Expiry</th>
              <th class="text-left px-5 py-3">Status</th>
              <th class="text-left px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>${_discountCodes.map(c => {
            const appliesTo = Array.isArray(c.applies_to) && c.applies_to.length ? c.applies_to.join(", ") : "All plans";
            const restrictedUsers = _restrictedUsers[c.id] || [];
            const restrictedTo = !restrictedUsers.length ? "Everyone"
              : restrictedUsers.length <= 2 ? restrictedUsers.map(u => u.email).join(", ")
              : `${restrictedUsers.length} users`;
            const uses = c.max_uses !== null && c.max_uses !== undefined ? `${c.uses_count}/${c.max_uses}` : `${c.uses_count} / ∞`;
            const expiry = c.valid_until ? new Date(c.valid_until).toLocaleDateString("en-PH") : "No expiry";
            const discount = c.discount_type === "percent" ? `${c.discount_value}% off` : `₱${c.discount_value} off`;
            const statusCls = c.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700";
            return `<tr class="border-b border-line last:border-0 hover:bg-grey/50">
              <td class="px-5 py-3.5"><span class="font-mono font-black text-title text-xs">${c.code}</span></td>
              <td class="px-5 py-3.5 font-semibold text-purple text-sm">${discount}</td>
              <td class="px-5 py-3.5 text-body text-xs">${appliesTo}</td>
              <td class="px-5 py-3.5 text-body text-xs">${restrictedTo}</td>
              <td class="px-5 py-3.5 font-mono text-xs">${uses}</td>
              <td class="px-5 py-3.5 text-xs text-muted">${expiry}</td>
              <td class="px-5 py-3.5"><span class="rounded-full px-2.5 py-1 text-[10px] font-black ${statusCls}">${c.is_active ? "Active" : "Inactive"}</span></td>
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <button onclick="openDiscountCodeModal('edit','${c.id}')" class="text-xs font-bold text-purple hover:underline">Edit</button>
                  <button onclick="toggleDiscountCode('${c.id}',${!c.is_active})" class="text-xs font-bold text-muted hover:underline">${c.is_active ? "Deactivate" : "Activate"}</button>
                  <button onclick="deleteDiscountCode('${c.id}')" class="text-xs font-bold text-red-500 hover:underline">Delete</button>
                </div>
              </td>
            </tr>`;
          }).join("")}</tbody>
        </table>
      </div>
    </div>`;
}

async function toggleDiscountCode(id, newState) {
  if (!supabaseClient) return;
  try {
    const { error } = await supabaseClient.from("discount_codes").update({ is_active: newState }).eq("id", id);
    if (error) throw error;
    spawnToast("Updated", `Code ${newState ? "activated" : "deactivated"}.`, "fa-solid fa-circle-check", "success");
    loadDiscountCodes();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); }
}

async function deleteDiscountCode(id) {
  if (!supabaseClient) return;
  if (!confirm("Permanently delete this discount code?")) return;
  try {
    const { error } = await supabaseClient.from("discount_codes").delete().eq("id", id);
    if (error) throw error;
    spawnToast("Deleted", "Discount code removed.", "fa-solid fa-circle-check", "success");
    loadDiscountCodes();
  } catch (err) { spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning"); }
}

function openDiscountCodeModal(mode, id) {
  const existing = id ? _discountCodes.find(c => c.id === id) : null;
  document.getElementById("discountCodeModal")?.remove();
  const planOptions = ["monthly", "yearly", "plus", "business"].map(p =>
    `<label class="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" name="dcPlan" value="${p}" ${existing?.applies_to?.includes(p) ? "checked" : ""} class="rounded accent-purple"/>
      <span class="capitalize">${p}</span>
    </label>`
  ).join("");
  const modal = document.createElement("div");
  modal.id = "discountCodeModal";
  modal.className = "fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4";
  modal.innerHTML = `
    <div class="w-full max-w-lg bg-white border border-line rounded-3xl shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
      <div class="flex items-start justify-between px-6 pt-6 pb-4 border-b border-line">
        <div>
          <h3 class="text-lg font-black text-title">${mode === "edit" ? "Edit Discount Code" : "Create Discount Code"}</h3>
          <p class="text-xs text-muted mt-0.5">Codes are stored and matched in uppercase.</p>
        </div>
        <button onclick="document.getElementById('discountCodeModal').remove()" class="w-9 h-9 border border-line rounded-full flex items-center justify-center hover:bg-grey text-body text-lg leading-none">&times;</button>
      </div>
      <div class="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Code</label>
            <input id="dcCode" type="text" value="${existing?.code || ""}" placeholder="e.g. SAVE20" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:border-purple outline-none"/>
          </div>
          <div>
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Discount Type</label>
            <select id="dcType" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none">
              <option value="percent" ${!existing || existing.discount_type === "percent" ? "selected" : ""}>Percent off</option>
              <option value="fixed_php" ${existing?.discount_type === "fixed_php" ? "selected" : ""}>Fixed PHP amount off</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Value</label>
            <input id="dcValue" type="number" min="0" value="${existing?.discount_value ?? ""}" placeholder="e.g. 20" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none"/>
            <p class="text-[10px] text-muted mt-1">Percent: 0–100. Fixed: PHP amount.</p>
          </div>
          <div>
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Max Uses (blank = unlimited)</label>
            <input id="dcMaxUses" type="number" min="1" value="${existing?.max_uses ?? ""}" placeholder="Unlimited" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none"/>
          </div>
          <div>
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Expiry Date (optional)</label>
            <input id="dcExpiry" type="date" value="${existing?.valid_until ? existing.valid_until.slice(0,10) : ""}" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none"/>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Stripe Coupon ID (optional)</label>
            <input id="dcStripeCoupon" type="text" value="${existing?.stripe_coupon_id || ""}" placeholder="e.g. promo_abc123" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm font-mono focus:border-purple outline-none"/>
            <p class="text-[10px] text-muted mt-1">Links this code to a Stripe coupon for Stripe-hosted checkout.</p>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Restrict to specific users (optional)</label>
            <textarea id="dcRestrictedEmails" rows="2" placeholder="e.g. operator@example.com, another@example.com" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none resize-none">${(existing ? (_restrictedUsers[existing.id] || []).map(u => u.email) : []).join(", ")}</textarea>
            <p class="text-[10px] text-muted mt-1">Comma or newline separated. Leave blank for anyone to use. Regardless of this setting, once a given user redeems this code they can't use it again.</p>
          </div>
          <div class="col-span-2">
            <label class="block text-xs font-black text-title mb-2 uppercase tracking-wide">Applies to (blank = all plans)</label>
            <div class="grid grid-cols-4 gap-3">${planOptions}</div>
          </div>
        </div>
        <p class="text-xs text-red-500 font-bold hidden" id="dcError"></p>
      </div>
      <div class="flex gap-3 px-6 py-4 border-t border-line">
        <button type="button" onclick="document.getElementById('discountCodeModal').remove()" class="flex-1 border border-line rounded-full py-2.5 text-sm font-black text-body hover:bg-grey">Cancel</button>
        <button type="button" onclick="saveDiscountCode('${mode}','${id || ''}')" class="flex-1 btn-animation bg-purple hover:bg-purple-dark text-white font-black rounded-full py-2.5 text-sm">${mode === "edit" ? "Save Changes" : "Create Code"}</button>
      </div>
    </div>`;
  modal.onclick = () => modal.remove();
  document.body.appendChild(modal);
}

async function saveDiscountCode(mode, id) {
  if (!supabaseClient) return;
  const code = document.getElementById("dcCode")?.value?.trim().toUpperCase();
  const discountType = document.getElementById("dcType")?.value;
  const discountValue = parseFloat(document.getElementById("dcValue")?.value);
  const maxUses = document.getElementById("dcMaxUses")?.value?.trim();
  const expiry = document.getElementById("dcExpiry")?.value?.trim();
  const stripeCouponId = document.getElementById("dcStripeCoupon")?.value?.trim();
  const restrictedEmails = (document.getElementById("dcRestrictedEmails")?.value || "").split(/[,\n]/).map(e => e.trim()).filter(Boolean);
  const appliesTo = Array.from(document.querySelectorAll("input[name='dcPlan']:checked")).map(el => el.value);
  const errEl = document.getElementById("dcError");
  if (!code) { errEl.textContent = "Code is required."; errEl.classList.remove("hidden"); return; }
  if (isNaN(discountValue) || discountValue < 0) { errEl.textContent = "Enter a valid discount value."; errEl.classList.remove("hidden"); return; }
  if (discountType === "percent" && discountValue > 100) { errEl.textContent = "Percent discount cannot exceed 100."; errEl.classList.remove("hidden"); return; }
  let restrictedUserIds = [];
  if (restrictedEmails.length) {
    const { data: restrictedProfiles, error: lookupErr } = await supabaseClient.from("profiles").select("id, email").in("email", restrictedEmails);
    if (lookupErr) { errEl.textContent = lookupErr.message; errEl.classList.remove("hidden"); return; }
    const foundEmails = (restrictedProfiles || []).map(p => p.email);
    const missing = restrictedEmails.filter(e => !foundEmails.includes(e));
    if (missing.length) { errEl.textContent = `No user found with email: ${missing.join(", ")}`; errEl.classList.remove("hidden"); return; }
    restrictedUserIds = restrictedProfiles.map(p => p.id);
  }
  errEl.classList.add("hidden");
  const payload = { code, discount_type: discountType, discount_value: discountValue, applies_to: appliesTo, max_uses: maxUses ? parseInt(maxUses, 10) : null, valid_until: expiry ? new Date(expiry + "T23:59:59").toISOString() : null, stripe_coupon_id: stripeCouponId || null };
  try {
    let codeId = id;
    if (mode === "edit" && id) {
      const { error } = await supabaseClient.from("discount_codes").update(payload).eq("id", id);
      if (error) throw error;
      spawnToast("Saved", "Discount code updated.", "fa-solid fa-circle-check", "success");
    } else {
      const { data: created, error } = await supabaseClient.from("discount_codes").insert({ ...payload, is_active: true }).select("id").single();
      if (error) throw error;
      codeId = created.id;
      spawnToast("Created", `Code "${code}" created.`, "fa-solid fa-circle-check", "success");
    }
    // Replace the restricted-user set wholesale rather than diffing --
    // code lists here are short and this keeps the logic simple.
    await supabaseClient.from("discount_code_restricted_users").delete().eq("discount_code_id", codeId);
    if (restrictedUserIds.length) {
      await supabaseClient.from("discount_code_restricted_users").insert(restrictedUserIds.map(uid => ({ discount_code_id: codeId, user_id: uid })));
    }
    document.getElementById("discountCodeModal")?.remove();
    loadDiscountCodes();
  } catch (err) { errEl.textContent = err.message; errEl.classList.remove("hidden"); }
}

// ===================================================================
// Admin: Manual Subscription Grant
// ===================================================================
// Lets an admin set a user's plan/expiry directly, without them going
// through a payment gateway -- e.g. comping an account or fixing up a
// subscription after a support issue. Mirrors what reviewProof() already
// does for GCash proof approvals, generalized to any user found by email.
// The licenses table's own lock_expires_at_to_period_end trigger derives
// expires_at/watermark/max_events/templates/priority_support from just
// plan + current_period_end, so this only needs to submit those two
// (plus state) -- no need to duplicate that tier-limit logic here.

async function loadManualSubPanel() {
  const panel = document.getElementById("manualSubPanel"); if (!panel) return;
  panel.innerHTML = `
    <div class="bg-white border border-line rounded-3xl shadow-sm p-6 space-y-4">
      <div>
        <h3 class="font-extrabold text-title">Manual Subscription Grant</h3>
        <p class="text-xs text-muted mt-1">Look up a user by email to view or set their plan directly.</p>
      </div>
      <div class="flex gap-3">
        <input id="manualSubEmail" type="email" placeholder="user@example.com" class="flex-1 border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none" />
        <button type="button" onclick="lookupUserForGrant()" class="btn-animation bg-purple hover:bg-purple-dark text-white font-extrabold px-5 py-2.5 rounded-full text-xs uppercase">Look Up</button>
      </div>
      <div id="manualSubResult"></div>
    </div>`;
}

async function lookupUserForGrant() {
  const email = document.getElementById("manualSubEmail")?.value?.trim();
  const resultEl = document.getElementById("manualSubResult");
  if (!email || !resultEl) return;
  resultEl.innerHTML = `<p class="text-xs text-muted font-bold py-4">Looking up...</p>`;
  try {
    const { data: profile, error: profileErr } = await supabaseClient.from("profiles").select("id, email, full_name").eq("email", email).maybeSingle();
    if (profileErr) throw profileErr;
    if (!profile) { resultEl.innerHTML = `<p class="text-xs text-red-500 font-bold py-4">No user found with that email.</p>`; return; }
    const { data: license } = await supabaseClient.from("licenses").select("plan, state, current_period_end, gallery_tier, gallery_addon").eq("user_id", profile.id).maybeSingle();

    const current = license
      ? `Currently: <strong class="text-title">${formatStatus(license.plan)}</strong> (${formatStatus(license.state)})${license.current_period_end ? `, through ${new Date(license.current_period_end).toLocaleDateString("en-PH")}` : ""}`
      : `No subscription on file for this user yet.`;
    const currentGallery = `Gallery: <strong class="text-title">${formatStatus(license?.gallery_tier || "free")}</strong>`;

    resultEl.innerHTML = `
      <div class="border-t border-line pt-4 mt-2 space-y-6">
        <p class="text-sm text-body"><strong class="text-title">${profile.full_name || profile.email}</strong> — ${profile.email}</p>

        <div class="space-y-4">
          <div>
            <h4 class="text-xs font-black text-title uppercase tracking-wide">Pro Plan</h4>
            <p class="text-xs text-muted mt-0.5">${current}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Plan</label>
              <select id="grantPlan" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none">
                <option value="free" ${!license || license.plan === "free" ? "selected" : ""}>Free</option>
                <option value="trial" ${license?.plan === "trial" ? "selected" : ""}>Trial</option>
                <option value="pro_monthly" ${license?.plan === "pro_monthly" ? "selected" : ""}>Pro Monthly</option>
                <option value="pro_yearly" ${license?.plan === "pro_yearly" ? "selected" : ""}>Pro Yearly</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Period End (blank = no expiry)</label>
              <input id="grantPeriodEnd" type="date" value="${license?.current_period_end ? license.current_period_end.slice(0, 10) : ""}" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none" />
            </div>
          </div>
          <p class="text-xs text-red-500 font-bold hidden" id="grantError"></p>
          <button type="button" onclick="grantManualSubscription('${profile.id}')" class="btn-animation w-full bg-purple hover:bg-purple-dark text-white font-black rounded-full py-2.5 text-sm">Grant / Update Subscription</button>
        </div>

        <div class="space-y-4 border-t border-line pt-6">
          <div>
            <h4 class="text-xs font-black text-title uppercase tracking-wide">Gallery Add-on</h4>
            <p class="text-xs text-muted mt-0.5">${currentGallery}</p>
          </div>
          <div>
            <label class="block text-xs font-black text-title mb-1.5 uppercase tracking-wide">Gallery Tier</label>
            <select id="grantGalleryTier" class="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:border-purple outline-none">
              <option value="free" ${!license || license.gallery_tier === "free" ? "selected" : ""}>Free</option>
              <option value="plus" ${license?.gallery_tier === "plus" ? "selected" : ""}>Plus</option>
              <option value="business" ${license?.gallery_tier === "business" ? "selected" : ""}>Business</option>
            </select>
          </div>
          <p class="text-xs text-red-500 font-bold hidden" id="grantGalleryError"></p>
          <button type="button" onclick="grantGalleryAccess('${profile.id}')" class="btn-animation w-full bg-purple hover:bg-purple-dark text-white font-black rounded-full py-2.5 text-sm">Grant / Update Gallery Access</button>
        </div>
      </div>`;
  } catch (err) {
    resultEl.innerHTML = `<p class="text-xs text-red-500 font-bold py-4">Lookup error: ${err.message}</p>`;
  }
}

async function grantManualSubscription(userId) {
  if (!supabaseClient) return;
  const plan = document.getElementById("grantPlan")?.value;
  const periodEnd = document.getElementById("grantPeriodEnd")?.value?.trim();
  const errEl = document.getElementById("grantError");
  try {
    const { error } = await supabaseClient.from("licenses").upsert(
      { user_id: userId, plan, current_period_end: periodEnd ? new Date(periodEnd + "T23:59:59").toISOString() : null, state: "active" },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    spawnToast("Subscription Updated", "The user's plan has been granted.", "fa-solid fa-circle-check", "success");
    lookupUserForGrant();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove("hidden"); }
    else spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning");
  }
}

async function grantGalleryAccess(userId) {
  if (!supabaseClient) return;
  const galleryTier = document.getElementById("grantGalleryTier")?.value;
  const errEl = document.getElementById("grantGalleryError");
  try {
    const { error } = await supabaseClient.from("licenses").upsert(
      { user_id: userId, gallery_tier: galleryTier, gallery_addon: galleryTier !== "free" },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    spawnToast("Gallery Access Updated", "The user's gallery tier has been granted.", "fa-solid fa-circle-check", "success");
    lookupUserForGrant();
  } catch (err) {
    if (errEl) { errEl.textContent = err.message; errEl.classList.remove("hidden"); }
    else spawnToast("Failed", err.message, "fa-solid fa-circle-exclamation", "warning");
  }
}

filterButtons.forEach(btn => {
  btn.onclick = () => {
    activeFilter = btn.dataset.filter;
    filterButtons.forEach(b => { b.classList.remove("active", "bg-purple", "text-white"); b.classList.add("bg-white", "text-title"); });
    btn.classList.add("active", "bg-purple", "text-white"); btn.classList.remove("bg-white", "text-title"); renderBookings();
  };
});

proofFilterButtons.forEach(btn => {
  btn.onclick = () => {
    activeProofFilter = btn.dataset.proofFilter;
    proofFilterButtons.forEach(b => { b.classList.remove("active", "bg-purple", "text-white"); b.classList.add("bg-white", "text-title"); });
    btn.classList.add("active", "bg-purple", "text-white"); btn.classList.remove("bg-white", "text-title"); renderProofs();
  };
});

const inboxFilterButtons = document.querySelectorAll("[data-inbox-filter]");
inboxFilterButtons.forEach(btn => {
  btn.onclick = () => {
    activeInboxFilter = btn.dataset.inboxFilter;
    // Each button keeps its own color (grey/red/purple) permanently -- a ring
    // marks which is selected instead of overwriting bg/text, since swapping
    // in a flat purple fill clashed with the DPO button's intentional red.
    inboxFilterButtons.forEach(b => b.classList.remove("active", "ring-2", "ring-offset-1", "ring-purple"));
    btn.classList.add("active", "ring-2", "ring-offset-1", "ring-purple");
    renderInboxEmails();
  };
});

const privacyFilterButtons = document.querySelectorAll("[data-privacy-filter]");
privacyFilterButtons.forEach(btn => {
  btn.onclick = () => {
    activePrivacyFilter = btn.dataset.privacyFilter;
    privacyFilterButtons.forEach(b => { b.classList.remove("active", "bg-purple", "text-white"); b.classList.add("bg-white", "text-title"); });
    btn.classList.add("active", "bg-purple", "text-white"); btn.classList.remove("bg-white", "text-title"); renderPrivacyRequestsAdmin();
  };
});

if (refreshBookings) {
  refreshBookings.onclick = async () => {
    const icon = refreshBookings.querySelector("i");
    refreshBookings.disabled = true; icon?.classList.add("fa-spin");
    try { await loadActiveAdminTab(); }
    finally { refreshBookings.disabled = false; icon?.classList.remove("fa-spin"); }
  };
}

document.getElementById("loginOpen").onclick = () => openAuthModal();
document.getElementById("gcashProofForm").onsubmit = handleGcashProofSubmit;
const publicReviewForm = document.getElementById("publicReviewForm");
if (publicReviewForm) publicReviewForm.onsubmit = handleReviewSubmit;

authForm.onsubmit = async (event) => {
  event.preventDefault(); if (!supabaseClient) return;
  const email = document.getElementById("authEmail").value.trim(); const password = authPassword.value; const name = authName.value.trim();
  authSubmit.disabled = true; setAuthMessage(authMode === "signup" ? "Creating free account..." : "Signing in secure console...");
  try {
    if (authMode === "signup") {
      const { data, error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: name } } }); if (error) throw error;
      if (data?.user?.id) {
        const { error: profileErr } = await supabaseClient.from("profiles").upsert({ id: data.user.id, full_name: name, email, subscription_plan: "free" });
        if (profileErr) console.warn("Profile row creation failed on signup (non-fatal, account still created):", profileErr);
      }
      // New accounts need the desktop app, so send them straight to the
      // download page next -- the natural next step after signing up.
      setAuthMessage("Signup confirmed. Taking you to the download page...", false); spawnToast("Signup Successful", "Let's get the app installed.", "fa-solid fa-circle-check", "success");
      setTimeout(() => { closeAuthModal(); navigateTo("download"); }, 1500);
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); if (error) throw error;
      setAuthMessage("Access verified.", false); spawnToast("Welcome Back", "Session established securely.", "fa-solid fa-circle-check", "success"); setTimeout(closeAuthModal, 1200);
    }
  } catch (err) { setAuthMessage(err.message || "Credential validation failed.", true); }
  finally { authSubmit.disabled = false; }
};

logoutAction.onclick = async () => {
  if (!supabaseClient) return;
  try { await supabaseClient.auth.signOut(); spawnToast("Signed Out", "Session cleared successfully.", "fa-solid fa-door-open", "info"); navigateTo('home'); } catch (err) { console.warn(err); }
};

if (calendarPrev) { calendarPrev.onclick = () => { visibleBookingMonth.setMonth(visibleBookingMonth.getMonth() - 1); renderBookingCalendar(); }; }
if (calendarNext) { calendarNext.onclick = () => { visibleBookingMonth.setMonth(visibleBookingMonth.getMonth() + 1); renderBookingCalendar(); }; }

document.getElementById("profileForm")?.addEventListener("submit", async (e) => {
  e.preventDefault(); if (!supabaseClient || !window.currentSupabaseUser) return;
  spawnToast("Saving Profile", "Updating information logs...", "fa-solid fa-spinner", "info");
  const full_name = document.getElementById("profileFullName").value.trim(); const company = document.getElementById("profileCompany").value.trim(); const phone = document.getElementById("profilePhone").value.trim();
  try { const { error } = await supabaseClient.from("profiles").upsert({ id: window.currentSupabaseUser.id, full_name, company, phone, email: window.currentSupabaseUser.email }); if (error) throw error; spawnToast("Profile Saved", "Updates saved cleanly.", "fa-solid fa-circle-check", "success"); loadAccountState(window.currentSupabaseUser); }
  catch (err) { spawnToast("Failed", err.message, "fa-solid fa-exclamation", "warning"); }
});

document.getElementById("avatarInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0]; if (!file || !supabaseClient || !window.currentSupabaseUser) return;
  spawnToast("Uploading Avatar", "Uploading target photo to storage bucket...", "fa-solid fa-spinner", "info");
  const ext = file.name.split(".").pop(); const path = `${window.currentSupabaseUser.id}/avatar.${ext}`;
  try {
    const { error: uploadError } = await supabaseClient.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" }); if (uploadError) throw uploadError;
    const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path); const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
    // upsert (not update) so this still works even if the user's profile
    // row hasn't been created yet; .select().single() forces a visible
    // error instead of a silent no-op if RLS ever blocks the write again.
    const { error: updateError } = await supabaseClient.from("profiles").upsert({ id: window.currentSupabaseUser.id, avatar_url: publicUrl }).select().single(); if (updateError) throw updateError;
    if (currentProfile) currentProfile.avatar_url = publicUrl;
    renderAvatar(document.getElementById("avatarPreview"), publicUrl);
    renderAvatar(document.getElementById("navAvatar"), publicUrl);
    spawnToast("Upload Complete", "Avatar updated successfully.", "fa-solid fa-image", "success");
  } catch (err) { const reason = err?.message || err?.error_description || "Unknown storage error."; console.error("Avatar upload failed:", err); spawnToast("Upload Failed", reason, "fa-solid fa-exclamation-triangle", "warning"); }
});

// ===================================================================
// Account: Delete Account (Data Privacy Act of 2012 / RA 10173 erasure right)
// ===================================================================
function openDeleteAccountModal() {
  const modal = document.getElementById("deleteAccountModal");
  const input = document.getElementById("deleteAccountConfirmInput");
  const btn = document.getElementById("deleteAccountConfirmBtn");
  document.getElementById("deleteAccountMessage").textContent = "";
  if (input) input.value = "";
  if (btn) btn.disabled = true;
  modal.classList.remove("hidden"); modal.classList.add("grid"); modal.setAttribute("aria-hidden", "false");
}

function closeDeleteAccountModal() {
  const modal = document.getElementById("deleteAccountModal");
  modal.classList.add("hidden"); modal.classList.remove("grid"); modal.setAttribute("aria-hidden", "true");
}

document.getElementById("deleteAccountConfirmInput")?.addEventListener("input", (e) => {
  const btn = document.getElementById("deleteAccountConfirmBtn");
  if (btn) btn.disabled = e.target.value.trim() !== "DELETE";
});

async function confirmDeleteAccount() {
  if (!supabaseClient || !window.currentSupabaseUser) return;
  const btn = document.getElementById("deleteAccountConfirmBtn");
  const message = document.getElementById("deleteAccountMessage");
  btn.disabled = true; btn.textContent = "Deleting...";
  message.className = "text-center text-xs font-bold mt-3 text-body"; message.textContent = "Deleting your account -- this may take a few seconds.";
  try {
    const { data, error } = await supabaseClient.functions.invoke("delete-account", { body: {} });
    if (error) throw await resolveFunctionError(error);
    if (data?.error) throw new Error(data.error);
    closeDeleteAccountModal();
    spawnToast("Account Deleted", "Your account and personal data have been permanently removed.", "fa-solid fa-circle-check", "success");
    await supabaseClient.auth.signOut();
    window.currentSupabaseUser = null; currentProfile = null; currentLicense = null;
    navigateTo("home");
  } catch (err) {
    console.error("Account deletion failed:", err);
    message.className = "text-center text-xs font-bold mt-3 text-red-600"; message.textContent = err.message || "Could not delete your account. Please try again or contact dpo@studiophotuna.com.";
    btn.disabled = false; btn.textContent = "Permanently Delete My Account";
  }
}

document.getElementById("passwordForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const cur = document.getElementById("currentPassword").value; const nPass = document.getElementById("newPassword").value; const confirm = document.getElementById("confirmPassword").value;
  if (nPass !== confirm) { spawnToast("Mismatch", "New password options do not match.", "fa-solid fa-exclamation", "warning"); return; }
  spawnToast("Modifying password", "Authorizing credential updates...", "fa-solid fa-key", "info");
  try { const { error } = await supabaseClient.auth.updateUser({ password: nPass }); if (error) throw error; spawnToast("Password Updated", "System credentials rewritten successfully.", "fa-solid fa-lock", "success"); document.getElementById("passwordForm").reset(); }
  catch (err) { spawnToast("Update failed", err.message, "fa-solid fa-triangle-exclamation", "warning"); }
});

// ===================================================================
// Scroll Reveal Observer
// ===================================================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in-view");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
document.querySelectorAll(".reveal, .feature-card").forEach(el => revealObserver.observe(el));

// ===================================================================
// Statement panel: drives --flood (0..1) from the section's position in
// the viewport, so the panel's clipped top edge opens out to full-bleed
// as it scrolls in. All the interpolation lives in the CSS (see
// .flood-panel in head.html) -- this only publishes the progress value.
// Skipped entirely when the visitor prefers reduced motion; the CSS
// media query already paints the finished state in that case.
// ===================================================================
(function initStatementPanelFlood() {
  const panel = document.getElementById("statementPanel");
  if (!panel) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let ticking = false;

  function update() {
    ticking = false;
    const rect = panel.getBoundingClientRect();
    // Fully open by the time the panel's top edge reaches the middle of
    // the viewport; untouched while it's still below the fold.
    const start = window.innerHeight;
    const end = window.innerHeight * 0.5;
    const progress = (start - rect.top) / (start - end);
    panel.style.setProperty("--flood", String(Math.min(1, Math.max(0, progress))));
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();
})();

// ===================================================================
// Booth Flow: full-page numbered steps, scroll-driven crossfade (desktop +
// motion-ok only). Falls back to the panels' natural stacked document flow
// everywhere else -- no JS required for that state, it's the default markup.
// ===================================================================
(function initBoothFlowScrollHijack() {
  const track = document.getElementById("boothFlowTrack");
  const sticky = document.getElementById("boothFlowSticky");
  const panelsWrap = document.getElementById("boothFlowPanels");
  const navWrap = document.getElementById("boothFlowNavWrap");
  const panels = panelsWrap ? Array.from(panelsWrap.querySelectorAll(".flow-step-panel")) : [];
  const dots = Array.from(document.querySelectorAll(".flow-step-dot"));
  if (!track || !sticky || !panelsWrap || panels.length === 0) return;

  const desktopQuery = window.matchMedia("(min-width: 1024px)");
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const STICKY_TOP = 96; // px -- matches the `top-24` class on #boothFlowSticky
  const numSteps = panels.length;
  let active = false;
  let perStepDistance = 0;
  let maxScroll = 0;
  let ticking = false;

  function setActiveIndex(index) {
    panels.forEach((p, i) => {
      p.style.opacity = i === index ? "1" : "0";
      p.style.pointerEvents = i === index ? "auto" : "none";
    });
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }

  function updatePosition() {
    ticking = false;
    if (!active) return;
    const rawScrolled = -track.getBoundingClientRect().top - STICKY_TOP;
    const progress = maxScroll > 0 ? Math.min(1, Math.max(0, rawScrolled / maxScroll)) : 0;
    setActiveIndex(Math.round(progress * (numSteps - 1)));
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(updatePosition); }
  }

  function activate() {
    // Always start measuring from a clean, normal-flow state so resizes
    // re-measure real content height instead of an already-stretched box.
    panelsWrap.style.height = "";
    panels.forEach(p => { p.style.position = ""; p.style.inset = ""; p.style.transition = ""; p.style.opacity = ""; p.style.pointerEvents = ""; });

    const panelHeight = Math.max.apply(null, panels.map(p => p.getBoundingClientRect().height));
    panelsWrap.style.height = panelHeight + "px";
    panels.forEach(p => { p.style.position = "absolute"; p.style.inset = "0"; p.style.transition = "opacity 0.35s ease"; });

    // Fixed, viewport-independent distance -- scaling this off viewport
    // height made the whole journey noticeably longer on larger/taller
    // screens, which is exactly where this feature is most likely seen.
    perStepDistance = 160;
    maxScroll = perStepDistance * (numSteps - 1);
    if (navWrap) navWrap.classList.remove("hidden");
    track.style.height = (sticky.offsetHeight + STICKY_TOP + maxScroll) + "px";

    active = true;
    updatePosition();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function deactivate() {
    if (!active) return;
    active = false;
    track.style.height = "";
    panelsWrap.style.height = "";
    panels.forEach(p => { p.style.position = ""; p.style.inset = ""; p.style.opacity = ""; p.style.pointerEvents = ""; p.style.transition = ""; });
    dots.forEach(d => d.classList.remove("active"));
    if (navWrap) navWrap.classList.add("hidden");
    window.removeEventListener("scroll", onScroll);
  }

  function evaluate() {
    if (desktopQuery.matches && !motionQuery.matches) activate();
    else deactivate();
  }

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      if (!active) return;
      const trackTop = track.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: trackTop + STICKY_TOP + (i * perStepDistance) + 1, behavior: "smooth" });
    });
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(evaluate, 150);
  });
  desktopQuery.addEventListener("change", evaluate);
  motionQuery.addEventListener("change", evaluate);
  window.addEventListener("load", () => { if (active) activate(); });

  // Tailwind's CDN JIT injects its generated stylesheet a tick after this
  // script runs, so panels can briefly still be unstyled if we measure
  // immediately -- wait until they have real layout height before trusting
  // any measurement.
  let waitFrames = 0;
  (function waitForLayout() {
    if (panels[0].getBoundingClientRect().height > 0 || waitFrames > 60) {
      evaluate();
    } else {
      waitFrames++;
      requestAnimationFrame(waitForLayout);
    }
  })();
})();

// ===================================================================
// Invoice Generation (on payment proof approval)
// ===================================================================
async function generateInvoice(proofId) {
  if (!supabaseClient) return;
  try {
    const { data: proof, error: proofErr } = await supabaseClient.from("payment_proofs").select("*").eq("id", proofId).maybeSingle();
    if (proofErr || !proof) { spawnToast("Invoice Error", "Could not load proof details.", "fa-solid fa-circle-exclamation", "warning"); return; }
    // Fetch user profile for customer info
    let customerName = proof.gcash_sender_name || "Customer";
    let customerEmail = "";
    if (proof.user_id) {
      const { data: profile } = await supabaseClient.from("profiles").select("full_name, email, company, phone").eq("id", proof.user_id).maybeSingle();
      if (profile) { customerName = profile.full_name || customerName; customerEmail = profile.email || ""; }
    }
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${proofId.substring(0, 6).toUpperCase()}`;
    const invoiceDate = new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
    const approvedDate = proof.reviewed_at ? new Date(proof.reviewed_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : invoiceDate;
    const planLabel = (() => {
      const b = String(proof.billing || "");
      if (b.startsWith("gallery_")) {
        const tier = b.slice("gallery_".length);
        return `Studio Photuna Gallery (${tier.charAt(0).toUpperCase() + tier.slice(1)})`;
      }
      return b === "yearly" ? "Studio Photuna Pro (Yearly)" : "Studio Photuna Pro (Monthly)";
    })();
    const amount = Number(proof.amount_php || 0);
    // Generate printable invoice window
    const invoiceHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ${invoiceNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',system-ui,sans-serif;color:#111827;padding:48px;max-width:800px;margin:0 auto;font-size:14px}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px;padding-bottom:24px;border-bottom:2px solid #0c66e4}
  .logo{font-size:28px;font-weight:900;color:#111827;line-height:1}
  .logo small{font-size:10px;color:#5f6678;font-weight:600;display:block;margin-top:4px;letter-spacing:1px;text-transform:uppercase}
  .invoice-title{text-align:right}
  .invoice-title h1{font-size:32px;font-weight:900;color:#0c66e4;text-transform:uppercase;letter-spacing:2px}
  .invoice-title p{font-size:12px;color:#5f6678;margin-top:4px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px}
  .info-block h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:#8b92a6;margin-bottom:8px}
  .info-block p{font-size:13px;line-height:1.6;color:#111827}
  table{width:100%;border-collapse:collapse;margin-bottom:32px}
  thead th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#8b92a6;padding:12px 16px;border-bottom:2px solid #dedfe6}
  tbody td{padding:16px;font-size:13px;border-bottom:1px solid #f4f5f8}
  tbody td:last-child{text-align:right;font-weight:700}
  thead th:last-child{text-align:right}
  .total-row{background:#f4f5f8;border-radius:12px}
  .total-row td{font-size:16px;font-weight:900;color:#111827;border:none;padding:16px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid #dedfe6;text-align:center;color:#8b92a6;font-size:11px;line-height:1.8}
  .badge{display:inline-block;background:#22c55e;color:white;font-size:10px;font-weight:700;padding:4px 12px;border-radius:999px;text-transform:uppercase;letter-spacing:1px}
  @media print{body{padding:24px}button{display:none!important}}
</style></head><body>
  <div class="header">
    <div class="logo">studio<br>photuna.<small>Photobooth Software</small></div>
    <div class="invoice-title"><h1>Invoice</h1><p>${invoiceNumber}</p></div>
  </div>
  <div class="info-grid">
    <div class="info-block"><h3>Bill To</h3><p><strong>${customerName}</strong>${customerEmail ? "<br>" + customerEmail : ""}</p></div>
    <div class="info-block" style="text-align:right"><h3>Invoice Details</h3><p>Date: ${invoiceDate}<br>Status: <span class="badge">Paid</span><br>Payment: GCash<br>Ref #: ${proof.gcash_reference_number}</p></div>
  </div>
  <table><thead><tr><th>Description</th><th>Qty</th><th>Amount</th></tr></thead>
  <tbody><tr><td>${planLabel}<br><span style="font-size:11px;color:#5f6678">${String(proof.billing || "").startsWith("gallery_") ? "Gallery add-on — billed monthly" : `Subscription license — ${proof.billing === "yearly" ? "12 months" : "1 month"} access`}</span></td><td>1</td><td>&#8369;${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr></tbody>
  <tfoot><tr class="total-row"><td colspan="2">Total Paid</td><td style="text-align:right;font-size:18px">&#8369;${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td></tr></tfoot></table>
  <div class="footer">
    <p><strong>Studio Photuna</strong></p>
    <p>This invoice was generated automatically upon payment verification.</p>
    <p>For questions, contact support@studiophotuna.com</p>
    <br><button onclick="window.print()" style="background:#0c66e4;color:white;border:none;padding:10px 24px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer">Print / Save as PDF</button>
  </div>
</body></html>`;
    const invoiceWindow = window.open("", "_blank", "width=850,height=1100");
    if (invoiceWindow) { invoiceWindow.document.write(invoiceHTML); invoiceWindow.document.close(); }
    else { spawnToast("Popup Blocked", "Please allow popups to view the invoice.", "fa-solid fa-circle-exclamation", "warning"); }
  } catch (err) { spawnToast("Invoice Error", err.message, "fa-solid fa-circle-exclamation", "warning"); }
}
