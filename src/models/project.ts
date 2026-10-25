import { z } from "zod";
export const templates = [
  {
    id: "market",
    name: "Supply and Demand",
    description:
      "Explore equilibrium, curve shifts and changing market conditions.",
  },
  {
    id: "tax",
    name: "Indirect Tax",
    description:
      "Illustrate tax incidence, government revenue and welfare loss.",
  },
  {
    id: "subsidy",
    name: "Subsidy",
    description:
      "Show consumer benefits, producer receipts and government expenditure.",
  },
  {
    id: "externality",
    name: "Externalities",
    description:
      "Compare private and social costs and benefits across four cases.",
  },
  {
    id: "control",
    name: "Price Controls",
    description:
      "Explore binding price ceilings, price floors, shortages and surpluses.",
  },
  {
    id: "surplus",
    name: "Consumer & Producer Surplus",
    description:
      "Visualise the gains from trade with customisable welfare regions.",
  },
] as const;
const n = z.number().finite();
const short = z.string().max(500);
const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const itemSchema = z.object({
  id: short,
  kind: z.enum(["axis", "point", "text", "arrow"]),
  axis: z.enum(["x", "y"]),
  x: n,
  y: n,
  label: short,
  link: short,
  curve: short,
  visible: z.boolean(),
  projection: z.boolean(),
  marker: z.enum(["tick", "dot", "none"]),
  color,
  dx: n,
  dy: n,
  mode: z.enum(["label", "value", "both"]),
});
export type Item = z.infer<typeof itemSchema>;
const labelSchema = z.object({
  text: short.optional(),
  dx: n.optional(),
  dy: n.optional(),
  hidden: z.boolean().optional(),
  color: color.optional(),
  size: n.min(8).max(48).optional(),
});
const curveStyle = z.object({
  label: short.optional(),
  color: color.optional(),
  dash: z.boolean().optional(),
  hidden: z.boolean().optional(),
  equation: z.boolean().optional(),
  width: n.min(1).max(8).optional(),
});
const regionStyle = z.object({
  visible: z.boolean().optional(),
  color: color.optional(),
  hatch: z.boolean().optional(),
  label: z.boolean().optional(),
});
export const projectSchema = z.object({
  version: z.literal(1),
  template: z.enum([
    "market",
    "tax",
    "subsidy",
    "externality",
    "control",
    "surplus",
  ]),
  title: short,
  xTitle: short,
  yTitle: short,
  origin: short,
  a: n.min(1).max(300),
  b: n.min(0.05).max(5),
  c: n.min(0).max(200),
  d: n.min(0.05).max(5),
  shiftD: n.min(-100).max(100),
  shiftS: n.min(-100).max(100),
  showShift: z.boolean(),
  amount: n.min(0).max(150),
  externality: z.enum([
    "negative-production",
    "positive-production",
    "negative-consumption",
    "positive-consumption",
  ]),
  control: z.enum(["ceiling", "floor"]),
  price: n.min(0).max(300),
  correction: z.boolean(),
  xMax: n.min(10).max(500),
  yMax: n.min(10).max(500),
  tick: n.min(1).max(100),
  ticks: z.boolean(),
  grid: z.boolean(),
  arrows: z.boolean(),
  rotateY: z.boolean(),
  font: n.min(12).max(28),
  line: n.min(1).max(5),
  opacity: n.min(0.05).max(0.6),
  projection: z.boolean(),
  shade: z.boolean(),
  monochrome: z.boolean(),
  fontFamily: z.enum(["Arial", "Georgia", "Verdana"]),
  transparent: z.boolean(),
  labels: z.record(labelSchema),
  curves: z.record(curveStyle),
  regions: z.record(regionStyle),
  items: z.array(itemSchema).max(100),
  extraCurves: z
    .array(
      z.object({
        id: short,
        a: n.min(-300).max(300),
        b: n.min(-5).max(5),
        label: short,
      }),
    )
    .max(20),
});
export type Project = z.infer<typeof projectSchema>;
export function preset(template: Project["template"] = "market"): Project {
  return {
    version: 1,
    template,
    title: templates.find((t) => t.id === template)!.name,
    xTitle: "Quantity",
    yTitle: template === "externality" ? "Price / costs / benefits" : "Price",
    origin: "O",
    a: 90,
    b: 0.8,
    c: 10,
    d: 0.6,
    shiftD: 15,
    shiftS: 0,
    showShift: false,
    amount: 18,
    externality: "negative-production",
    control: "ceiling",
    price: 35,
    correction: false,
    xMax: 110,
    yMax: 110,
    tick: 20,
    ticks: false,
    grid: false,
    arrows: false,
    rotateY: true,
    font: 18,
    line: 2.5,
    opacity: 0.2,
    projection: true,
    shade: template !== "market" && template !== "control",
    monochrome: false,
    fontFamily: "Arial",
    transparent: false,
    labels: {},
    curves: {},
    regions: {},
    items: [],
    extraCurves: [],
  };
}
export function newItem(kind: Item["kind"]): Item {
  return {
    id: crypto.randomUUID(),
    kind,
    axis: "x",
    x: 35,
    y: 35,
    label: kind === "axis" ? "Qₜ" : kind === "point" ? "A" : "Annotation",
    link: "",
    curve: "",
    visible: true,
    projection: false,
    marker: kind === "axis" ? "tick" : "dot",
    color: "#111827",
    dx: 0,
    dy: 0,
    mode: "label",
  };
}
export function parseProject(text: string) {
  if (text.length > 1_000_000) throw Error("Project file is too large.");
  return projectSchema.parse(JSON.parse(text));
}
