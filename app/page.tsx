"use client";

import { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import { signInWithRedirect, signOut, fetchAuthSession, getCurrentUser } from "aws-amplify/auth";
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
      const { Signer } = await import("@aws-amplify/core/internals/utils");
      const session = await fetchAuthSession();
      const apiUrl = (outputs as any).custom?.kintoneSyncUrl;
      
      const signedRequest = await Signer.signRequest(
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
