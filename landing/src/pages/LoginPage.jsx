import { useState } from "react";
import { Alert, Button, Chip, Paper, TextField, Typography } from "@mui/material";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import { useAppData } from "../context/AppDataContext";
import { brand } from "../data/siteData";

export default function LoginPage() {
  const { authLoading, session, signIn, signOut } = useAppData();
  const [credentials, setCredentials] = useState({
    email: brand.email,
    password: "Intlexpress@123",
  });
  const [status, setStatus] = useState({ type: "", message: "" });

  const handleChange = (key) => (event) => {
    setCredentials((current) => ({
      ...current,
      [key]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: "", message: "" });

    try {
      await signIn(credentials);
      setStatus({ type: "success", message: "Signed in to the Intlexpress demo portal." });
    } catch (loginError) {
      setStatus({ type: "error", message: loginError.message });
    }
  };

  return (
    <div className="inner-page">
      <PageHero
        badge="Portal login"
        caption="Demo operations access"
        description="A polished login surface for operations teams, built on the existing auth context and backend-ready service layer."
        title="Access the Intlexpress operations portal."
      />

      <section className="landing-section landing-section--muted">
        <div className="container-shell login-layout">
          <MotionFade>
            <Paper className="glass-panel login-panel login-panel--info" elevation={0}>
              <Chip label="Demo credentials loaded" />
              <Typography variant="h4">Built for dispatch teams, support leads, and fulfillment managers.</Typography>
              <Typography className="login-panel__copy" variant="body2">
                The backend scaffold is still intact. This page simply wraps it in a more premium front-end experience for the Intlexpress brand.
              </Typography>
              <div className="login-panel__credential">
                <span>Email</span>
                <strong>{brand.email}</strong>
              </div>
              <div className="login-panel__credential">
                <span>Password</span>
                <strong>Intlexpress@123</strong>
              </div>
            </Paper>
          </MotionFade>

          <MotionFade delay={0.08}>
            <Paper className="glass-panel login-panel" elevation={0}>
              <Typography variant="h5">{session ? "You're signed in" : "Sign in"}</Typography>
              <Typography className="login-panel__copy" variant="body2">
                Use the seeded demo credentials or wire this page to your production auth API.
              </Typography>

              {session ? (
                <div className="login-session">
                  <Typography variant="body1">{session.user.name}</Typography>
                  <Typography variant="body2">
                    {session.user.email} - {session.user.role}
                  </Typography>
                  <Button className="button-secondary" onClick={signOut} variant="outlined">
                    Sign out
                  </Button>
                </div>
              ) : (
                <form className="login-form" onSubmit={handleSubmit}>
                  <TextField label="Email" onChange={handleChange("email")} value={credentials.email} />
                  <TextField
                    label="Password"
                    onChange={handleChange("password")}
                    type="password"
                    value={credentials.password}
                  />
                  {status.message ? <Alert severity={status.type}>{status.message}</Alert> : null}
                  <Button className="button-primary" disabled={authLoading} type="submit" variant="contained">
                    {authLoading ? "Signing in..." : "Login"}
                  </Button>
                </form>
              )}
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
