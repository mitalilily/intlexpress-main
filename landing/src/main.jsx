import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import App from "./App";
import { AppDataProvider } from "./context/AppDataContext";
import "./index.css";
import theme from "./theme";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
);
