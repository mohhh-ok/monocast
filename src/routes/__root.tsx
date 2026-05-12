import {
  HeadContent,
  Link,
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
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "1.5rem" }}>ページが見つかりません</h1>
      <p style={{ opacity: 0.7 }}>お探しのページは存在しないか、移動した可能性があります。</p>
      <Link to="/" style={{ color: "#a3b8ff" }}>
        トップへ戻る
      </Link>
    </main>
  );
}

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
