const statusBanner = document.getElementById("authStatus");
const authCard = document.querySelector(".auth-card");
const googleButton = document.getElementById("googleSsoButton");
const switchModeButton = document.getElementById("switchModeButton");
const formTitle = document.getElementById("formTitle");
const formHint = document.getElementById("formHint");
const sublineText = document.getElementById("sublineText");
const promoTitle = document.getElementById("promoTitle");
const promoText = document.getElementById("promoText");
const forgotButton = document.getElementById("forgotButton");
const fullNameField = document.getElementById("fullNameField");
const emailForm = document.getElementById("emailForm");
const submitButton = document.getElementById("submitButton");

let mode = "signin";
let isAnimating = false;
const TRANSITION_MS = 800;
const CONTENT_SWAP_MS = 220;
const PAGE_TRANSITION_MS = 180;
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function setLayoutMode(nextMode) {
  document.body.classList.toggle("is-signup", nextMode === "signup");
}

function setContentMode(nextMode) {
  mode = nextMode;
  const isSignUp = nextMode === "signup";

  if (formTitle) {
    formTitle.textContent = isSignUp ? "Create Account" : "Sign In";
  }
  if (formHint) {
    formHint.hidden = isSignUp;
    formHint.textContent = "Use your account or continue with Google.";
  }
  if (sublineText) {
    sublineText.textContent = isSignUp
      ? "or sign up quickly using Google"
      : "or use your email account";
  }
  if (promoTitle) {
    promoTitle.textContent = isSignUp ? "Welcome Back!" : "Hey There!";
  }
  if (promoText) {
    promoText.textContent = isSignUp
      ? "To stay connected, sign in with your personal details."
      : "Begin your learning journey by creating an account with Peerly today.";
  }
  if (switchModeButton) {
    switchModeButton.textContent = isSignUp ? "Sign In" : "Sign Up";
  }
  if (fullNameField) {
    fullNameField.hidden = !isSignUp;
  }
  if (forgotButton) {
    forgotButton.hidden = isSignUp;
  }
  if (submitButton) {
    submitButton.textContent = isSignUp ? "Sign Up" : "Sign In";
  }
}

function setMode(nextMode) {
  setLayoutMode(nextMode);
  setContentMode(nextMode);
}

function playPageEnter() {
  document.body.classList.remove("is-page-leaving");
  document.body.classList.add("is-page-entering");
  window.setTimeout(() => {
    document.body.classList.remove("is-page-entering");
  }, 240);
}

function navigateWithTransition(url) {
  if (!url) {
    return;
  }

  if (reducedMotionQuery.matches) {
    window.location.href = url;
    return;
  }

  document.body.classList.add("is-page-leaving");
  window.setTimeout(() => {
    window.location.href = url;
  }, PAGE_TRANSITION_MS);
}

function renderStatus() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const message = params.get("message");
  const email = params.get("email");
  const name = params.get("name");

  if (!status || !message || !statusBanner) {
    return;
  }

  statusBanner.hidden = false;
  statusBanner.dataset.state = status;
  statusBanner.textContent =
    status === "success" && email
      ? `${message} ${name ? `${name} ` : ""}(${email})`
      : message;
}

function attachGoogleLogin() {
  if (!googleButton) {
    return;
  }

  googleButton.addEventListener("click", () => {
    window.location.href = "/auth/google/start";
  });
}

function attachModeSwitch() {
  if (!switchModeButton) {
    return;
  }

  switchModeButton.addEventListener("click", () => {
    if (isAnimating) {
      return;
    }

    const nextMode = mode === "signin" ? "signup" : "signin";
    isAnimating = true;
    if (authCard) {
      const directionClass = nextMode === "signup" ? "to-signup" : "to-signin";
      authCard.classList.remove("is-fading", "to-signup", "to-signin");
      void authCard.offsetWidth;
      authCard.classList.add("is-fading", directionClass);
    }

    // Start panel movement immediately.
    setLayoutMode(nextMode);

    // Swap the form/promo content only after the slide crosses the midpoint.
    window.setTimeout(() => {
      setContentMode(nextMode);
    }, CONTENT_SWAP_MS);

    window.setTimeout(() => {
      if (authCard) {
        authCard.classList.remove("is-fading", "to-signup", "to-signin");
      }
      isAnimating = false;
    }, TRANSITION_MS);
  });
}

function attachEmailForm() {
  if (!emailForm || !statusBanner) {
    return;
  }

  emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    statusBanner.hidden = false;
    statusBanner.dataset.state = "info";
    statusBanner.textContent =
      mode === "signup"
        ? "Sign-up form is ready, but backend registration is not connected yet."
        : "Email/password sign-in is not connected yet. Use Google for now.";
  });
}

setMode("signin");
renderStatus();
attachGoogleLogin();
attachModeSwitch();
attachEmailForm();
playPageEnter();

window.addEventListener("pageshow", () => {
  document.body.classList.remove("is-page-leaving");
  playPageEnter();
});

window.addEventListener("pagehide", () => {
  document.body.classList.add("is-page-leaving");
});
