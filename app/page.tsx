"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import { get } from "aws-amplify/api";
import outputs from "@/amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

export default function App() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function callApi() {
    setLoading(true);
    try {
      // Lambda関数URLを直接呼び出す（デプロイ後にURLを設定）
      const response = await fetch(
        "https://YOUR_LAMBDA_FUNCTION_URL_HERE",
        {
          method: "GET",
        }
      );
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Error calling API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>API Test</h1>
      <button onClick={callApi} disabled={loading}>
        {loading ? "Loading..." : "Call API"}
      </button>
      {message && <p>{message}</p>}
    </main>
  );
}
