"use client";

import * as React from "react";
import { CacheProvider, type EmotionCache } from "@emotion/react";
import createCache from "@emotion/cache";
import { CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useServerInsertedHTML } from "next/navigation";

const theme = createTheme();

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
