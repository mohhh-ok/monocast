import { useState } from "react";
import { probeRssUrlsFn, type RssFeedProbe } from "@/server/settings";
import { btnStyle, cardStyle, inputStyle, sectionStyle } from "./styles";

type Props = {
  rssUrls: string[];
  onChange: (next: string[]) => void;
};

function parseUrls(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function isValidUrl(s: string): boolean {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
}

export function NewsSourcesSection({ rssUrls, onChange }: Props) {
  const [text, setText] = useState<string>(rssUrls.join("\n"));
  const [probes, setProbes] = useState<RssFeedProbe[] | null>(null);
  const [probing, setProbing] = useState(false);

  const commit = (raw: string) => {
    const next = parseUrls(raw);
    const same =
      next.length === rssUrls.length && next.every((u, i) => u === rssUrls[i]);
    if (!same) onChange(next);
  };

  const handleChange = (raw: string) => {
    setText(raw);
    commit(raw);
  };

  const handleProbe = async () => {
    const urls = parseUrls(text);
    if (urls.length === 0) {
      setProbes([]);
      return;
    }
    setProbing(true);
    try {
      const result = await probeRssUrlsFn({ data: { urls } });
      setProbes(result);
    } finally {
      setProbing(false);
    }
  };

  const list = parseUrls(text);
  const invalidCount = list.filter((u) => !isValidUrl(u)).length;

  return (
    <section style={cardStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 18,
        }}
      >
        <h2 style={{ ...sectionStyle, marginBottom: 0 }}>ニュースソース (RSS URL)</h2>
        <button
          type="button"
          onClick={() => void handleProbe()}
          disabled={probing || list.length === 0}
          style={{
            ...btnStyle(),
            opacity: probing || list.length === 0 ? 0.4 : 1,
          }}
        >
          {probing ? "取得中…" : "取得テスト"}
        </button>
      </div>

      <p style={{ fontSize: 12, color: "#8a93b8", marginBottom: 10 }}>
        1 行に 1 URL。改行区切りで複数のフィードを指定できます。
      </p>

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck={false}
        rows={Math.max(6, Math.min(20, list.length + 2))}
        style={{
          ...inputStyle,
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.6,
          resize: "vertical",
          minHeight: 140,
        }}
        placeholder={"https://example.com/feed.xml\nhttps://example.com/rss"}
      />

      <div style={{ fontSize: 12, color: "#5a6188", marginTop: 6 }}>
        {list.length} 件
        {invalidCount > 0 && (
          <span style={{ color: "#ffb8c0", marginLeft: 8 }}>
            ({invalidCount} 件が URL 形式不正)
          </span>
        )}
      </div>

      {list.length === 0 && (
        <div style={{ fontSize: 12, color: "#ffb8c0", marginTop: 8 }}>
          URL が 0 件です。番組生成は空結果となり、次の番組は作られません。
        </div>
      )}

      {probes && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#8a93b8",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            取得結果
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {probes.map((p, i) => (
              <li
                key={`${p.url}-${i}`}
                style={{
                  fontSize: 12,
                  color: p.status === "ok" ? "#cbd2ee" : "#ffb8c0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  padding: "6px 8px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  style={{
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                    fontSize: 11,
                    color: "#8a93b8",
                    wordBreak: "break-all",
                  }}
                >
                  {p.url}
                </span>
                {p.status === "ok" ? (
                  <span>
                    OK · {p.title ?? "(無題)"}
                    {typeof p.itemCount === "number" && ` · ${p.itemCount} 件`}
                  </span>
                ) : (
                  <span>NG · {p.error ?? "不明なエラー"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
