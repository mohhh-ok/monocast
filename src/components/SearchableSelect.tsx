import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type SearchableOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  // true: 入力したテキストをそのまま値として採用する（datalist 相当）。
  // false: options から選ばれた値だけが採用される（select 相当）。
  freeInput?: boolean;
  placeholder?: string;
  // 外枠 div に当てる style。flex 配置などはこちらで。
  style?: CSSProperties;
  // 入力欄に当てる style。未指定なら既定スタイル。
  inputStyle?: CSSProperties;
  // ドロップダウン各行の右端に追加 UI を描画する。試聴ボタン等に使う。
  // この要素をクリックしても commit は走らない（mousedown を内部で stopPropagation する）。
  renderRowAction?: (value: string) => ReactNode;
};

const DEFAULT_INPUT_STYLE: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--radio-line-faint)",
  borderRadius: 6,
  color: "var(--cream)",
  fontSize: 14,
  fontFamily: "inherit",
};

export function SearchableSelect({
  value,
  options,
  onChange,
  freeInput = false,
  placeholder,
  style,
  inputStyle,
  renderRowAction,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const blurTimerRef = useRef<number | null>(null);

  const selectedLabel = useMemo(() => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  }, [options, value]);

  const filtered = useMemo(() => {
    if (!open || query.length === 0) return options;
    const scored = options
      .map((opt) => ({ opt, score: subsequenceScore(query, opt.label) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.opt);
  }, [options, open, query]);

  useEffect(() => {
    setHighlight(0);
  }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlight];
    if (el && el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [highlight, open]);

  const commit = useCallback(
    (opt: SearchableOption | null) => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      if (opt) onChange(opt.value);
      else if (freeInput) onChange(query);
      setOpen(false);
      setQuery("");
    },
    [freeInput, onChange, query],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) =>
        filtered.length === 0 ? 0 : Math.min(h + 1, filtered.length - 1),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (filtered[highlight]) commit(filtered[highlight]);
      else if (freeInput) commit(null);
    } else if (e.key === "Escape") {
      if (!open) return;
      e.preventDefault();
      setOpen(false);
      setQuery("");
    }
  };

  const display = open ? query : selectedLabel;

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <input
        type="text"
        value={display}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          // ドロップダウンの mousedown→commit より後に閉じる
          blurTimerRef.current = window.setTimeout(() => {
            blurTimerRef.current = null;
            if (freeInput && query.length > 0) onChange(query);
            setOpen(false);
            setQuery("");
          }, 120);
        }}
        style={{ ...DEFAULT_INPUT_STYLE, ...inputStyle }}
      />
      {open && filtered.length > 0 && (
        <ul ref={listRef} style={dropdownStyle}>
          {filtered.map((opt, i) => (
            <li
              key={opt.value}
              onMouseDown={(e) => {
                e.preventDefault();
                commit(opt);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                ...optionStyle,
                background:
                  i === highlight ? "rgba(255, 182, 72, 0.12)" : "transparent",
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {opt.label}
              </span>
              {renderRowAction && (
                <span
                  onMouseDown={(e) => {
                    // 行の commit を抑止して action 側の onClick だけ走らせる
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0, display: "inline-flex", alignItems: "center" }}
                >
                  {renderRowAction(opt.value)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const dropdownStyle: CSSProperties = {
  position: "absolute",
  top: "100%",
  left: 0,
  right: 0,
  zIndex: 20,
  marginTop: 4,
  maxHeight: 240,
  overflowY: "auto",
  background: "var(--radio-panel)",
  border: "1px solid var(--radio-line)",
  borderRadius: 6,
  padding: 4,
  margin: 0,
  listStyle: "none",
  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
};

const optionStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 4,
  fontSize: 13,
  color: "var(--cream)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

// クエリの各文字が、対象に出現順で含まれていればマッチ。
// 連続マッチ・先頭一致・単語境界にボーナス。完全部分文字列は高スコア。
function subsequenceScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) {
    // 部分文字列を含む方が「より明確な一致」。位置が前ほど高スコア
    const idx = t.indexOf(q);
    return 1000 - idx + q.length * 2;
  }
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let lastMatchIdx = -2;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      let bonus = 1;
      if (ti === 0) bonus += 5;
      if (ti === lastMatchIdx + 1) {
        consecutive++;
        bonus += consecutive * 2;
      } else {
        consecutive = 0;
      }
      if (ti > 0 && /[\s_\-./()]/.test(t[ti - 1])) bonus += 3;
      score += bonus;
      lastMatchIdx = ti;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  return score + 100 / (1 + t.length);
}
