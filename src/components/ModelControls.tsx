import type { Project } from "../models/project";
import { Num, Range, Select, Toggle, Section } from "./Controls";

export function ModelControls({
  p,
  patch,
}: {
  p: Project;
  patch: (v: Partial<Project>) => void;
}) {
  if (!["ppc", "money", "adas"].includes(p.template)) return null;
  return (
    <Section title="Model and shifts" open>
      {p.template === "ppc" ? (
        <>
          <Select
            label="Frontier shape"
            value={p.ppcShape}
            options={[
              { value: "bowed", label: "Increasing opportunity cost" },
              { value: "straight", label: "Constant opportunity cost" },
            ]}
            onChange={(v) => patch({ ppcShape: v as Project["ppcShape"] })}
          />
          <div className="two-col">
            <Range
              label="Maximum Good X"
              value={p.capacityX}
              min={10}
              max={300}
              onChange={(capacityX) => patch({ capacityX })}
            />
            <Range
              label="Maximum Good Y"
              value={p.capacityY}
              min={10}
              max={300}
              onChange={(capacityY) => patch({ capacityY })}
            />
          </div>
          <Range
            label="Point A: share of maximum X"
            value={p.productionShare}
            min={0}
            max={1}
            step={0.01}
            onChange={(productionShare) => patch({ productionShare })}
          />
          <Toggle
            label="show a shifted frontier"
            value={p.showShift}
            onChange={(showShift) => patch({ showShift })}
          />
          {p.showShift && (
            <Range
              label="Capacity change (%)"
              value={p.ppcGrowth}
              min={-80}
              max={100}
              onChange={(ppcGrowth) => patch({ ppcGrowth })}
            />
          )}
          <p className="small">
            move point a along the frontier with the slider. a positive capacity
            change moves the frontier outwards.
          </p>
        </>
      ) : (
        <>
          {p.template === "adas" && (
            <Select
              label="AD/AS model"
              value={p.adasModel}
              options={[
                { value: "keynesian", label: "Keynesian" },
                { value: "monetarist", label: "Monetarist" },
              ]}
              onChange={(v) => patch({ adasModel: v as Project["adasModel"] })}
            />
          )}
          <div className="two-col">
            <Range
              label={
                p.template === "money"
                  ? "Money demand intercept"
                  : "AD intercept"
              }
              value={p.a}
              min={1}
              max={300}
              onChange={(a) => patch({ a })}
            />
            <Num
              label={
                p.template === "money"
                  ? "Money demand slope magnitude"
                  : "AD slope magnitude"
              }
              value={p.b}
              min={0.05}
              max={5}
              step={0.05}
              onChange={(b) => patch({ b })}
            />
            {p.template === "money" ? (
              <Range
                label="Money supply"
                value={p.moneySupply}
                min={1}
                max={300}
                onChange={(moneySupply) => patch({ moneySupply })}
              />
            ) : (
              <>
                <Range
                  label="Full-employment output"
                  value={p.fullEmployment}
                  min={10}
                  max={300}
                  onChange={(fullEmployment) => patch({ fullEmployment })}
                />
                {p.adasModel === "monetarist" ? (
                  <>
                    <Range
                      label="SRAS intercept"
                      value={p.c}
                      min={0}
                      max={200}
                      onChange={(c) => patch({ c })}
                    />
                    <Num
                      label="SRAS slope"
                      value={p.d}
                      min={0.05}
                      max={5}
                      step={0.05}
                      onChange={(d) => patch({ d })}
                    />
                  </>
                ) : (
                  <>
                    <Range
                      label="Horizontal AS price level"
                      value={p.keynesianFloor}
                      min={1}
                      max={150}
                      onChange={(keynesianFloor) => patch({ keynesianFloor })}
                    />
                    <Range
                      label="Rising section starts (% of full employment)"
                      value={p.keynesianKnee * 100}
                      min={10}
                      max={90}
                      onChange={(v) => patch({ keynesianKnee: v / 100 })}
                    />
                    <Range
                      label="Price rise across the middle section"
                      value={p.keynesianRise}
                      min={5}
                      max={200}
                      onChange={(keynesianRise) => patch({ keynesianRise })}
                    />
                  </>
                )}
              </>
            )}
          </div>
          <Toggle
            label="show shifts and a second equilibrium"
            value={p.showShift}
            onChange={(showShift) => patch({ showShift })}
          />
          {p.showShift && (
            <div className="two-col">
              <Range
                label={
                  p.template === "money" ? "Money demand shift" : "AD shift"
                }
                value={p.shiftD}
                min={-100}
                max={100}
                onChange={(shiftD) => patch({ shiftD })}
              />
              <Range
                label={
                  p.template === "money"
                    ? "Money supply change"
                    : p.adasModel === "monetarist"
                      ? "SRAS shift"
                      : "AS price-level shift"
                }
                value={p.shiftS}
                min={-100}
                max={100}
                onChange={(shiftS) => patch({ shiftS })}
              />
            </div>
          )}
          <p className="small">
            {p.template === "money"
              ? "change the money supply to move the vertical supply curve. the interest rate follows its intersection with money demand."
              : p.adasModel === "keynesian"
                ? "adjust demand to move the intersection through the flat section, smooth bend and full-employment section."
                : "the vertical curve marks full-employment output. demand and short-run supply determine the current equilibrium."}
          </p>
        </>
      )}
    </Section>
  );
}
