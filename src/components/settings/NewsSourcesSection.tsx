import { useMemo } from "react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  SourceCategorySchema,
  type SourceCategory,
} from "@/lib/news/types";
import type { SourceOption } from "@/server/settings";
import {
  btnStyle,
  cardStyle,
  categoryLabelStyle,
  sectionStyle,
  sourceGroupStyle,
  sourceItemStyle,
} from "./styles";

type Props = {
  sources: SourceOption[];
  enabledSources: string[] | null;
  onChange: (next: string[] | null) => void;
};

export function NewsSourcesSection({
  sources,
  enabledSources,
  onChange,
}: Props) {
  const sourcesByCategory = useMemo(() => {
    const map: Record<SourceCategory, SourceOption[]> = {
      japanese: [],
      tech: [],
      overseas: [],
      hatena: [],
    };
    for (const s of sources) {
      const cat = SourceCategorySchema.safeParse(s.category);
      if (cat.success) map[cat.data].push(s);
    }
    return map;
  }, [sources]);

  const enabledSet = useMemo(
    () => new Set(enabledSources ?? sources.map((s) => s.id)),
    [enabledSources, sources],
  );
  const isAllEnabled = enabledSources === null;

  const commit = (next: Set<string>) => {
    if (next.size === sources.length) {
      onChange(null);
    } else {
      onChange(sources.filter((s) => next.has(s.id)).map((s) => s.id));
    }
  };

  const toggleSource = (id: string) => {
    const next = new Set(enabledSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    commit(next);
  };

  const toggleCategory = (cat: SourceCategory) => {
    const inCat = sourcesByCategory[cat].map((s) => s.id);
    const allOn = inCat.every((id) => enabledSet.has(id));
    const next = new Set(enabledSet);
    if (allOn) for (const id of inCat) next.delete(id);
    else for (const id of inCat) next.add(id);
    commit(next);
  };

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
        <h2 style={{ ...sectionStyle, marginBottom: 0 }}>ニュースソース</h2>
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={isAllEnabled}
          style={{ ...btnStyle(), opacity: isAllEnabled ? 0.4 : 1 }}
        >
          全件に戻す
        </button>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = sourcesByCategory[cat];
        if (list.length === 0) return null;
        const onCount = list.filter((s) => enabledSet.has(s.id)).length;
        const allOn = onCount === list.length;
        const someOn = onCount > 0 && onCount < list.length;
        return (
          <div key={cat} style={{ marginBottom: 18 }}>
            <label style={categoryLabelStyle}>
              <input
                type="checkbox"
                checked={allOn}
                ref={(el) => {
                  if (el) el.indeterminate = someOn;
                }}
                onChange={() => toggleCategory(cat)}
              />
              <span style={{ color: "#cbd2ee", fontSize: 14 }}>
                {CATEGORY_LABELS[cat]}
              </span>
              <span style={{ color: "#5a6188", fontSize: 12 }}>
                ({onCount}/{list.length})
              </span>
            </label>
            <div style={sourceGroupStyle}>
              {list.map((s) => (
                <label key={s.id} style={sourceItemStyle}>
                  <input
                    type="checkbox"
                    checked={enabledSet.has(s.id)}
                    onChange={() => toggleSource(s.id)}
                  />
                  <span style={{ fontSize: 13, color: "#cbd2ee" }}>
                    {s.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {enabledSet.size === 0 && (
        <div style={{ fontSize: 12, color: "#ffb8c0", marginTop: 8 }}>
          すべてのソースが OFF です。番組生成は空結果となり、次の番組は作られません。
        </div>
      )}
    </section>
  );
}
