import { FormEvent, useMemo, useState } from "react";
import { signIn } from "aws-amplify/auth";
import { Link, useNavigate } from "react-router-dom";
import outputs from "../../amplify_outputs.json";

type OutputShape = {
  custom?: {
    apiBaseUrl?: string;
    userSignUpUrl?: string;
  };
};

const appOutputs = outputs as OutputShape;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const disabled = useMemo(() => {
    if (!email || !password || !confirm) {
      return true;
    }
    if (password !== confirm) {
      return true;
    }
    return status === "submitting";
  }, [confirm, email, password, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) {
      return;
    }

    setError("");
    setMessage("");
    setStatus("submitting");

    try {
      const apiBaseUrl = appOutputs.custom?.apiBaseUrl;
      const endpoint =
        appOutputs.custom?.userSignUpUrl ??
        (apiBaseUrl ? `${apiBaseUrl.replace(/\/$/, "")}/user-signup` : undefined);

      if (!endpoint) {
        throw new Error("Signup endpoint is not configured.");
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "dummy-signup-key",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = (await response.json()) as { error?: string; userConfirmed?: boolean };
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to register user.");
      }

      sessionStorage.setItem("pendingSignUpEmail", email);
      sessionStorage.setItem("pendingSignUpPassword", password);

      if (data.userConfirmed) {
        await signIn({ username: email, password });
        setMessage("Registration complete. Redirecting to home.");
        navigate("/");
        return;
      }

      setMessage("Confirmation code sent. Redirecting to confirmation page.");
      navigate("/register/confirm");
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Registration failed."
      );
      setStatus("idle");
      return;
    }

    setStatus("idle");
  }

  return (
    <main className="card">
      <h1>User registration</h1>

      <form className="form" onSubmit={handleSubmit}>
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

        <label className="form-field">
          <span>Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={disabled}>
          {status === "submitting" ? "Submitting..." : "Register"}
        </button>
      </form>

      {message && <p className="ok-text">{message}</p>}
      {error && <p className="error-text">{error}</p>}

      <p>
        <Link to="/">Back to sign in</Link>
      </p>
    </main>
  );
}
