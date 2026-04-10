const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = path.resolve(__dirname, "..");
const envPath = path.join(rootDir, ".env");

function loadEnv(filePath) {
    const env = {};

    if (!fs.existsSync(filePath)) {
        return env;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) {
            continue;
        }

        const separatorIndex = line.indexOf("=");
        if (separatorIndex === -1) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        let value = line.slice(separatorIndex + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        env[key] = value;
        if (!process.env[key]) {
            process.env[key] = value;
        }
    }

    return env;
}

loadEnv(envPath);

const HOST = process.env.HOST || "localhost";
const PORT = Number(process.env.PORT || 3530);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
    process.env.GOOGLE_REDIRECT_URI || `http://${HOST}:${PORT}/auth/google/callback`;

const staticRoots = {
    "/": path.join(rootDir, "frontend", "landing.html"),
    "/login": path.join(rootDir, "login", "login.html"),
};

function sendJson(response, statusCode, payload) {
    response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, statusCode, body) {
    response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(body);
}

function sendRedirect(response, location) {
    response.writeHead(302, { Location: location });
    response.end();
}

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    const map = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
    };

    return map[extension] || "application/octet-stream";
}

function safeReadStatic(urlPath) {
    if (staticRoots[urlPath]) {
        return staticRoots[urlPath];
    }

    const cleanPath = path
        .normalize(urlPath)
        .replace(/^(\.\.[\\/])+/, "")
        .replace(/^[/\\]+/, "");
    const loginRoot = path.join(rootDir, "login");
    const frontendRoot = path.join(rootDir, "frontend");

    const candidateRoots = [loginRoot, frontendRoot];

    for (const base of candidateRoots) {
        const filePath = path.join(base, cleanPath);
        if (filePath.startsWith(base) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            return filePath;
        }
    }

    return null;
}

function renderLoginRedirect(status, message, profile) {
    const redirect = new URL("/login", `http://${HOST}:${PORT}`);
    if (status) {
        redirect.searchParams.set("status", status);
    }
    if (message) {
        redirect.searchParams.set("message", message);
    }
    if (profile && profile.email) {
        redirect.searchParams.set("email", profile.email);
    }
    if (profile && profile.name) {
        redirect.searchParams.set("name", profile.name);
    }
    return redirect.toString();
}

async function exchangeCodeForTokens(code) {
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${body}`);
    }

    return response.json();
}

async function fetchGoogleProfile(accessToken) {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Profile fetch failed: ${response.status} ${body}`);
    }

    return response.json();
}

const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const { pathname, searchParams } = requestUrl;

    if (pathname === "/health") {
        return sendJson(response, 200, {
            ok: true,
            authConfigured: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
            redirectUri: GOOGLE_REDIRECT_URI,
        });
    }

    if (pathname === "/auth/google/start") {
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return sendJson(response, 500, {
                error: "Google OAuth is not configured.",
                missing: [
                    !GOOGLE_CLIENT_ID ? "GOOGLE_CLIENT_ID" : null,
                    !GOOGLE_CLIENT_SECRET ? "GOOGLE_CLIENT_SECRET" : null,
                ].filter(Boolean),
            });
        }

        const state = crypto.randomBytes(16).toString("hex");
        const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
        authUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "openid email profile");
        authUrl.searchParams.set("access_type", "offline");
        authUrl.searchParams.set("prompt", "consent");
        authUrl.searchParams.set("state", state);

        response.writeHead(302, {
            Location: authUrl.toString(),
            "Set-Cookie": `google_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
        });
        return response.end();
    }

    if (pathname === "/auth/google/callback") {
        const error = searchParams.get("error");
        const code = searchParams.get("code");
        const returnedState = searchParams.get("state");
        const cookieHeader = request.headers.cookie || "";
        const stateCookie = cookieHeader
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("google_oauth_state="));
        const storedState = stateCookie ? stateCookie.split("=")[1] : "";

        if (error) {
            return sendRedirect(
                response,
                renderLoginRedirect("error", `Google sign-in was cancelled or failed: ${error}`)
            );
        }

        if (!code) {
            return sendRedirect(
                response,
                renderLoginRedirect("error", "Google did not return an authorization code.")
            );
        }

        if (!returnedState || !storedState || returnedState !== storedState) {
            return sendRedirect(
                response,
                renderLoginRedirect("error", "State validation failed. Please try again.")
            );
        }

        try {
            const tokenData = await exchangeCodeForTokens(code);
            const profile = await fetchGoogleProfile(tokenData.access_token);

            response.writeHead(302, {
                Location: renderLoginRedirect("success", "Signed in with Google.", profile),
                "Set-Cookie": [
                    "google_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
                    `peerly_session=${Buffer.from(
                        JSON.stringify({
                            name: profile.name,
                            email: profile.email,
                            picture: profile.picture,
                            provider: "google",
                        })
                    ).toString("base64")}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax`,
                ],
            });
            return response.end();
        } catch (authError) {
            return sendRedirect(
                response,
                renderLoginRedirect("error", authError.message)
            );
        }
    }

    if (pathname === "/auth/session") {
        const cookieHeader = request.headers.cookie || "";
        const sessionCookie = cookieHeader
            .split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("peerly_session="));

        if (!sessionCookie) {
            return sendJson(response, 200, { signedIn: false });
        }

        try {
            const encoded = sessionCookie.split("=")[1];
            const session = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
            return sendJson(response, 200, { signedIn: true, user: session });
        } catch (sessionError) {
            return sendJson(response, 200, { signedIn: false });
        }
    }

    if (pathname === "/auth/logout") {
        response.writeHead(302, {
            Location: "/login?status=info&message=Signed%20out.",
            "Set-Cookie": "peerly_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
        });
        return response.end();
    }

    const staticPath = safeReadStatic(pathname);
    if (staticPath) {
        response.writeHead(200, { "Content-Type": getContentType(staticPath) });
        return fs.createReadStream(staticPath).pipe(response);
    }

    return sendText(response, 404, "Not found");
});

server.listen(PORT, HOST, () => {
    console.log(`Peerly server running at http://${HOST}:${PORT}`);
});
