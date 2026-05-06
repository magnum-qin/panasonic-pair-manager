import { createTheme } from "@mui/material/styles";

export const appTheme = createTheme({
  palette: {
    primary: {
      main: "#147f8a",
    },
    error: {
      main: "#b73721",
    },
    background: {
      default: "#f6f3ee",
      paper: "#fffdf9",
    },
  },
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    button: {
      textTransform: "none",
      fontWeight: 650,
    },
  },
});
