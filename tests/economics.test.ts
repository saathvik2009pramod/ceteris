import { test } from "node:test";
import assert from "node:assert/strict";
import { preset, parseProject, newItem } from "../src/models/project.ts";
import { build, intersect, resolveItem } from "../src/engine/economics.ts";
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
