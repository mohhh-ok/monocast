import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router";
import { Provider as JotaiProvider } from "jotai";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "monocast" },
      {
        name: "description",
        content:
          "Claude Haiku + VOICEVOX で生成する、ひとり用の情報ききながしラジオ",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <JotaiProvider>{children ?? <Outlet />}</JotaiProvider>
        <Scripts />
      </body>
    </html>
  );
}
