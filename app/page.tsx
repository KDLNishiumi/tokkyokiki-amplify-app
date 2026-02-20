"use client";

import { FormEvent, useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { confirmSignIn, fetchAuthSession, getCurrentUser, signIn, signOut } from "aws-amplify/auth";
import Link from "next/link";
import outputs from "@/amplify_outputs.json";
import "./../app/app.css";

Amplify.configure(outputs);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [authStep, setAuthStep] = useState<"signIn" | "newPassword">("signIn");
  const [authStatus, setAuthStatus] = useState<"idle" | "signing-in">("idle");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setAuthError("");
    setAuthStatus("signing-in");
    try {
      const res = await signIn({ username: email, password });
      const step = res.nextStep?.signInStep;
      if (step === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setAuthStep("newPassword");
        setMessage("初回ログインです。新しいパスワードを設定してください。");
      } else {
        await checkUser();
        setMessage("");
      }
    } catch (error: any) {
      setAuthError(error?.message ?? "サインインに失敗しました");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function handleConfirmNewPassword(e: FormEvent) {
    e.preventDefault();
    if (!newPassword) return;
    setAuthError("");
    setAuthStatus("signing-in");
    try {
      await confirmSignIn({ challengeResponse: newPassword });
      setAuthStep("signIn");
      setNewPassword("");
      await checkUser();
      setMessage("");
    } catch (error: any) {
      setAuthError(error?.message ?? "新しいパスワードの設定に失敗しました");
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
    try {
      const { signRequest } = await import("@aws-amplify/core/internals/aws-client-utils");
      const session = await fetchAuthSession();
      const apiBaseUrl = (outputs as any).custom?.apiBaseUrl;
      const apiUrl =
        (outputs as any).custom?.kintoneSyncUrl ??
        (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/kintone-sync` : undefined);
      if (!apiUrl) {
        throw new Error("kintoneSyncUrl が設定されていません");
      }

      const signedRequest = await signRequest(
        {
          url: new URL(apiUrl),
          method: "GET",
          headers: {},
        },
        {
          credentials: session.credentials!,
          signingRegion: outputs.auth.aws_region,
          signingService: "execute-api",
        }
      );

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: signedRequest.headers,
      });
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Error calling API");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <main>
        <h1>サインイン</h1>
        {authStep === "signIn" && (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
            <label>
              <div>Email</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>
            <label>
              <div>パスワード</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>
            <button type="submit" disabled={authStatus === "signing-in"}>
              {authStatus === "signing-in" ? "サインイン中..." : "サインイン"}
            </button>
            {authError && <p style={{ color: "red" }}>{authError}</p>}
          </form>
        )}

        {authStep === "newPassword" && (
          <form onSubmit={handleConfirmNewPassword} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 360 }}>
            <p style={{ color: "#555" }}>新しいパスワードを入力してください。</p>
            <label>
              <div>Email</div>
              <input type="email" value={email} readOnly style={{ width: "100%", background: "#f4f4f4" }} />
            </label>
            <label>
              <div>新しいパスワード</div>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                style={{ width: "100%" }}
              />
            </label>
            <button type="submit" disabled={authStatus === "signing-in"}>
              {authStatus === "signing-in" ? "設定中..." : "パスワードを設定してサインイン"}
            </button>
            {authError && <p style={{ color: "red" }}>{authError}</p>}
          </form>
        )}
        <div style={{ marginTop: "12px" }}>
          <Link href="/register">新規登録はこちら</Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>API Test</h1>
      <p>Welcome, {user.username}</p>
      <button onClick={callApi} disabled={loading}>
        {loading ? "Loading..." : "Call API"}
      </button>
      {message && <p>{message}</p>}
      <button onClick={handleSignOut}>Sign Out</button>
    </main>
  );
}
