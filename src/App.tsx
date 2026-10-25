import { Cover } from "./components/Cover";
import { useEffect, useRef, useState } from "react";
import {
  templates,
  preset,
  newItem,
  parseProject,
  type Project,
  type Item,
} from "./models/project";
import { build, resolveItem } from "./engine/economics";
import { useProject } from "./state/useProject";
import { Diagram } from "./rendering/Diagram";
import { download, exportDiagram } from "./export/files";
import {
  Text,
  Num,
  Range,
  Toggle,
  Select,
  Colours,
  Section,
} from "./components/Controls";
export function App() {
  const {
    project: p,
    change,
    undo,
    redo,
    checkpoint,
    canUndo,
    canRedo,
    storageError,
  } = useProject();
  const [editor, setEditor] = useState(false),
    [selected, setSelected] = useState(""),
    [format, setFormat] = useState("png"),
    [scale, setScale] = useState("2"),
    [zoom, setZoom] = useState(1),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const svg = useRef<SVGSVGElement>(null),
    file = useRef<HTMLInputElement>(null);
  const m = build(p);
  const patch = (v: Partial<Project>) => change({ ...p, ...v });
  const editItem = (id: string, v: Partial<Item>) =>
    patch({ items: p.items.map((i) => (i.id === id ? { ...i, ...v } : i)) });
  const editLabel = (id: string, v: Partial<Project["labels"][string]>) =>
    patch({ labels: { ...p.labels, [id]: { ...p.labels[id], ...v } } });
  const editCurve = (id: string, v: Partial<Project["curves"][string]>) =>
    patch({ curves: { ...p.curves, [id]: { ...p.curves[id], ...v } } });
  const editRegion = (id: string, v: Partial<Project["regions"][string]>) =>
    patch({ regions: { ...p.regions, [id]: { ...p.regions[id], ...v } } });
  const add = (kind: Item["kind"]) => {
    const i = newItem(kind);
    patch({ items: [...p.items, i] });
    setSelected(i.id);
  };
  const selectedItem = p.items.find((i) => i.id === selected);
  const labelDefaults: Record<string, string> = {
    title: p.title,
    "x-title": p.xTitle,
    "y-title": p.yTitle,
    origin: p.origin,
  };
  m.axis.forEach((a) => (labelDefaults[a.id] = a.label));
  m.points.forEach((a) => (labelDefaults["point-" + a.id] = a.label));
  m.curves.forEach(
    (a) => (labelDefaults["curve-" + a.id] = p.curves[a.id]?.label ?? a.label),
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.target as HTMLElement).matches("input,textarea,select")) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if (e.key === "Escape") setSelected("");
      if (selected && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        if (selectedItem)
          patch({ items: p.items.filter((i) => i.id !== selected) });
        else editLabel(selected, { hidden: true });
        setSelected("");
      }
      if (
        selected &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const o = selectedItem || p.labels[selected] || {},
          step = e.shiftKey ? 10 : 1,
          v = {
            dx:
              (o.dx || 0) +
              (e.key === "ArrowRight"
                ? step
                : e.key === "ArrowLeft"
                  ? -step
                  : 0),
            dy:
              (o.dy || 0) +
              (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0),
          };
        selectedItem ? editItem(selected, v) : editLabel(selected, v);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  async function load(f?: File) {
    if (!f) return;
    try {
      const data = parseProject(await f.text());
      change(data);
      setEditor(true);
      setSelected("");
      setMessage("Project loaded.");
    } catch {
      setMessage("This file is not a valid Ceteris version 1 project.");
    }
    if (file.current) file.current.value = "";
  }
  const hiddenFile = (
    <input
      hidden
      ref={file}
      type="file"
      accept=".json"
      onChange={(e) => load(e.target.files?.[0])}
    />
  );
  if (!editor)
    return (
      <>
        {hiddenFile}
        <Cover
          onChoose={(id) => {
            change(preset(id));
            setEditor(true);
            setSelected("");
          }}
          onResume={() => setEditor(true)}
          onOpen={() => file.current?.click()}
          message={message}
        />
      </>
    );
  return (
    <main className="app">
      {hiddenFile}
      <header className="toolbar">
        <button onClick={() => setEditor(false)}>← All diagrams</button>
        <strong>
          Ceteris{" "}
          <span>/ {templates.find((t) => t.id === p.template)?.name}</span>
        </strong>
        <div className="toolbar-actions">
          <button disabled={!canUndo} onClick={undo} title="Ctrl / ⌘ Z">
            Undo
          </button>
          <button disabled={!canRedo} onClick={redo}>
            Redo
          </button>
          <button
            onClick={() =>
              download(
                new Blob([JSON.stringify(p, null, 2)], {
                  type: "application/json",
                }),
                "ceteris-project.json",
              )
            }
          >
            Save project
          </button>
          <button onClick={() => file.current?.click()}>Open</button>
          <button
            onClick={() => {
              change(preset(p.template));
              setSelected("");
            }}
          >
            Reset
          </button>
        </div>
      </header>
      <div className="editor-shell">
        <section className="workspace">
          <div className="canvas-tools">
            <span>DIAGRAM PREVIEW</span>
            <div>
              <button
                aria-label="Zoom out"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              >
                −
              </button>
              <button onClick={() => setZoom(1)}>
                {Math.round(zoom * 100)}% · Fit
              </button>
              <button
                aria-label="Zoom in"
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              >
                +
              </button>
            </div>
          </div>
          <div className="canvas-scroll">
            <div className="artboard" style={{ width: `${zoom * 100}%` }}>
              <Diagram
                p={p}
                onChange={change}
                onCheckpoint={checkpoint}
                selected={selected}
                onSelect={setSelected}
                svgRef={svg}
              />
            </div>
          </div>
          <p className="hint">
            Drag any label to position it. Select a label for precise controls.
            Shift + arrow keys moves it faster.
          </p>
          {[...m.warnings, ...m.notes, storageError]
            .filter(Boolean)
            .map((v, i) => (
              <p
                className={m.warnings.includes(v) ? "notice warning" : "notice"}
                key={i}
              >
                {v}
              </p>
            ))}
        </section>
        <aside className="settings" aria-label="Diagram settings">
          <Section title="Title" open>
            <Text
              label="Diagram title"
              value={p.title}
              onChange={(title) =>
                patch({
                  title,
                  labels: {
                    ...p.labels,
                    title: { ...p.labels.title, text: undefined },
                  },
                })
              }
            />
          </Section>
          <Section title="Model and shifts" open>
            <div className="two-col">
              <Range
                label="Demand intercept"
                value={p.a}
                min={1}
                max={300}
                onChange={(a) => patch({ a })}
              />
              <Range
                label="Supply intercept"
                value={p.c}
                min={0}
                max={200}
                onChange={(c) => patch({ c })}
              />
              <Num
                label="Demand slope magnitude"
                value={p.b}
                min={0.05}
                max={5}
                step={0.05}
                onChange={(b) => patch({ b })}
              />
              <Num
                label="Supply slope"
                value={p.d}
                min={0.05}
                max={5}
                step={0.05}
                onChange={(d) => patch({ d })}
              />
            </div>
            {(p.template === "market" || p.template === "surplus") && (
              <>
                <Toggle
                  label="Show shifted curves and second equilibrium"
                  value={p.showShift}
                  onChange={(showShift) => patch({ showShift })}
                />
                {p.showShift && (
                  <div className="two-col">
                    <Range
                      label="Demand shift"
                      value={p.shiftD}
                      min={-100}
                      max={100}
                      onChange={(shiftD) => patch({ shiftD })}
                    />
                    <Range
                      label="Supply shift"
                      value={p.shiftS}
                      min={-100}
                      max={100}
                      onChange={(shiftS) => patch({ shiftS })}
                    />
                  </div>
                )}
              </>
            )}
            {["tax", "subsidy", "externality"].includes(p.template) && (
              <Range
                label={
                  p.template === "externality"
                    ? "Marginal external cost / benefit"
                    : "Per-unit " + p.template
                }
                value={p.amount}
                min={0}
                max={150}
                onChange={(amount) => patch({ amount })}
              />
            )}
            {p.template === "externality" && (
              <>
                <Select
                  label="Externality type"
                  value={p.externality}
                  onChange={(externality) =>
                    patch({
                      externality: externality as Project["externality"],
                    })
                  }
                  options={[
                    "negative-production",
                    "positive-production",
                    "negative-consumption",
                    "positive-consumption",
                  ].map((v) => ({ value: v, label: v.replace("-", " ") }))}
                />
                <Toggle
                  label="Show corrective tax / subsidy"
                  value={p.correction}
                  onChange={(correction) => patch({ correction })}
                />
              </>
            )}
            {p.template === "control" && (
              <>
                <Select
                  label="Control"
                  value={p.control}
                  options={["ceiling", "floor"]}
                  onChange={(control) =>
                    patch({ control: control as Project["control"] })
                  }
                />
                <Range
                  label="Controlled price"
                  value={p.price}
                  min={0}
                  max={300}
                  onChange={(price) => patch({ price })}
                />
              </>
            )}
            <p className="small">
              Linear models: P = a − bQ and P = c + dQ. Shifts change
              intercepts. Area values use model units.
            </p>
          </Section>
          {p.template === "trade" && (
            <Section title="International trade" open>
              <Select
                label="Trade scenario"
                value={p.tradeMode}
                options={[
                  { value: "free", label: "Free trade" },
                  { value: "tariff", label: "Import tariff" },
                  { value: "quota", label: "Import quota" },
                ]}
                onChange={(tradeMode) =>
                  patch({ tradeMode: tradeMode as Project["tradeMode"] })
                }
              />
              <Range
                label="World price"
                value={p.worldPrice}
                min={0}
                max={150}
                onChange={(worldPrice) => patch({ worldPrice })}
              />
              {p.tradeMode === "tariff" && (
                <Range
                  label="Per-unit tariff"
                  value={p.tariff}
                  min={0}
                  max={150}
                  onChange={(tariff) => patch({ tariff })}
                />
              )}
              {p.tradeMode === "quota" && (
                <Range
                  label="Import quota"
                  value={p.quota}
                  min={0}
                  max={150}
                  onChange={(quota) => patch({ quota })}
                />
              )}
              <p className="small">
                A small country takes the world price as given. Tariffs and
                quotas apply to imports. Quota rents belong to licence holders.
              </p>
            </Section>
          )}
          <Section title="Axes and labels" open>
            <Text
              label="Horizontal-axis title"
              value={p.xTitle}
              onChange={(xTitle) =>
                patch({
                  xTitle,
                  labels: {
                    ...p.labels,
                    "x-title": { ...p.labels["x-title"], text: undefined },
                  },
                })
              }
            />
            <Text
              label="Vertical-axis title"
              value={p.yTitle}
              onChange={(yTitle) =>
                patch({
                  yTitle,
                  labels: {
                    ...p.labels,
                    "y-title": { ...p.labels["y-title"], text: undefined },
                  },
                })
              }
            />
            <div className="two-col">
              <Text
                label="Origin label"
                value={p.origin}
                onChange={(origin) => patch({ origin })}
              />
              <Num
                label="Tick interval"
                value={p.tick}
                min={1}
                max={100}
                onChange={(tick) => patch({ tick })}
              />
              <Num
                label="Horizontal maximum"
                value={p.xMax}
                min={10}
                max={500}
                onChange={(xMax) => patch({ xMax })}
              />
              <Num
                label="Vertical maximum"
                value={p.yMax}
                min={10}
                max={500}
                onChange={(yMax) => patch({ yMax })}
              />
            </div>
            <Toggle
              label="Show numerical ticks"
              value={p.ticks}
              onChange={(ticks) => patch({ ticks })}
            />
            <Toggle
              label="Show grid"
              value={p.grid}
              onChange={(grid) => patch({ grid })}
            />
            <Toggle
              label="Rotate vertical-axis title"
              value={p.rotateY}
              onChange={(rotateY) => patch({ rotateY })}
            />
            <Toggle
              label="Show axis arrowheads"
              value={p.arrows}
              onChange={(arrows) => patch({ arrows })}
            />
            <Toggle
              label="Show equilibrium projections"
              value={p.projection}
              onChange={(projection) => patch({ projection })}
            />
            <h3>Linked axis points</h3>
            <p className="small">
              These follow the model automatically. Select a row to adjust text
              and positioning.
            </p>
            {m.axis.map((a) => (
              <div
                className={"axis-row " + (selected === a.id ? "active" : "")}
                key={a.id}
              >
                <button onClick={() => setSelected(a.id)}>
                  {a.axis.toUpperCase()} · {a.value.toFixed(1)}
                </button>
                <input
                  aria-label={"Label " + a.label}
                  value={p.labels[a.id]?.text ?? a.label}
                  onChange={(e) => editLabel(a.id, { text: e.target.value })}
                />
                <button
                  title="Hide or show label"
                  onClick={() =>
                    editLabel(a.id, { hidden: !p.labels[a.id]?.hidden })
                  }
                >
                  {p.labels[a.id]?.hidden ? "Show" : "Hide"}
                </button>
                <button
                  title="Convert to a manually positioned axis point"
                  onClick={() => {
                    const it = {
                      ...newItem("axis"),
                      axis: a.axis,
                      x: a.point!.x,
                      y: a.point!.y,
                      label: p.labels[a.id]?.text ?? a.label,
                    };
                    patch({
                      items: [...p.items, it],
                      labels: {
                        ...p.labels,
                        [a.id]: { ...p.labels[a.id], hidden: true },
                      },
                    });
                    setSelected(it.id);
                  }}
                >
                  Unlink
                </button>
              </div>
            ))}
            <button className="add" onClick={() => add("axis")}>
              + Add axis point
            </button>
          </Section>
          {selected && !selectedItem && (
            <Section title="Selected label" open>
              <Text
                label="Label text"
                value={
                  p.labels[selected]?.text ?? labelDefaults[selected] ?? ""
                }
                onChange={(text) => editLabel(selected, { text })}
              />
              <div className="two-col">
                <Num
                  label="Horizontal offset"
                  value={p.labels[selected]?.dx || 0}
                  onChange={(dx) => editLabel(selected, { dx })}
                />
                <Num
                  label="Vertical offset"
                  value={p.labels[selected]?.dy || 0}
                  onChange={(dy) => editLabel(selected, { dy })}
                />
                <Num
                  label="Label font size"
                  value={p.labels[selected]?.size || p.font}
                  min={8}
                  max={48}
                  onChange={(size) => editLabel(selected, { size })}
                />
              </div>
              <Colours
                label="Label colour"
                value={p.labels[selected]?.color || "#111827"}
                onChange={(color) => editLabel(selected, { color })}
              />
              <Toggle
                label="Visible"
                value={!p.labels[selected]?.hidden}
                onChange={(v) => editLabel(selected, { hidden: !v })}
              />
              <button onClick={() => editLabel(selected, { dx: 0, dy: 0 })}>
                Restore automatic position
              </button>
            </Section>
          )}
          <Section title="Points and annotations" open={!!selectedItem}>
            <div className="button-row">
              <button onClick={() => add("point")}>+ Point</button>
              <button onClick={() => add("text")}>+ Text</button>
              <button onClick={() => add("arrow")}>+ Arrow</button>
            </div>
            {p.items.map((it) => (
              <button
                className={"item-chip " + (selected === it.id ? "active" : "")}
                key={it.id}
                onClick={() => setSelected(it.id)}
              >
                {it.label || it.kind}
                {!it.visible ? " (hidden)" : ""}
              </button>
            ))}
            {selectedItem &&
              (() => {
                const i = selectedItem;
                return (
                  <div className="item-editor">
                    <Text
                      label="Item label"
                      value={i.label}
                      onChange={(label) => editItem(i.id, { label })}
                    />
                    {i.kind === "axis" && (
                      <Select
                        label="Axis"
                        value={i.axis}
                        options={["x", "y"]}
                        onChange={(axis) =>
                          editItem(i.id, { axis: axis as "x" | "y" })
                        }
                      />
                    )}
                    <Select
                      label="Link to calculated point"
                      value={i.link}
                      options={[
                        { value: "", label: "Manual" },
                        ...m.points.map((pt) => ({
                          value: pt.id,
                          label: pt.label || pt.id,
                        })),
                      ]}
                      onChange={(link) => {
                        const pos = resolveItem(i, m);
                        editItem(i.id, {
                          link,
                          curve: "",
                          ...(pos ? { x: pos.x, y: pos.y } : {}),
                        });
                      }}
                    />
                    {!i.link && i.kind === "point" && (
                      <Select
                        label="Constrain to curve"
                        value={i.curve}
                        options={[
                          { value: "", label: "Free point" },
                          ...m.curves.map((c) => ({
                            value: c.id,
                            label: c.label,
                          })),
                        ]}
                        onChange={(curve) => editItem(i.id, { curve })}
                      />
                    )}
                    {!i.link && (
                      <div className="two-col">
                        {(i.kind !== "axis" || i.axis === "x") && (
                          <Num
                            label="X coordinate"
                            value={i.x}
                            min={0}
                            max={p.xMax}
                            onChange={(x) => editItem(i.id, { x })}
                          />
                        )}
                        {!i.curve && (i.kind !== "axis" || i.axis === "y") && (
                          <Num
                            label="Y coordinate"
                            value={i.y}
                            min={0}
                            max={p.yMax}
                            onChange={(y) => editItem(i.id, { y })}
                          />
                        )}
                      </div>
                    )}
                    <div className="two-col">
                      <Num
                        label="Text X offset"
                        value={i.dx}
                        onChange={(dx) => editItem(i.id, { dx })}
                      />
                      <Num
                        label="Text Y offset"
                        value={i.dy}
                        onChange={(dy) => editItem(i.id, { dy })}
                      />
                    </div>
                    <Select
                      label="Display"
                      value={i.mode}
                      options={["label", "value", "both"]}
                      onChange={(mode) =>
                        editItem(i.id, { mode: mode as Item["mode"] })
                      }
                    />
                    <Select
                      label="Marker"
                      value={i.marker}
                      options={["tick", "dot", "none"]}
                      onChange={(marker) =>
                        editItem(i.id, { marker: marker as Item["marker"] })
                      }
                    />
                    <Colours
                      label="Item colour"
                      value={i.color}
                      onChange={(color) => editItem(i.id, { color })}
                    />
                    <Toggle
                      label="Projection lines"
                      value={i.projection}
                      onChange={(projection) => editItem(i.id, { projection })}
                    />
                    <Toggle
                      label="Visible"
                      value={i.visible}
                      onChange={(visible) => editItem(i.id, { visible })}
                    />
                    <button
                      className="danger"
                      onClick={() => {
                        patch({ items: p.items.filter((x) => x.id !== i.id) });
                        setSelected("");
                      }}
                    >
                      Delete item
                    </button>
                  </div>
                );
              })()}
            <p className="small">
              Copy subscripts: ₀ ₁ ₂ ₃ ₄ ₅ ₑ ₛ ₚ · Superscripts: ⁰ ¹ ² ³
            </p>
          </Section>
          <Section title="Curves">
            {m.curves.map((c) => {
              const o = p.curves[c.id] || {};
              return (
                <div className="subpanel" key={c.id}>
                  <Text
                    label={c.label + " label"}
                    value={o.label ?? c.label}
                    onChange={(label) => editCurve(c.id, { label })}
                  />
                  <Colours
                    label={c.label + " colour"}
                    value={o.color || c.color}
                    onChange={(color) => editCurve(c.id, { color })}
                  />
                  <Toggle
                    label="Visible curve"
                    value={!o.hidden}
                    onChange={(v) => editCurve(c.id, { hidden: !v })}
                  />
                  <Toggle
                    label="Dashed line"
                    value={!!o.dash}
                    onChange={(dash) => editCurve(c.id, { dash })}
                  />
                  <Toggle
                    label="Show equation"
                    value={!!o.equation}
                    onChange={(equation) => editCurve(c.id, { equation })}
                  />
                  <Num
                    label="Curve width"
                    value={o.width || p.line}
                    min={1}
                    max={8}
                    step={0.5}
                    onChange={(width) => editCurve(c.id, { width })}
                  />
                  {p.extraCurves.some((e) => e.id === c.id) && (
                    <>
                      <Num
                        label="Custom intercept"
                        value={c.a}
                        onChange={(a) =>
                          patch({
                            extraCurves: p.extraCurves.map((e) =>
                              e.id === c.id ? { ...e, a } : e,
                            ),
                          })
                        }
                      />
                      <Num
                        label="Custom slope"
                        value={c.b}
                        min={-5}
                        max={5}
                        step={0.05}
                        onChange={(b) =>
                          patch({
                            extraCurves: p.extraCurves.map((e) =>
                              e.id === c.id ? { ...e, b } : e,
                            ),
                          })
                        }
                      />
                      <button
                        onClick={() =>
                          patch({
                            extraCurves: p.extraCurves.filter(
                              (e) => e.id !== c.id,
                            ),
                          })
                        }
                      >
                        Remove curve
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      patch({
                        extraCurves: [
                          ...p.extraCurves,
                          {
                            id: crypto.randomUUID(),
                            a: c.a + 10,
                            b: c.b,
                            label: c.label + "′",
                          },
                        ],
                      })
                    }
                  >
                    Duplicate curve
                  </button>
                </div>
              );
            })}
            <p className="small">
              Duplicated curves are annotations; they do not change the
              template’s calculated equilibria.
            </p>
          </Section>
          <Section title="Shading">
            <Toggle
              label="Show economic regions"
              value={p.shade}
              onChange={(shade) => patch({ shade })}
            />
            <Range
              label="Shading opacity"
              value={p.opacity}
              min={0.05}
              max={0.6}
              step={0.05}
              onChange={(opacity) => patch({ opacity })}
            />
            {m.regions.map((r) => {
              const o = p.regions[r.id] || {};
              return (
                <div className="subpanel" key={r.id}>
                  <Toggle
                    label={r.label}
                    value={o.visible ?? !r.id.endsWith("-share")}
                    onChange={(visible) => editRegion(r.id, { visible })}
                  />
                  <Colours
                    label={r.label + " colour"}
                    value={o.color || r.color}
                    onChange={(color) => editRegion(r.id, { color })}
                  />
                  <Toggle
                    label="Hatch pattern"
                    value={!!o.hatch}
                    onChange={(hatch) => editRegion(r.id, { hatch })}
                  />
                  <Toggle
                    label="Region label"
                    value={!!o.label}
                    onChange={(label) => editRegion(r.id, { label })}
                  />
                </div>
              );
            })}
            {!m.regions.length && (
              <p className="small">
                This template has no shaded welfare regions.
              </p>
            )}
          </Section>
          <Section title="Style">
            <Select
              label="Appearance"
              value={
                p.monochrome ? "mono" : p.font >= 23 ? "presentation" : "colour"
              }
              options={[
                { value: "colour", label: "Restrained colour" },
                { value: "mono", label: "Textbook monochrome" },
                { value: "presentation", label: "Presentation" },
              ]}
              onChange={(v) =>
                patch({
                  monochrome: v === "mono",
                  font: v === "presentation" ? 24 : 18,
                  line: v === "presentation" ? 3 : 2.5,
                })
              }
            />
            <Select
              label="Font family"
              value={p.fontFamily}
              options={["Arial", "Georgia", "Verdana"]}
              onChange={(fontFamily) =>
                patch({ fontFamily: fontFamily as Project["fontFamily"] })
              }
            />
            <Range
              label="Font size"
              value={p.font}
              min={12}
              max={28}
              onChange={(font) => patch({ font })}
            />
            <Range
              label="Line thickness"
              value={p.line}
              min={1}
              max={5}
              step={0.5}
              onChange={(line) => patch({ line })}
            />
          </Section>
          <div className="export-panel">
            <div className="two-col">
              <Select
                label="Format"
                value={format}
                options={[
                  { value: "png", label: "PNG image" },
                  { value: "svg", label: "SVG vector" },
                ]}
                onChange={setFormat}
              />
              <Select
                label="Resolution"
                value={scale}
                options={[
                  { value: "1", label: "900 × 720" },
                  { value: "2", label: "1800 × 1440" },
                  { value: "3", label: "2700 × 2160" },
                ]}
                onChange={setScale}
              />
            </div>
            <Toggle
              label="Transparent background"
              value={p.transparent}
              onChange={(transparent) => patch({ transparent })}
            />
            <button
              className="download"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await exportDiagram(
                    svg.current!,
                    format,
                    +scale,
                    p.transparent,
                  );
                  setMessage("Diagram downloaded.");
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Preparing…" : "↓  Download Diagram"}
            </button>
            <p className="small" role="status">
              {message || "Edits are saved automatically in this browser."}
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
