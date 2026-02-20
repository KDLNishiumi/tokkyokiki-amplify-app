import { FormEvent, useEffect, useState } from "react";
import {
  confirmSignIn,
  fetchAuthSession,
  getCurrentUser,
  signIn,
  signOut,
} from "aws-amplify/auth";
import { Link } from "react-router-dom";
import outputs from "../../amplify_outputs.json";

type AuthUser = {
  username: string;
};

type AuthStep = "signIn" | "newPassword";

type OutputShape = {
  auth?: {
    aws_region?: string;
  };
  custom?: {
    apiBaseUrl?: string;
    kintoneSyncUrl?: string;
  };
};

const appOutputs = outputs as OutputShape;

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authStep, setAuthStep] = useState<AuthStep>("signIn");
  const [authStatus, setAuthStatus] = useState<"idle" | "signing-in">("idle");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    void checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser({ username: currentUser.username });
    } catch {
      setUser(null);
    }
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) {
      return;
    }

    setAuthError("");
    setAuthStatus("signing-in");

    try {
      const result = await signIn({ username: email, password });
      const step = result.nextStep?.signInStep;

      if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setAuthStep("newPassword");
        setMessage("A new password is required before sign-in can complete.");
      } else {
        await checkUser();
        setMessage("");
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : "Failed to sign in.");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function handleConfirmNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newPassword) {
      return;
    }

    setAuthError("");
    setAuthStatus("signing-in");

    try {
      await confirmSignIn({ challengeResponse: newPassword });
      setAuthStep("signIn");
      setNewPassword("");
      await checkUser();
      setMessage("");
    } catch (error: unknown) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Failed to set a new password."
      );
    } finally {
      setAuthStatus("idle");
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function callApi() {
    setLoading(true);
    setMessage("");

    try {
      const { signRequest } = await import(
        "@aws-amplify/core/internals/aws-client-utils"
      );
      const session = await fetchAuthSession();

      if (!session.credentials) {
        throw new Error("AWS credentials are not available.");
      }

      const apiBaseUrl = appOutputs.custom?.apiBaseUrl;
      const apiUrl =
        appOutputs.custom?.kintoneSyncUrl ??
        (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/kintone-sync` : undefined);

      if (!apiUrl) {
        throw new Error("kintoneSyncUrl is not configured.");
      }
      const signingRegion = appOutputs.auth?.aws_region ?? "us-east-1";

      const signedRequest = await signRequest(
        {
          url: new URL(apiUrl),
          method: "GET",
          headers: {},
        },
        {
          credentials: session.credentials,
          signingRegion,
          signingService: "execute-api",
        }
      );

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: signedRequest.headers,
      });

      const data = (await response.json()) as { message?: string };
      setMessage(data.message ?? "API call completed.");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Failed to call API.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main className="card">
        <h1>Sign in</h1>

        {authStep === "signIn" && (
          <form className="form" onSubmit={handleSignIn}>
            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={authStatus === "signing-in"}>
              {authStatus === "signing-in" ? "Signing in..." : "Sign in"}
            </button>
          </form>
        )}

        {authStep === "newPassword" && (
          <form className="form" onSubmit={handleConfirmNewPassword}>
            <p className="help-text">
              Set a new password to complete the first sign-in.
            </p>

            <label className="form-field">
              <span>Email</span>
              <input type="email" value={email} readOnly />
            </label>

            <label className="form-field">
              <span>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
            </label>

            <button type="submit" disabled={authStatus === "signing-in"}>
              {authStatus === "signing-in"
                ? "Submitting..."
                : "Save new password"}
            </button>
          </form>
        )}

        {authError && <p className="error-text">{authError}</p>}
        {message && <p className="help-text">{message}</p>}

        <p>
          <Link to="/register">Go to user registration</Link>
        </p>
      </main>
    );
  }

  return (
    <main className="card">
      <h1>API Test</h1>
      <p>Signed in as: {user.username}</p>

      <div className="actions">
        <button onClick={callApi} disabled={loading}>
          {loading ? "Loading..." : "Call API"}
        </button>
        <button onClick={handleSignOut}>Sign out</button>
      </div>

      {message && <p className="help-text">{message}</p>}
    </main>
  );
}
