import { test } from "node:test";
import assert from "node:assert/strict";
import { preset, parseProject, newItem } from "../src/models/project.ts";
import { build, intersect, resolveItem, value } from "../src/engine/economics.ts";
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("equilibrium solves both market equations", () => {
  const p = preset(),
    m = build(p),
    e = m.points[0];
  close(e.y, p.a - p.b * e.x);
  close(e.y, p.c + p.d * e.x);
});
test("tax and subsidy preserve price wedges and budget areas", () => {
  for (const type of ["tax", "subsidy"] as const) {
    const p = preset(type),
      m = build(p),
      pc = m.points.find((x) => x.id === "consumer")!,
      pp = m.points.find((x) => x.id === "producer")!;
    close(type === "tax" ? pc.y - pp.y : pp.y - pc.y, p.amount);
    close(pc.x, pp.x);
    assert.ok(m.regions.find((x) => x.id === "budget"));
  }
});
test("all externalities use social curves for optimum", () => {
  for (const externality of [
    "negative-production",
    "positive-production",
    "negative-consumption",
    "positive-consumption",
  ] as const) {
    const p = { ...preset("externality"), externality },
      m = build(p),
      e = m.points[0],
      o = m.points.find((x) => x.id === "opt")!;
    assert.equal(o.x < e.x, externality.startsWith("negative"));
    const social = m.curves.find((x) => x.id === "social")!;
    close(o.y, social.a + social.b * o.x);
  }
});
test("corrective policies achieve efficient quantity", () => {
  for (const externality of [
    "negative-production",
    "positive-production",
    "negative-consumption",
    "positive-consumption",
  ] as const) {
    const m = build({
      ...preset("externality"),
      externality,
      correction: true,
    });
    close(
      m.points.find((x) => x.id === "opt")!.x,
      m.points.find((x) => x.id === "corrected")!.x,
    );
  }
});
test("non-binding controls do not generate shortages", () => {
  const p = preset("control");
  assert.equal(build({ ...p, price: 80 }).points.length, 1);
  assert.equal(build({ ...p, price: 35 }).points.length, 3);
  assert.equal(build({ ...p, control: "floor", price: 20 }).points.length, 1);
});
test("linked axis items follow shifts while keeping offsets", () => {
  const p = preset(),
    i = { ...newItem("axis"), link: "eq", dx: 12, dy: 8 },
    before = resolveItem(i, build(p))!,
    after = resolveItem(i, build({ ...p, a: 110 }))!;
  assert.ok(after.x > before.x);
  assert.equal(i.dx, 12);
  assert.equal(i.dy, 8);
  assert.equal(resolveItem({ ...i, link: "missing" }, build(p)), null);
});
test("project round trip preserves all customization and rejects bad input", () => {
  const p = preset();
  p.items = [newItem("axis")];
  p.labels["eq-x"] = { text: "Housing", dx: 17 };
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
  assert.throws(() => parseProject('{"version":9}'));
  assert.throws(() => parseProject(JSON.stringify({ ...p, xMax: 0 })));
  assert.throws(() => parseProject(JSON.stringify({ ...p, a: null })));
});
test("parallel curves have no intersection", () => {
  const c = { id: "a", a: 10, b: 1, label: "A", color: "#000000" };
  assert.equal(intersect(c, { ...c, a: 20 }), null);
});
test("out of view equilibrium is reported", () => {
  assert.ok(build({ ...preset(), xMax: 10 }).warnings.length > 0);
});

