import { useRef, type RefObject, type PointerEvent } from "react";
import { type Project } from "../models/project";
import { build, clipCurve, resolveItem, value } from "../engine/economics";
const X = 140,
  Y = 600,
  W = 620,
  H = 480;
export function Diagram({
  p,
  onChange,
  onCheckpoint,
  selected,
  onSelect,
  svgRef,
}: {
  p: Project;
  onChange: (p: Project, history?: boolean) => void;
  onCheckpoint: () => void;
  selected: string;
  onSelect: (id: string) => void;
  svgRef: RefObject<SVGSVGElement | null>;
}) {
  const m = build(p),
    sx = (x: number) => X + (x / p.xMax) * W,
    sy = (y: number) => Y - (y / p.yMax) * H;
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    coordinate: boolean;
  } | null>(null);
  const local = (e: PointerEvent) => {
    const pt = new DOMPoint(e.clientX, e.clientY);
    return pt.matrixTransform(svgRef.current!.getScreenCTM()!.inverse());
  };
  const start = (e: PointerEvent, id: string, coordinate = false) => {
    e.stopPropagation();
    onSelect(id);
    onCheckpoint();
    const pt = local(e),
      it = p.items.find((x) => x.id === id);
    drag.current = {
      id,
      startX: pt.x,
      startY: pt.y,
      dx: it?.dx ?? p.labels[id]?.dx ?? 0,
      dy: it?.dy ?? p.labels[id]?.dy ?? 0,
      coordinate,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const pt = local(e),
      dx = pt.x - d.startX,
      dy = pt.y - d.startY;
    const it = p.items.find((x) => x.id === d.id);
    if (it) {
      onChange(
        {
          ...p,
          items: p.items.map((x) =>
            x.id !== it.id
              ? x
              : d.coordinate
                ? {
                    ...x,
                    x: Math.max(0, Math.min(p.xMax, ((pt.x - X) / W) * p.xMax)),
                    y: Math.max(0, Math.min(p.yMax, ((Y - pt.y) / H) * p.yMax)),
                  }
                : { ...x, dx: d.dx + dx, dy: d.dy + dy },
          ),
        },
        false,
      );
    } else
      onChange(
        {
          ...p,
          labels: {
            ...p.labels,
            [d.id]: { ...p.labels[d.id], dx: d.dx + dx, dy: d.dy + dy },
          },
        },
        false,
      );
  };
  const label = (
    id: string,
    text: string,
    x: number,
    y: number,
    anchor: "start" | "middle" | "end" = "middle",
    color = "#111827",
    rotation = 0,
    size = p.font,
  ) => {
    const o = p.labels[id] || {};
    if (o.hidden) return null;
    const px = x + (o.dx || 0),
      py = y + (o.dy || 0);
    return (
      <g key={id}>
        {selected === id && (
          <rect
            data-editor="true"
            x={px - 35}
            y={py - size}
            width={70}
            height={size + 8}
            fill="#0877d115"
            stroke="#0877D1"
          />
        )}
        <text
          data-label={id}
          x={px}
          y={py}
          textAnchor={anchor}
          fill={o.color || color}
          fontSize={o.size || size}
          transform={rotation ? `rotate(${rotation},${px},${py})` : undefined}
          onPointerDown={(e) => start(e, id)}
          style={{ cursor: "move", touchAction: "none" }}
        >
          {o.text ?? text}
        </text>
      </g>
    );
  };
  const valid = (pt: { x: number; y: number }) =>
    pt.x >= 0 && pt.y >= 0 && pt.x <= p.xMax && pt.y <= p.yMax;
  const poly = (pts: number[][]) =>
    pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
  const ticks = Array.from(
    { length: Math.min(100, Math.floor(Math.max(p.xMax, p.yMax) / p.tick)) },
    (_, i) => (i + 1) * p.tick,
  );
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 900 720"
      role="img"
      aria-label={p.title}
      fontFamily={p.fontFamily + ", sans-serif"}
      onPointerMove={move}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onPointerDown={() => onSelect("")}
    >
      <rect data-background="true" width="900" height="720" fill="white" />
      <defs>
        <clipPath id="plot">
          <rect x={X} y={Y - H} width={W} height={H} />
        </clipPath>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6" fill="none" stroke="context-stroke" />
        </marker>
        {m.regions.map((r, i) => (
          <pattern
            key={r.id}
            id={"hatch-" + r.id}
            width={7 + i * 2}
            height={7 + i * 2}
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${i % 2 ? 45 : -45})`}
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="12"
              stroke={p.monochrome ? "#555" : p.regions[r.id]?.color || r.color}
              strokeWidth="1"
            />
          </pattern>
        ))}
      </defs>
      {p.grid && (
        <g stroke="#e5e7eb" clipPath="url(#plot)">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={Y - H} y2={Y} />
              <line x1={X} x2={X + W} y1={sy(t)} y2={sy(t)} />
            </g>
          ))}
        </g>
      )}
      <g clipPath="url(#plot)">
        {p.shade &&
          m.regions.map((r) => {
            const o = p.regions[r.id] || {};
            if (o.visible === false || (!o.visible && r.id.endsWith("-share")))
              return null;
            return (
              <polygon
                key={r.id}
                points={poly(r.points)}
                fill={
                  p.monochrome || o.hatch
                    ? `url(#hatch-${r.id})`
                    : o.color || r.color
                }
                fillOpacity={p.monochrome || o.hatch ? 0.7 : p.opacity}
              />
            );
          })}
      </g>
      <g stroke="#111" strokeWidth="2" fill="none">
        <path d={`M${X},${Y - H} V${Y} H${X + W}`} />
        {p.arrows && (
          <>
            <path
              d={`M${X - 5},${Y - H + 8} L${X},${Y - H} L${X + 5},${Y - H + 8}`}
            />
            <path
              d={`M${X + W - 8},${Y - 5} L${X + W},${Y} L${X + W - 8},${Y + 5}`}
            />
          </>
        )}
      </g>
      {p.ticks &&
        ticks.map((t) => (
          <g key={t} fill="#6b7280" fontSize="12">
            {t <= p.xMax && (
              <>
                <line x1={sx(t)} x2={sx(t)} y1={Y} y2={Y + 5} stroke="#999" />
                <text x={sx(t)} y={Y + 45} textAnchor="middle">
                  {t}
                </text>
              </>
            )}
            {t <= p.yMax && (
              <text x={X - 58} y={sy(t) + 4} textAnchor="end">
                {t}
              </text>
            )}
          </g>
        ))}
      {p.projection && (
        <g stroke="#888" strokeDasharray="5 5" strokeWidth="1.2">
          {m.axis
            .filter((a) => valid(a.point!))
            .map((a) => (
              <line
                key={a.id}
                x1={a.axis === "x" ? sx(a.value) : X}
                y1={a.axis === "x" ? Y : sy(a.value)}
                x2={sx(a.point!.x)}
                y2={sy(a.point!.y)}
              />
            ))}
        </g>
      )}
      {m.curves.map((c, i) => {
        const o = p.curves[c.id] || {},
          ends = clipCurve(c, p.xMax, p.yMax);
        if (o.hidden || ends.length < 2) return null;
        const last = ends[ends.length - 1],
          color = p.monochrome ? "#111" : o.color || c.color;
        return (
          <g key={c.id}>
            <polyline
              data-curve={c.id}
              points={poly(ends)}
              fill="none"
              strokeLinejoin="round"
              stroke={color}
              strokeWidth={o.width || p.line}
              strokeDasharray={
                o.dash || (p.monochrome && i % 2) ? "8 5" : undefined
              }
            />
            {label(
              "curve-" + c.id,
              (o.label ?? c.label) +
                (o.equation && !c.path
                  ? c.vertical !== undefined
                    ? ` (${p.template === "money" ? "M" : "Y"} = ${c.vertical.toFixed(1)})`
                    : ` (${c.a.toFixed(1)} ${c.b < 0 ? "−" : "+"} ${Math.abs(c.b).toFixed(2)}${p.template === "adas" ? "Y" : p.template === "money" ? "M" : "Q"})`
                  : ""),
              sx(last[0]) + 9,
              sy(last[1]) - 8,
              "start",
              color,
            )}
          </g>
        );
      })}
      {m.points.filter(valid).map((pt) => (
        <g key={pt.id}>
          <circle cx={sx(pt.x)} cy={sy(pt.y)} r="5.5" fill="#000" />
          {label(
            "point-" + pt.id,
            pt.label,
            sx(pt.x) + 14,
            sy(pt.y) - 14,
            "start",
          )}
        </g>
      ))}
      {m.axis
        .filter((a) => valid(a.point!))
        .map((a) =>
          label(
            a.id,
            a.label,
            a.axis === "x" ? sx(a.value) : X - 15,
            a.axis === "x" ? Y + 27 : sy(a.value) + 6,
            a.axis === "x" ? "middle" : "end",
          ),
        )}
      {label("title", p.title, 450, 55, "middle", "#111827", 0, 26)}
      {label("x-title", p.xTitle, X + W, Y + 85, "end")}
      {label(
        "y-title",
        p.yTitle,
        p.rotateY ? 42 : X - 15,
        p.rotateY ? Y - H / 2 : Y - H - 24,
        p.rotateY ? "middle" : "end",
        "#111827",
        p.rotateY ? -90 : 0,
      )}
      {label("origin", p.origin, X - 15, Y + 24, "end")}
      {p.shade &&
        m.regions
          .filter((r) => p.regions[r.id]?.label)
          .map((r) => {
            const centroid = r.points.reduce(
              (a, b) => [
                a[0] + b[0] / r.points.length,
                a[1] + b[1] / r.points.length,
              ],
              [0, 0],
            );
            return label(
              "region-" + r.id,
              r.label,
              sx(centroid[0]),
              sy(centroid[1]),
              "middle",
              "#374151",
              0,
              13,
            );
          })}
      {p.template === "control" &&
        m.points.some((pt) => pt.id === "qs") &&
        (() => {
          const a = m.points.find((pt) => pt.id === "qs")!,
            b = m.points.find((pt) => pt.id === "qd")!;
          return (
            <g stroke="#374151" fill="none">
              <path d={`M${sx(a.x)},${sy(a.y) - 30} v-8 H${sx(b.x)} v8`} />
              {label(
                "shortage",
                p.control === "ceiling" ? "Shortage" : "Surplus",
                (sx(a.x) + sx(b.x)) / 2,
                sy(a.y) - 46,
                "middle",
                "#374151",
                0,
                14,
              )}
            </g>
          );
        })()}
      {p.template === "trade" &&
        (() => {
          const protectedTrade = m.points.some((x) => x.id === "protected-s");
          const a = m.points.find(
            (x) => x.id === (protectedTrade ? "protected-s" : "free-s"),
          );
          const b = m.points.find(
            (x) => x.id === (protectedTrade ? "protected-d" : "free-d"),
          );
          if (!a || !b || !valid(a) || !valid(b) || Math.abs(a.x - b.x) < 1e-8)
            return null;
          const yy = sy(a.y) + 28;
          return (
            <g stroke="#59634e" fill="none">
              <path d={`M${sx(a.x)},${yy - 6}v6H${sx(b.x)}v-6`} />
              {label(
                "trade-bracket",
                a.x < b.x ? "Imports" : "Exports",
                (sx(a.x) + sx(b.x)) / 2,
                yy + 18,
                "middle",
                "#59634e",
                0,
                14,
              )}
            </g>
          );
        })()}
      {p.items
        .filter((it) => it.visible)
        .map((it) => {
          const pt = resolveItem(it, m);
          if (!pt || !valid(pt)) return null;
          const x = it.kind === "axis" && it.axis === "y" ? X : sx(pt.x),
            y = it.kind === "axis" && it.axis === "x" ? Y : sy(pt.y),
            v = it.axis === "x" ? pt.x : pt.y,
            text =
              it.mode === "value"
                ? v.toFixed(1)
                : it.mode === "both"
                  ? `${it.label} (${v.toFixed(1)})`
                  : it.label;
          return (
            <g
              key={it.id}
              fill={it.color}
              stroke={it.color}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSelect(it.id);
              }}
            >
              {it.projection && (
                <path
                  d={`M${X},${sy(pt.y)} H${sx(pt.x)} V${Y}`}
                  fill="none"
                  strokeDasharray="5 5"
                  strokeOpacity=".5"
                />
              )}
              {it.kind === "axis" && it.marker === "tick" && (
                <path
                  d={
                    it.axis === "x" ? `M${x},${y - 4} v8` : `M${x - 4},${y} h8`
                  }
                />
              )}{" "}
              {(it.kind === "axis" || it.kind === "point") && (
                <circle
                  cx={x}
                  cy={y}
                  r={it.marker === "dot" ? 5 : 10}
                  fill={it.marker === "dot" ? it.color : "transparent"}
                  stroke="none"
                  style={{
                    cursor: it.link || it.curve ? "pointer" : "grab",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => {
                    if (!it.link && !it.curve) start(e, it.id, true);
                  }}
                />
              )}
              {it.kind === "arrow" && (
                <line
                  x1={x}
                  y1={y}
                  x2={x + it.dx + 65}
                  y2={y + it.dy - 40}
                  markerEnd="url(#arrow)"
                />
              )}
              <text
                data-label={it.id}
                x={
                  x + it.dx + (it.kind === "axis" && it.axis === "y" ? -15 : 0)
                }
                y={
                  y + it.dy + (it.kind === "axis" && it.axis === "x" ? 27 : -12)
                }
                textAnchor={
                  it.kind === "axis" && it.axis === "y" ? "end" : "middle"
                }
                fontSize={p.font}
                stroke="none"
                style={{ cursor: "move", touchAction: "none" }}
                onPointerDown={(e) => start(e, it.id)}
              >
                {text}
              </text>
              {selected === it.id && (
                <circle
                  data-editor="true"
                  cx={x}
                  cy={y}
                  r="10"
                  fill="none"
                  stroke="#0877D1"
                />
              )}
            </g>
          );
        })}
    </svg>
  );
}
