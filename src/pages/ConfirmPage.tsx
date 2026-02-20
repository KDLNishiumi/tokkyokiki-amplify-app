import { FormEvent, useEffect, useMemo, useState } from "react";
import { confirmSignUp, signIn } from "aws-amplify/auth";
import { Link, useNavigate } from "react-router-dom";

export default function ConfirmPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("pendingSignUpEmail");
    const storedPassword = sessionStorage.getItem("pendingSignUpPassword");

    if (storedEmail) {
      setEmail(storedEmail);
    }
    if (storedPassword) {
      setPassword(storedPassword);
    }
  }, []);

  const disabled = useMemo(() => {
    if (!email || !code || !password) {
      return true;
    }
    return status === "submitting";
  }, [code, email, password, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !password) {
      return;
    }

    setError("");
    setMessage("");
    setStatus("submitting");

    try {
      await confirmSignUp({ username: email, confirmationCode: code });
    } catch (confirmError: unknown) {
      const text = confirmError instanceof Error ? confirmError.message : "";
      if (!text.includes("Current status is CONFIRMED")) {
        setError(text || "Failed to confirm sign-up.");
        setStatus("idle");
        return;
      }
    }

    try {
      await signIn({ username: email, password });
      sessionStorage.removeItem("pendingSignUpEmail");
      sessionStorage.removeItem("pendingSignUpPassword");
      setMessage("Sign-up confirmed. Redirecting to home.");
      navigate("/");
    } catch (signInError: unknown) {
      setError(signInError instanceof Error ? signInError.message : "Failed to sign in.");
      setStatus("idle");
      return;
    }

    setStatus("idle");
  }

  return (
    <main className="card">
      <h1>Confirmation code</h1>
      <p className="help-text">
        Enter the confirmation code sent to your email address.
      </p>

      <form className="form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span>Email</span>
          <input type="email" value={email} readOnly />
        </label>

        <label className="form-field">
          <span>Code</span>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
        </label>

        {!password && (
          <p className="error-text">
            Saved password was not found. Please register again.
          </p>
        )}

        <button type="submit" disabled={disabled}>
          {status === "submitting" ? "Submitting..." : "Confirm and sign in"}
        </button>
      </form>

      {message && <p className="ok-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <p>
        <Link to="/">Back to sign in</Link>
      </p>
      <p>
        <Link to="/register">Back to registration</Link>
      </p>
    </main>
  );
}