test("trade quantities and tariff revenue follow small-country geometry", () => {
  const p = { ...preset("trade"), tradeMode: "tariff" as const },
    m = build(p);
  const s = m.points.find((x) => x.id === "free-s")!,
    d = m.points.find((x) => x.id === "free-d")!;
  close(s.x, (p.worldPrice - p.c) / p.d);
  close(d.x, (p.a - p.worldPrice) / p.b);
  const s2 = m.points.find((x) => x.id === "protected-s")!,
    d2 = m.points.find((x) => x.id === "protected-d")!;
  close(s2.y, p.worldPrice + p.tariff);
  assert.ok(d2.x - s2.x < d.x - s.x);
  const r = m.regions.find((x) => x.id === "trade-revenue")!;
  close(
    (r.points[1][0] - r.points[0][0]) * (r.points[2][1] - r.points[1][1]),
    (d2.x - s2.x) * p.tariff,
  );
});
test("binding quota produces imports equal to quota", () => {
  const p = { ...preset("trade"), tradeMode: "quota" as const, quota: 20 },
    m = build(p);
  close(
    m.points.find((x) => x.id === "protected-d")!.x -
      m.points.find((x) => x.id === "protected-s")!.x,
    20,
  );
});
test("prohibitive tariffs stop at autarky and collect no revenue", () => {
  const m = build({ ...preset("trade"), tradeMode: "tariff", tariff: 100 });
  close(m.points.find((x) => x.id === "protected-s")!.y, m.points[0].y);
  assert.ok(!m.regions.some((x) => x.id === "trade-revenue"));
});
test("loose quotas and import policy in an export market do not bind", () => {
  for (const p of [
    { ...preset("trade"), tradeMode: "quota" as const, quota: 100 },
    { ...preset("trade"), tradeMode: "tariff" as const, worldPrice: 65 },
  ])
    assert.ok(!build(p).points.some((x) => x.id === "protected-s"));
});
test("old projects load with default trade parameters", () => {
  const p: any = preset();
  delete p.worldPrice;
  delete p.tradeMode;
  delete p.tariff;
  delete p.quota;
  const q = parseProject(JSON.stringify(p));
  assert.equal(q.worldPrice, 30);
  assert.equal(q.tradeMode, "free");
});

test("quota also solves the zero-domestic-supply boundary", () => {
  const m = build({
    ...preset("trade"),
    worldPrice: 2,
    tradeMode: "quota",
    quota: 102,
  });
  const a = m.points.find((x) => x.id === "protected-s")!,
    b = m.points.find((x) => x.id === "protected-d")!;
  close(a.x, 0);
  close(b.x - a.x, 102);
});

