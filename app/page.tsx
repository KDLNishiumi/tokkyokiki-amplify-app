"use client";

import { useEffect, useState } from "react";
import { Amplify } from "aws-amplify";
import { fetchAuthSession, getCurrentUser, signInWithRedirect, signOut } from "aws-amplify/auth";
import Link from "next/link";
import outputs from "@/amplify_outputs.json";
import "./../app/app.css";

Amplify.configure(outputs);

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  async function handleSignIn() {
    await signInWithRedirect();
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
      const apiUrl = (outputs as any).custom?.kintoneSyncUrl;

      const signedRequest = await signRequest(
        {
          url: new URL(apiUrl),
          method: "GET",
          headers: {},
        },
        {
          credentials: session.credentials!,
          signingRegion: outputs.auth.aws_region,
          signingService: "lambda",
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
        <h1>API Test</h1>
        <button onClick={handleSignIn}>Sign In</button>
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
