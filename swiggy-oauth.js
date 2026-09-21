import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { exec } from "node:child_process";

const TOKENS_FILE = path.resolve(process.cwd(), ".tokens.json");

/**
 * Swiggy OAuth Client Provider with PKCE authentication and token persistence.
 */
export class SwiggyOAuthProvider {
  constructor(options = {}) {
    this.clientId = options.clientId || process.env.SWIGGY_CLIENT_ID || "swiggy-mcp";
    this.clientSecret = options.clientSecret || process.env.SWIGGY_CLIENT_SECRET || "";
    this.redirectPort = 3000;
    this.redirectUrl = options.redirectUrl || process.env.SWIGGY_REDIRECT_URI || `http://localhost:${this.redirectPort}/auth/callback`;
    this._codeVerifier = "";

    this._loadTokens();

    this._discoveryState = {
      authorizationServerUrl: "https://mcp.swiggy.com/auth",
      authorizationServerMetadata: {
        issuer: "https://mcp.swiggy.com/auth",
        authorization_endpoint: "https://mcp.swiggy.com/auth/authorize",
        token_endpoint: "https://mcp.swiggy.com/auth/token",
        registration_endpoint: "https://mcp.swiggy.com/auth/register",
        scopes_supported: ["mcp:tools", "mcp:resources", "mcp:prompts"],
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      },
    };

    this.clientMetadata = {
      client_name: "Pooly Food Ordering",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp:tools mcp:resources mcp:prompts",
      ...options.clientMetadata,
    };
  }

  _loadTokens() {
    if (process.env.SWIGGY_AUTH_TOKEN && !process.env.SWIGGY_AUTH_TOKEN.includes(";")) {
      this.accessToken = process.env.SWIGGY_AUTH_TOKEN;
      this.refreshToken = process.env.SWIGGY_REFRESH_TOKEN || "";
      return;
    }
    if (fs.existsSync(TOKENS_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
        this.accessToken = data.access_token || "";
        this.refreshToken = data.refresh_token || "";
      } catch (err) {
        this.accessToken = "";
        this.refreshToken = "";
      }
    } else {
      this.accessToken = "";
      this.refreshToken = "";
    }
  }

  _persistTokens(tokens) {
    try {
      const data = {
        access_token: tokens.access_token || this.accessToken,
        refresh_token: tokens.refresh_token || this.refreshToken,
        client_id: this.clientId,
        updated_at: new Date().toISOString(),
      };
      fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.warn("Could not save tokens to file:", err.message);
    }
  }

  /**
   * Ensures the user is authenticated before connecting to the MCP server.
   */
  async ensureAuthenticated() {
    this._loadTokens();
    if (this.accessToken) {
      return this.accessToken;
    }

    console.log("\n🔑 Initiating Swiggy OAuth login...");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    this._codeVerifier = verifier;

    const authUrl = new URL(this._discoveryState.authorizationServerMetadata.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("code_challenge", challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("redirect_uri", this.redirectUrl);
    authUrl.searchParams.set("scope", "mcp:tools mcp:resources mcp:prompts");

    await this._startLocalCallbackServer(authUrl.toString());
    return this.accessToken;
  }

  _startLocalCallbackServer(authUrlStr) {
    return new Promise((resolve, reject) => {
      console.log("\n=================================================================");
      console.log("🔗 Opening Swiggy login page in your browser:");
      console.log(authUrlStr);
      console.log("=================================================================\n");

      // Auto-open browser on macOS
      exec(`open "${authUrlStr}"`, () => {});

      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, `http://localhost:${this.redirectPort}`);
          if (reqUrl.pathname === "/auth/callback") {
            const code = reqUrl.searchParams.get("code");
            const error = reqUrl.searchParams.get("error");

            if (error) {
              res.writeHead(400, { "Content-Type": "text/html" });
              res.end(`<h2>Swiggy Authorization Error: ${error}</h2>`);
              server.close();
              reject(new Error(`OAuth Error: ${error}`));
              return;
            }

            if (code) {
              res.writeHead(200, { "Content-Type": "text/html" });
              res.end(`
                <!DOCTYPE html>
                <html>
                  <head><title>Swiggy Connected</title></head>
                  <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 90vh; background: #0f172a; color: #f8fafc;">
                    <div style="background: #1e293b; padding: 40px; border-radius: 16px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
                      <h1 style="color: #22c55e; margin-bottom: 8px;">✓ Swiggy Connected!</h1>
                      <p style="color: #94a3b8; font-size: 16px;">Authorization successful. You can close this window and return to your terminal.</p>
                    </div>
                  </body>
                </html>
              `);
              server.close();

              await this._exchangeCodeForTokens(code);
              resolve();
              return;
            }
          }

          res.writeHead(404);
          res.end("Not Found");
        } catch (err) {
          res.writeHead(500);
          res.end("Server Error");
          server.close();
          reject(err);
        }
      });

      server.listen(this.redirectPort, () => {
        console.log(`[Swiggy OAuth] Waiting for browser login callback at http://localhost:${this.redirectPort}/auth/callback ...`);
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`[Swiggy OAuth] Port ${this.redirectPort} in use.`);
        }
        resolve();
      });
    });
  }

  async _exchangeCodeForTokens(code) {
    try {
      const tokenEndpoint = this._discoveryState.authorizationServerMetadata.token_endpoint;
      const params = new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: this.redirectUrl,
        client_id: this.clientId,
        code_verifier: this._codeVerifier,
      });

      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.warn("[Swiggy OAuth] Token exchange error:", response.status, errText);
        return;
      }

      const tokens = await response.json();
      await this.saveTokens(tokens);
      console.log("✅ Swiggy OAuth Token acquired & saved successfully!\n");
    } catch (err) {
      console.error("[Swiggy OAuth] Failed to exchange code for token:", err.message);
    }
  }

  async token() {
    return this.accessToken || undefined;
  }

  async tokens() {
    if (!this.accessToken) return undefined;
    return {
      access_token: this.accessToken,
      refresh_token: this.refreshToken,
      token_type: "Bearer",
    };
  }

  async clientInformation() {
    return {
      client_id: this.clientId,
      client_secret: this.clientSecret,
    };
  }

  async saveTokens(tokens) {
    if (tokens?.access_token) {
      this.accessToken = tokens.access_token;
    }
    if (tokens?.refresh_token) {
      this.refreshToken = tokens.refresh_token;
    }
    this._persistTokens(tokens);
  }

  async saveCodeVerifier(codeVerifier) {
    this._codeVerifier = codeVerifier;
  }

  async codeVerifier() {
    return this._codeVerifier;
  }

  async discoveryState() {
    return this._discoveryState;
  }

  async saveDiscoveryState(state) {
    this._discoveryState = { ...this._discoveryState, ...state };
  }

  async redirectToAuthorization(authorizationUrl) {
    console.log("\n=======================================================");
    console.log("🔗 Authorization URL:", authorizationUrl.toString());
    console.log("=======================================================\n");
  }

  async invalidateCredentials(scope) {
    if (scope === "tokens") {
      this.accessToken = "";
      if (fs.existsSync(TOKENS_FILE)) {
        try {
          fs.unlinkSync(TOKENS_FILE);
        } catch (e) {}
      }
    }
  }
}

export const swiggyOAuthProvider = new SwiggyOAuthProvider();
export default swiggyOAuthProvider;