test("chooser contains exactly the six requested diagrams in order", async () => {
  const { coverTemplates } = await import("../src/models/project.ts");
  assert.deepEqual(
    coverTemplates.map((t) => t.id),
    ["market", "externality", "ppc", "adas", "money", "trade"],
  );
});
test("PPC endpoints, opportunity costs and growth are consistent", () => {
  for (const ppcShape of ["bowed", "straight"] as const) {
    const p = { ...preset("ppc"), ppcShape, showShift: true };
    const m = build(p),
      path = m.curves[0].path!;
    close(path[0][0], 0);
    close(path[0][1], p.capacityY);
    close(path.at(-1)![0], p.capacityX);
    close(path.at(-1)![1], 0);
    const a = m.points[0],
      b = m.points[1];
    close(b.x / a.x, 1.2);
    close(b.y / a.y, 1.2);
    if (ppcShape === "bowed") {
      assert.ok(
        Math.abs((a.x / p.capacityX) ** 2 + (a.y / p.capacityY) ** 2 - 1) <
          0.0001,
      );
      const slope = (i: number) =>
        Math.abs((path[i + 1][1] - path[i][1]) / (path[i + 1][0] - path[i][0]));
      assert.ok(slope(90) > slope(30));
    } else close(a.x / p.capacityX + a.y / p.capacityY, 1);
  }
});
test("money supply is vertical and an expansion lowers interest rates", () => {
  const p = { ...preset("money"), showShift: true },
    m = build(p);
  close(
    m.curves.find((c) => c.id === "money-supply")!.vertical!,
    p.moneySupply,
  );
  const [e, e2] = m.points;
  close(e.x, p.moneySupply);
  close(e.y, p.a - p.b * e.x);
  close(e2.x, p.moneySupply + p.shiftS);
  assert.ok(e2.y < e.y);
  const constrained = resolveItem(
    { ...newItem("point"), curve: "money-supply", x: 2, y: 31 },
    m,
  )!;
  close(constrained.x, p.moneySupply);
  close(constrained.y, 31);
});
test("monetarist short-run equilibrium solves AD and SRAS with separate LRAS", () => {
  const p = { ...preset("adas"), showShift: true, shiftS: 5 },
    m = build(p);
  const [e, e2] = m.points;
  close(e.y, p.a - p.b * e.x);
  close(e.y, p.c + p.d * e.x);
  close(e2.y, p.a + p.shiftD - p.b * e2.x);
  close(e2.y, p.c + p.shiftS + p.d * e2.x);
  close(m.curves.find((c) => c.id === "lras")!.vertical!, p.fullEmployment);
});
test("Keynesian equilibrium follows horizontal, rising and vertical AS sections", () => {
  const p = { ...preset("adas"), adasModel: "keynesian" as const };
  for (const a of [40, 90, 160]) {
    const m = build({ ...p, a }),
      e = m.points[0];
    close(e.y, a - p.b * e.x);
    assert.ok(!m.curves.some((c) => c.id === "lras"));
    if (a === 40) {
      close(e.y, p.keynesianFloor);
      assert.ok(e.x < p.fullEmployment * p.keynesianKnee);
    }
    if (a === 90) {
      assert.ok(
        e.x > p.fullEmployment * p.keynesianKnee && e.x < p.fullEmployment,
      );
      close(e.y, value(m.curves.find(c => c.id === "as")!, e.x));
      const nx = (e.x - p.fullEmployment * p.keynesianKnee) / (p.fullEmployment * (1-p.keynesianKnee));
      const ny = (e.y - p.keynesianFloor) / p.keynesianRise;
      assert.ok(Math.abs(nx * nx + (1-ny) * (1-ny) - 1) < 0.0001);
    }
    if (a === 160) close(e.x, p.fullEmployment);
  }
});
test("Keynesian supply and demand shifts recompute the intersection", () => {
  const p = {
    ...preset("adas"),
    adasModel: "keynesian" as const,
    showShift: true,
    shiftD: 20,
    shiftS: 10,
  };
  const m = build(p),
    e = m.points[1];
  close(e.y, p.a + p.shiftD - p.b * e.x);
  close(e.y, value(m.curves.find(c => c.id === "as2")!, e.x));
});
test("vertical and piecewise curves clip to the plot without invalid coordinates", async () => {
  const { clipCurve } = await import("../src/engine/economics.ts");
  for (const p of [
    preset("ppc"),
    preset("money"),
    { ...preset("adas"), adasModel: "keynesian" as const },
  ]) {
    for (const c of build(p).curves) {
      const path = clipCurve(c, 50, 50);
      assert.ok(
        path.every(
          (pt) =>
            pt.every(Number.isFinite) &&
            pt[0] >= -1e-8 &&
            pt[0] <= 50 + 1e-8 &&
            pt[1] >= -1e-8 &&
            pt[1] <= 50 + 1e-8,
        ),
      );
    }
  }
});
test("new model settings round-trip and old saves receive their defaults", () => {
  for (const template of ["ppc", "money", "adas"] as const) {
    const p = preset(template);
    assert.deepEqual(parseProject(JSON.stringify(p)), p);
  }
  const p: any = preset();
  for (const k of [
    "adasModel",
    "fullEmployment",
    "keynesianFloor",
    "keynesianKnee",
    "keynesianRise",
    "moneySupply",
    "ppcShape",
    "capacityX",
    "capacityY",
    "productionShare",
    "ppcGrowth",
  ])
    delete p[k];
  const restored = parseProject(JSON.stringify(p));
  assert.equal(restored.adasModel, "monetarist");
  assert.equal(restored.ppcShape, "bowed");
});

test("Keynesian bend joins the flat and vertical sections smoothly", () => {
 const p = { ...preset("adas"), adasModel: "keynesian" as const };
 const pts = build(p).curves.find(c => c.id === "as")!.path!;
 assert.ok(pts.length > 100);
 const slopes = pts.slice(2, -1).map((pt, i) => (pt[1]-pts[i+1][1])/(pt[0]-pts[i+1][0]));
 assert.ok(slopes[0] < 0.01);
 assert.ok(slopes.at(-1)! > 100);
 assert.ok(slopes.every((v,i) => i===0 || v > slopes[i-1]));
 close(pts.at(-2)![0], p.fullEmployment);
});
