const statusBanner = document.getElementById("authStatus");
const googleButton = document.getElementById("googleSsoButton");

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

renderStatus();
attachGoogleLogin();
