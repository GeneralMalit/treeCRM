"use client";

import * as React from "react";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import createCache from "@emotion/cache";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useServerInsertedHTML } from "next/navigation";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0f6b45",
      dark: "#0f5132",
      light: "#dff5ec",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0f766e",
    },
    info: {
      main: "#0284c7",
    },
    warning: {
      main: "#b7791f",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    text: {
      primary: "#0f172a",
      secondary: "#475569",
    },
    divider: "rgba(148, 163, 184, 0.35)",
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: "var(--font-geist-sans)",
    h1: {
      fontWeight: 900,
      letterSpacing: 0,
    },
    h2: {
      fontWeight: 850,
      letterSpacing: 0,
    },
    h3: {
      fontWeight: 800,
      letterSpacing: 0,
    },
    h4: {
      fontWeight: 800,
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#f6f8fb",
          color: "#0f172a",
          fontFamily: "var(--font-geist-sans)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderColor: "rgba(100, 116, 139, 0.22)",
        },
        outlined: {
          boxShadow: "none",
        },
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: "1px solid rgba(100, 116, 139, 0.22)",
          boxShadow: "0 12px 36px rgba(15, 23, 42, 0.05)",
          backgroundImage: "none",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: "none",
          paddingLeft: "1rem",
          paddingRight: "1rem",
          minHeight: 38,
        },
        contained: {
          boxShadow: "none",
          backgroundColor: "#0f6b45",
          "&:hover": {
            backgroundColor: "#0f5132",
            boxShadow: "none",
          },
        },
        outlined: {
          borderColor: "rgba(15, 23, 42, 0.18)",
          color: "#0f172a",
          "&:hover": {
            borderColor: "rgba(15, 23, 42, 0.36)",
            backgroundColor: "rgba(15, 107, 69, 0.05)",
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          backgroundColor: "#ffffff",
          "& fieldset": {
            borderColor: "rgba(100, 116, 139, 0.28)",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          color: "#475569",
          fontSize: "0.74rem",
          fontWeight: 800,
          letterSpacing: 0,
          textTransform: "uppercase",
          backgroundColor: "#f8fafc",
        },
        root: {
          borderBottomColor: "rgba(100, 116, 139, 0.18)",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 7,
          fontWeight: 700,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 10,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
      },
    },
    MuiContainer: {
      styleOverrides: {
        root: {
          paddingLeft: "1rem",
          paddingRight: "1rem",
        },
      },
    },
  },
});

function createEmotionCache() {
  return createCache({ key: "mui", prepend: true });
}

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const [{ cache, flush }] = React.useState(() => {
    const cache = createEmotionCache();
    cache.compat = true;

    const prevInsert = cache.insert;
    let inserted: string[] = [];

    cache.insert = (
      ...args: Parameters<typeof prevInsert>
    ): ReturnType<typeof prevInsert> => {
      const serialized = args[1];

      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }

      return prevInsert(...args);
    };

    const flush = () => {
      const names = inserted;
      inserted = [];
      return names;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();

    if (names.length === 0) {
      return null;
    }

    let styles = "";
    for (const name of names) {
      styles += cache.inserted[name] as string;
    }

    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache as EmotionCache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
