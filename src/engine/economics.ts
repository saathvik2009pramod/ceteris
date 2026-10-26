import type { Project, Item } from "../models/project";
export type Point = { id: string; x: number; y: number; label: string };
export type Curve = {
  id: string;
  a: number;
  b: number;
  label: string;
  color: string;
  path?: [number, number][];
  vertical?: number;
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
export function value(c: Curve, x: number): number {
  if (!c.path) return c.a + c.b * x;
  const pts = c.path;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1],
      [x1, y1] = pts[i];
    if (x >= x0 && x <= x1 && x1 > x0)
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return NaN;
}
export function intersect(u: Curve, v: Curve): { x: number; y: number } | null {
  if (Math.abs(u.b - v.b) < 1e-9) return null;
  const x = (v.a - u.a) / (u.b - v.b);
  return { x, y: value(u, x) };
}
export type Model = {
  curves: Curve[];
  points: Point[];
  regions: Region[];
  axis: AxisPoint[];
  warnings: string[];
  notes: string[];
};
export function build(p: Project): Model {
  if (["ppc", "money", "adas"].includes(p.template)) return buildSpecial(p);
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
  } else if (p.template === "trade") {
    const pw = p.worldPrice,
      pe = e.y;
    curves.push({ id: "world", a: pw, b: 0, label: "Pw", color: "#6B7263" });
    const qs = Math.max(0, (pw - p.c) / p.d),
      qd = Math.max(0, (p.a - pw) / p.b);
    point("free-s", qs, pw, "", "Qₛ", "Pw");
    point("free-d", qd, pw, "", "Qd");
    const imports = Math.max(0, qd - qs),
      exports = Math.max(0, qs - qd);
    notes.push(
      `Free trade: ${imports > 0 ? "imports " + imports.toFixed(2) : exports > 0 ? "exports " + exports.toFixed(2) : "no trade"} model units.`,
    );
    if (p.tradeMode !== "free" && imports <= 0) {
      notes.push(
        "Import protection does not bind in an exporting or no-trade market.",
      );
    } else if (p.tradeMode !== "free") {
      // Small price-taking economy. A prohibitive restriction cannot raise price above autarky.
      const quotaPrice =
        p.a - p.b * p.quota <= p.c
          ? p.a - p.b * p.quota
          : (p.a / p.b + p.c / p.d - p.quota) / (1 / p.b + 1 / p.d);
      const domestic =
        p.tradeMode === "tariff"
          ? Math.min(pe, pw + p.tariff)
          : Math.max(pw, Math.min(pe, quotaPrice));
      const s2 = Math.max(0, (domestic - p.c) / p.d),
        d2 = Math.max(0, (p.a - domestic) / p.b),
        remaining = Math.max(0, d2 - s2),
        wedge = domestic - pw;
      if (wedge > 1e-8) {
        curves.push({
          id: "trade-policy",
          a: domestic,
          b: 0,
          label: p.tradeMode === "tariff" ? "Pw + t" : "P quota",
          color: "#973F35",
        });
        point("protected-s", s2, domestic, "", "Qₛ₂", "P₂");
        point("protected-d", d2, domestic, "", "Qd₂");
        if (remaining > 1e-8)
          region(
            "trade-revenue",
            p.tradeMode === "tariff" ? "Tariff revenue" : "Quota rents",
            [
              [s2, pw],
              [d2, pw],
              [d2, domestic],
              [s2, domestic],
            ],
            "#71816B",
          );
        if (s2 > qs)
          region(
            "production-loss",
            "Production loss",
            [
              [qs, pw],
              [s2, pw],
              [s2, domestic],
              [qs, Math.max(pw, p.c)],
            ],
            "#BD8B56",
          );
        region(
          "consumption-loss",
          "Consumption loss",
          [
            [d2, pw],
            [qd, pw],
            [d2, domestic],
          ],
          "#973F35",
        );
        notes.push(
          `Protected price: ${domestic.toFixed(2)} · Imports: ${remaining.toFixed(2)} · ${p.tradeMode === "tariff" ? "Tariff revenue" : "Quota rents"}: ${(remaining * wedge).toFixed(2)}.`,
        );
        if (remaining < 1e-8)
          notes.push(
            "Prohibitive restriction: imports fall to zero and the domestic price reaches autarky.",
          );
      } else
        notes.push(
          "Non-binding restriction: domestic price and imports remain at free-trade levels.",
        );
      if (p.tradeMode === "quota")
        notes.push(
          "Quota rents accrue to licence holders; they are government revenue only if the licences are auctioned.",
        );
    }
    notes.push(
      "Small-country model: a fixed world price, competitive domestic markets and no transport costs.",
    );
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
        point(
          "qs",
          qs,
          p.price,
          "",
          "Qₛ",
          p.control === "ceiling" ? "Pᶜ" : "Pᶠ",
        );
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
    if (!c) return null;
    if (c.vertical !== undefined) return { x: c.vertical, y: item.y };
    // A point on the vertical Keynesian segment keeps its chosen height.
    if (c.path && item.x >= c.path[c.path.length - 1][0]) {
      const last = c.path[c.path.length - 1],
        before = c.path[c.path.length - 2];
      if (last[0] === before[0])
        return { x: last[0], y: Math.max(before[1], item.y) };
    }
    const y = value(c, item.x);
    return Number.isFinite(y) ? { x: item.x, y } : null;
  }
  return { x: item.x, y: item.y };
}
export function clipCurve(c: Curve, xMax: number, yMax: number) {
  if (c.vertical !== undefined)
    return c.vertical >= 0 && c.vertical <= xMax
      ? [
          [c.vertical, 0],
          [c.vertical, yMax],
        ]
      : [];
  if (c.path) {
    const result: number[][] = [];
    for (let i = 1; i < c.path.length; i++) {
      const [x, y] = c.path[i - 1],
        dx = c.path[i][0] - x,
        dy = c.path[i][1] - y;
      let lo = 0,
        hi = 1;
      const edges = [
        [-dx, x],
        [dx, xMax - x],
        [-dy, y],
        [dy, yMax - y],
      ];
      let outside = false;
      for (const [direction, distance] of edges) {
        if (direction === 0) {
          if (distance < 0) outside = true;
        } else if (direction < 0) lo = Math.max(lo, distance / direction);
        else hi = Math.min(hi, distance / direction);
      }
      if (!outside && lo <= hi) {
        for (const t of [lo, hi]) {
          const pt = [x + t * dx, y + t * dy],
            previous = result[result.length - 1];
          if (
            !previous ||
            Math.hypot(pt[0] - previous[0], pt[1] - previous[1]) > 1e-8
          )
            result.push(pt);
        }
      }
    }
    return result;
  }
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

function buildSpecial(p: Project): Model {
  const m: Model = {
    curves: [],
    points: [],
    regions: [],
    axis: [],
    warnings: [],
    notes: [],
  };
  const point = (
    id: string,
    x: number,
    y: number,
    label: string,
    xl: string,
    yl: string,
  ) => {
    const pt = { id, x, y, label };
    m.points.push(pt);
    m.axis.push({ id: id + "-x", axis: "x", value: x, label: xl, point: pt });
    m.axis.push({ id: id + "-y", axis: "y", value: y, label: yl, point: pt });
  };
  const curve = (
    id: string,
    a: number,
    b: number,
    label: string,
    color: string,
    shape: Partial<Curve> = {},
  ) => {
    const c = { id, a, b, label, color, ...shape };
    m.curves.push(c);
    return c;
  };
  const orange = "#D46A00",
    blue = "#0877D1";
  if (p.template === "ppc") {
    const frontier = (factor: number): [number, number][] =>
      p.ppcShape === "straight"
        ? [
            [0, p.capacityY * factor],
            [p.capacityX * factor, 0],
          ]
        : Array.from({ length: 121 }, (_, i) => {
            const angle = (i * Math.PI) / 240;
            return [
              p.capacityX * factor * Math.sin(angle),
              p.capacityY * factor * Math.cos(angle),
            ];
          });
    const base = curve(
      "ppc",
      p.capacityY,
      -p.capacityY / p.capacityX,
      "PPC₁",
      blue,
      { path: frontier(1) },
    );
    const x = p.capacityX * p.productionShare;
    point("production", x, value(base, x), "A", "X₁", "Y₁");
    m.regions.push({
      id: "feasible",
      label: "Attainable Production",
      points: [[0, 0], ...base.path!],
      color: blue,
    });
    if (p.showShift) {
      const factor = 1 + p.ppcGrowth / 100;
      const shifted = curve(
        "ppc2",
        p.capacityY * factor,
        base.b,
        "PPC₂",
        orange,
        { path: frontier(factor) },
      );
      const nx = x * factor;
      if (Math.abs(factor - 1) > 1e-8)
        point("production2", nx, value(shifted, nx), "B", "X₂", "Y₂");
    }
  } else if (p.template === "money") {
    curve("money-demand", p.a, -p.b, "MD₁", orange);
    curve("money-supply", 0, 0, "MS₁", blue, { vertical: p.moneySupply });
    point("eq", p.moneySupply, p.a - p.b * p.moneySupply, "E₁", "M₁", "IR₁");
    if (p.showShift) {
      const quantity = Math.max(0, p.moneySupply + p.shiftS);
      if (p.moneySupply + p.shiftS < 0)
        m.warnings.push(
          "money supply cannot be negative; the shifted supply is set to zero.",
        );
      if (p.shiftD) curve("money-demand2", p.a + p.shiftD, -p.b, "MD₂", orange);
      if (p.shiftS)
        curve("money-supply2", 0, 0, "MS₂", blue, { vertical: quantity });
      if (p.shiftD || p.shiftS)
        point(
          "eq2",
          quantity,
          p.a + p.shiftD - p.b * quantity,
          "E₂",
          "M₂",
          "IR₂",
        );
    }
    if (m.points.some((pt) => pt.y < 0))
      m.warnings.push(
        "these settings imply a negative interest rate. adjust money demand or supply to bring the intersection into view.",
      );
  } else {
    const yf = p.fullEmployment;
    curve("ad", p.a, -p.b, "AD₁", orange);
    // The Keynesian curve has horizontal, rising and vertical sections.
    // Intersections are solved against the actual section being drawn.
    const solveKeynesian = (intercept: number, supplyShift: number) => {
      const knee = yf * p.keynesianKnee,
        floor = p.keynesianFloor + supplyShift;
      const slope = p.keynesianRise / (yf - knee),
        top = floor + p.keynesianRise;
      const horizontalX = (intercept - floor) / p.b;
      if (horizontalX <= knee) return { x: horizontalX, y: floor };
      const risingX = (intercept - floor + slope * knee) / (p.b + slope);
      if (risingX <= yf)
        return { x: risingX, y: floor + slope * (risingX - knee) };
      return { x: yf, y: Math.max(top, intercept - p.b * yf) };
    };
    const addSupply = (id: string, shift: number, label: string) => {
      if (p.adasModel === "monetarist")
        return curve(id, p.c + shift, p.d, label, blue);
      const floor = p.keynesianFloor + shift,
        top = floor + p.keynesianRise;
      return curve(id, floor, 0, label, blue, {
        path: [
          [0, floor],
          [yf * p.keynesianKnee, floor],
          [yf, top],
          [yf, Math.max(p.yMax, top + 10)],
        ],
      });
    };
    addSupply("as", 0, p.adasModel === "keynesian" ? "AS₁" : "SRAS₁");
    if (p.adasModel === "monetarist")
      curve("lras", 0, 0, "LRAS", "#59634E", { vertical: yf });
    const equilibrium = (ad: number, shift: number) =>
      p.adasModel === "keynesian"
        ? solveKeynesian(ad, shift)
        : {
            x: (ad - p.c - shift) / (p.b + p.d),
            y: (ad * p.d + (p.c + shift) * p.b) / (p.b + p.d),
          };
    const e = equilibrium(p.a, 0);
    point(
      "eq",
      e.x,
      e.y,
      "E₁",
      Math.abs(e.x - yf) < 1e-8 ? "Y₁ = Yf" : "Y₁",
      "PL₁",
    );
    let shiftedAtFull = false;
    if (p.showShift && (p.shiftD || p.shiftS)) {
      if (p.shiftD) curve("ad2", p.a + p.shiftD, -p.b, "AD₂", orange);
      if (p.shiftS)
        addSupply(
          "as2",
          p.shiftS,
          p.adasModel === "keynesian" ? "AS₂" : "SRAS₂",
        );
      const e2 = equilibrium(p.a + p.shiftD, p.shiftS);
      shiftedAtFull = Math.abs(e2.x - yf) < 1e-8;
      point("eq2", e2.x, e2.y, "E₂", shiftedAtFull ? "Y₂ = Yf" : "Y₂", "PL₂");
    }
    if (Math.abs(e.x - yf) > 1e-8 && !shiftedAtFull)
      m.axis.push({
        id: "full-employment",
        axis: "x",
        value: yf,
        label: "Yf",
        point: { id: "capacity", x: yf, y: 0, label: "" },
      });
  }
  // Share a label when two model points project onto exactly the same coordinate.
  m.axis = m.axis.reduce<AxisPoint[]>((items, a) => {
    const same = items.find(
      (b) => b.axis === a.axis && Math.abs(b.value - a.value) < 1e-8,
    );
    if (same)
      same.label = [
        ...new Set([...same.label.split(" = "), ...a.label.split(" = ")]),
      ].join(" = ");
    else items.push({ ...a });
    return items;
  }, []);
  p.extraCurves.forEach((c) => m.curves.push({ ...c, color: "#9333EA" }));
  m.points.forEach((pt) => {
    if (pt.x < 0 || pt.y < 0 || pt.x > p.xMax || pt.y > p.yMax)
      m.warnings.push(
        `${pt.label} is outside the graph. adjust the model or increase the axis range.`,
      );
  });
  return m;
}
