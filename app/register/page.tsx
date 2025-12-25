"use client";

import { FormEvent, useMemo, useState } from "react";
import { Amplify } from "aws-amplify";
import { signUp, signIn } from "aws-amplify/auth";
import { useRouter } from "next/navigation";
import outputs from "@/amplify_outputs.json";

Amplify.configure(outputs);

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const disabled = useMemo(() => {
    if (!email || !password || !confirm) return true;
    if (password !== confirm) return true;
    return status === "submitting";
  }, [email, password, confirm, status]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setError("");
    setMessage("");
    setStatus("submitting");
    try {
      const result = await signUp({
        username: email,
        password,
        options: { userAttributes: { email } },
      });

      // 確認コード入力で使うため保存
      sessionStorage.setItem("pendingSignUpEmail", email);
      sessionStorage.setItem("pendingSignUpPassword", password);

      const requiresCode = result.nextStep?.signUpStep === "CONFIRM_SIGN_UP_CODE";
      if (requiresCode) {
        setMessage("確認コードをメールに送信しました。次の画面でコードを入力してください。");
      } else {
        setMessage("登録が完了しました。ログイン画面へ移動します。");
        // 確認不要の場合はそのままログインを試す
        await signIn({ username: email, password });
      }

      setStatus("done");
      router.push("/register/confirm");
    } catch (err: any) {
      setError(err?.message ?? "登録に失敗しました");
      setStatus("idle");
    }
  }

  return (
    <main style={{ maxWidth: 440, margin: "0 auto", padding: "24px" }}>
      <h1>ユーザー登録</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
        <label>
          <div>パスワード（確認）</div>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={{ width: "100%" }}
          />
        </label>
        <button type="submit" disabled={disabled}>
          {status === "submitting" ? "登録中..." : "登録する"}
        </button>
      </form>

      {message && <p style={{ color: "green", marginTop: "12px" }}>{message}</p>}
      {error && <p style={{ color: "red", marginTop: "12px" }}>{error}</p>}

      <div style={{ marginTop: "8px" }}>
        <a href="/">ログイン画面に戻る</a>
      </div>
    </main>
  );
}
