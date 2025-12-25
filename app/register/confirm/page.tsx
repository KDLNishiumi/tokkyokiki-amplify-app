"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Amplify } from "aws-amplify";
import { confirmSignUp, signIn } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs);

export default function ConfirmPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("pendingSignUpEmail");
    const storedPassword = sessionStorage.getItem("pendingSignUpPassword");
    if (storedEmail) setEmail(storedEmail);
    if (storedPassword) setPassword(storedPassword);
  }, []);

  const disabled = useMemo(() => {
    if (!email || !code) return true;
    if (!password) return true;
    return status === "submitting";
  }, [email, code, password, status]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError("");
    setMessage("");
    setStatus("submitting");
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
    } catch (err: any) {
      // 既に確認済みの場合はそのままログインへ進む
      const msg = err?.message ?? "";
      if (!msg.includes("Current status is CONFIRMED")) {
        setError(msg || "確認に失敗しました");
        setStatus("idle");
        return;
      }
    }

    try {
      await signIn({ username: email, password: password! });
      sessionStorage.removeItem("pendingSignUpEmail");
      sessionStorage.removeItem("pendingSignUpPassword");
      setMessage("確認・ログインが完了しました。");
      setStatus("done");
      router.push("/");
    } catch (err: any) {
      setError(err?.message ?? "ログインに失敗しました");
      setStatus("idle");
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "24px" }}>
      <h1>確認コード入力</h1>
      <p style={{ color: "#555", marginBottom: "12px" }}>
        登録時に受け取った確認コードを入力してください。メールアドレスは自動でセットされています。
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <label>
          <div>Email</div>
          <input
            type="email"
            value={email}
            readOnly
            style={{ width: "100%", background: "#f5f5f5" }}
          />
        </label>
        <label>
          <div>確認コード</div>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
        {!password && (
          <p style={{ color: "red", marginTop: "-4px", fontSize: "14px" }}>
            パスワード情報が見つかりません。登録画面からやり直してください。
          </p>
        )}
        <button type="submit" disabled={disabled}>
          {status === "submitting" ? "確認中..." : "確認してログイン"}
        </button>
      </form>

      {message && <p style={{ color: "green", marginTop: "12px" }}>{message}</p>}
      {error && <p style={{ color: "red", marginTop: "12px" }}>{error}</p>}

      <div style={{ marginTop: "12px" }}>
        <a href="/">ログイン画面に戻る</a>
      </div>
      <div style={{ marginTop: "4px" }}>
        <a href="/register">登録に戻る</a>
      </div>
    </main>
  );
}
