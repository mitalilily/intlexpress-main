import { useEffect } from "react";
import { Alert, Button, Paper, Typography } from "@mui/material";
import MotionFade from "../components/common/MotionFade";
import PageHero from "../components/common/PageHero";
import { getClientAuthUrl } from "../utils/clientAuth";

export default function ClientAuthRedirectPage() {
  const clientAuthUrl = getClientAuthUrl();

  useEffect(() => {
    window.location.replace(clientAuthUrl);
  }, [clientAuthUrl]);

  return (
    <div className="inner-page">
      <PageHero
        badge="Portal login"
        caption="Redirecting to merchant auth"
        description="Your Intlexpress portal login now lives inside the client app."
        title="Sending you to the client auth page."
      />

      <section className="landing-section landing-section--muted">
        <div className="container-shell login-layout">
          <MotionFade>
            <Paper className="glass-panel login-panel" elevation={0}>
              <Typography variant="h5">Redirecting now</Typography>
              <Typography className="login-panel__copy" variant="body2">
                If the login screen does not open automatically, continue with the button below.
              </Typography>
              <Alert severity="info">Client login URL: {clientAuthUrl}</Alert>
              <Button
                className="button-primary"
                component="a"
                href={clientAuthUrl}
                rel="noreferrer"
                variant="contained"
              >
                Open client login
              </Button>
            </Paper>
          </MotionFade>
        </div>
      </section>
    </div>
  );
}
