import type { Project, Item } from "../models/project";
export type Point = { id: string; x: number; y: number; label: string };
export type Curve = {
  id: string;
  a: number;
  b: number;
  label: string;
  color: string;
};
export type Region = {
  id: string;
  label: string;
  points: number[][];
  color: string;
};
export type AxisPoint = {
  id: string;
  axis: "x" | "y";
  value: number;
  label: string;
  point?: Point;
};
export const value = (c: Curve, x: number) => c.a + c.b * x;
export function intersect(u: Curve, v: Curve): { x: number; y: number } | null {
  if (Math.abs(u.b - v.b) < 1e-9) return null;
  const x = (v.a - u.a) / (u.b - v.b);
  return { x, y: value(u, x) };
}
export function build(p: Project) {
  const curves: Curve[] = [
    { id: "demand", a: p.a, b: -p.b, label: "D", color: "#D46A00" },
    { id: "supply", a: p.c, b: p.d, label: "S", color: "#0877D1" },
  ];
  const points: Point[] = [],
    regions: Region[] = [],
    axis: AxisPoint[] = [],
    warnings: string[] = [],
    notes: string[] = [];
  const D = curves[0],
    S = curves[1];
  const e = intersect(D, S)!;
  const point = (
    id: string,
    x: number,
    y: number,
    label: string,
    xLabel?: string,
    yLabel?: string,
  ) => {
    const pt = { id, x, y, label };
    points.push(pt);
    if (xLabel)
      axis.push({
        id: `${id}-x`,
        axis: "x",
        value: x,
        label: xLabel,
        point: pt,
      });
    if (yLabel)
      axis.push({
        id: `${id}-y`,
        axis: "y",
        value: y,
        label: yLabel,
        point: pt,
      });
    return pt;
  };
  const region = (id: string, label: string, pts: number[][], color: string) =>
    regions.push({ id, label, points: pts, color });
  point("eq", e.x, e.y, "E₁", "Q₁", "P₁");
  if (e.x <= 0 || e.y < 0) {
    warnings.push(
      "These parameters do not produce a positive market equilibrium. Adjust the intercepts.",
    );
  } else if (p.template === "market" || p.template === "surplus") {
    region(
      "cs",
      "Consumer surplus",
      [
        [0, p.a],
        [0, e.y],
        [e.x, e.y],
      ],
      "#0877D1",
    );
    region(
      "ps",
      "Producer surplus",
      [
        [0, p.c],
        [0, e.y],
        [e.x, e.y],
      ],
      "#D46A00",
    );
    if (p.showShift) {
      const d2 = { ...D, id: "demand2", a: D.a + p.shiftD, label: "D₂" },
        s2 = { ...S, id: "supply2", a: S.a + p.shiftS, label: "S₂" };
      if (p.shiftD) curves.push(d2);
      if (p.shiftS) curves.push(s2);
      const e2 = intersect(d2, s2)!;
      point("eq2", e2.x, e2.y, "E₂", "Q₂", "P₂");
    }
  } else if (p.template === "tax" || p.template === "subsidy") {
    const tax = p.template === "tax",
      adj = {
        ...S,
        id: "policy",
        a: S.a + (tax ? p.amount : -p.amount),
        label: tax ? "S + tax" : "S − subsidy",
        color: "#15803D",
      };
    curves.push(adj);
    const q = intersect(D, adj)!.x,
      pc = value(D, q),
      pp = value(S, q);
    point("consumer", q, pc, "E₂", "Q₂", "P꜀");
    point("producer", q, pp, "", "", "Pₚ");
    if (q > 0 && pc >= 0) {
      region(
        "budget",
        tax ? "Government revenue" : "Government expenditure",
        [
          [0, pc],
          [q, pc],
          [q, pp],
          [0, pp],
        ],
        "#15803D",
      );
      region(
        "loss",
        "Welfare loss",
        [
          [e.x, e.y],
          [q, pc],
          [q, pp],
        ],
        "#D97706",
      );
      region(
        "consumer-share",
        tax ? "Consumer tax burden" : "Consumer benefit rectangle",
        [
          [0, e.y],
          [q, e.y],
          [q, pc],
          [0, pc],
        ],
        "#0877D1",
      );
      region(
        "producer-share",
        tax ? "Producer tax burden" : "Producer benefit rectangle",
        [
          [0, e.y],
          [q, e.y],
          [q, pp],
          [0, pp],
        ],
        "#9333EA",
      );
      notes.push(
        `${tax ? "Tax" : "Subsidy"} wedge: ${p.amount.toFixed(2)} · ${tax ? "Revenue" : "Expenditure"}: ${(q * p.amount).toFixed(2)} model units`,
      );
    } else
      warnings.push(
        "The intervention produces an invalid interior outcome. Reduce its size.",
      );
  } else if (p.template === "externality") {
    const prod = p.externality.includes("production"),
      neg = p.externality.startsWith("negative");
    D.label = prod ? "MPB = MSB" : "MPB";
    S.label = prod ? "MPC" : "MPC = MSC";
    const social: Curve = prod
      ? {
          ...S,
          id: "social",
          a: S.a + (neg ? p.amount : -p.amount),
          label: "MSC",
          color: "#15803D",
        }
      : {
          ...D,
          id: "social",
          a: D.a + (neg ? -p.amount : p.amount),
          label: "MSB",
          color: "#15803D",
        };
    curves.push(social);
    const msb = prod ? D : social,
      msc = prod ? social : S,
      o = intersect(msb, msc)!;
    point("opt", o.x, o.y, "E*", "Q*", "P*");
    region(
      "loss",
      "Welfare loss",
      [
        [o.x, o.y],
        [e.x, value(msb, e.x)],
        [e.x, value(msc, e.x)],
      ],
      "#D97706",
    );
    if (p.correction) {
      const corrected = {
        ...S,
        id: "corrective",
        a: S.a + (neg ? p.amount : -p.amount),
        label: neg ? "MPC + tax" : "MPC − subsidy",
        color: "#9333EA",
      };
      curves.push(corrected);
      const ce = intersect(D, corrected)!;
      point("corrected", ce.x, ce.y, "Eᶜ", undefined, "Pᶜ");
    }
  } else if (p.template === "control") {
    curves.push({
      id: "control",
      a: p.price,
      b: 0,
      label: p.control === "ceiling" ? "Price ceiling" : "Price floor",
      color: "#15803D",
    });
    const bind = p.control === "ceiling" ? p.price < e.y : p.price > e.y;
    if (bind) {
      const qs = (p.price - p.c) / p.d,
        qd = (p.a - p.price) / p.b;
      if (qs < 0 || qd < 0)
        warnings.push(
          "The controlled price is outside the interior range of this linear model.",
        );
      else {
        point("qs", qs, p.price, "", "Qₛ", "Pᶜ");
        point("qd", qd, p.price, "", "Qd");
        notes.push(
          `${p.control === "ceiling" ? "Shortage" : "Surplus"}: ${Math.abs(qd - qs).toFixed(2)} model units`,
        );
      }
    } else notes.push("Non-binding control: the market clears at E₁.");
  }
  p.extraCurves.forEach((c) => curves.push({ ...c, color: "#9333EA" }));
  points.forEach((pt) => {
    if (pt.x < 0 || pt.y < 0 || pt.x > p.xMax || pt.y > p.yMax)
      warnings.push(
        `${pt.label || pt.id} is outside the visible positive axes. Change the model or axis ranges.`,
      );
  });
  return { curves, points, regions, axis, warnings, notes };
}
export type Model = ReturnType<typeof build>;
export function resolveItem(
  item: Item,
  m: Model,
): { x: number; y: number } | null {
  if (item.link) {
    const source = m.points.find((p) => p.id === item.link);
    return source ? { x: source.x, y: source.y } : null;
  }
  if (item.curve) {
    const c = m.curves.find((c) => c.id === item.curve);
    return c ? { x: item.x, y: value(c, item.x) } : null;
  }
  return { x: item.x, y: item.y };
}
export function clipCurve(c: Curve, xMax: number, yMax: number) {
  const candidates = [
    [0, c.a],
    [xMax, value(c, xMax)],
  ];
  if (c.b !== 0) candidates.push([-c.a / c.b, 0], [(yMax - c.a) / c.b, yMax]);
  return candidates
    .filter(
      ([x, y]) =>
        x >= -1e-8 && x <= xMax + 1e-8 && y >= -1e-8 && y <= yMax + 1e-8,
    )
    .filter(
      (p, i, a) =>
        a.findIndex(
          (q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) < 1e-7,
        ) === i,
    )
    .sort((a, b) => a[0] - b[0]);
}
