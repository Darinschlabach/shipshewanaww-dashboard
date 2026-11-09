"use client";

import { useEffect, useState } from "react";
import Button from "@/components/Button";
import ConfirmModal from "@/components/ConfirmModal";
import Modal from "@/components/Modal";
import { formatCurrencyPrecise } from "@/lib/utils";
import {
  deleteVariable,
  fetchVariables,
  saveSettings,
  saveVariable,
  variableUsage,
  type CostingSettings,
  type CostingVariable,
} from "@/lib/costing/db";
import { Field, inputClass, parseRequiredNumber } from "@/components/costing/ui";

type SettingsForm = {
  shop_hourly_cost: string;
  worker_count: string;
  default_margin_pct: string;
  default_waste_sheet_pct: string;
  default_waste_lumber_pct: string;
};

type VariableForm = {
  id?: string;
  code: string;
  name: string;
  value: string;
  unit: string;
  description: string;
};

export default function SettingsTab({
  settings,
  onSaved,
}: {
  settings: CostingSettings | null;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [variables, setVariables] = useState<CostingVariable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [variableForm, setVariableForm] = useState<VariableForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CostingVariable | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    if (!settings) return;
    setForm({
      shop_hourly_cost: String(settings.shop_hourly_cost),
      worker_count: String(settings.worker_count),
      default_margin_pct: String(settings.default_margin_pct),
      default_waste_sheet_pct: String(settings.default_waste_sheet_pct),
      default_waste_lumber_pct: String(settings.default_waste_lumber_pct),
    });
  }, [settings]);

  async function loadVariables() {
    const result = await fetchVariables();
    setVariables(result.rows);
    if (result.error) setError(result.error);
  }

  useEffect(() => {
    void loadVariables();
  }, []);

  const workers = Number(form?.worker_count);
  const shop = Number(form?.shop_hourly_cost);
  const personRate = workers > 0 && Number.isFinite(shop) ? shop / workers : 0;

  async function saveShop() {
    if (!settings || !form) return;
    const shopCost = parseRequiredNumber(form.shop_hourly_cost, "shop hourly cost");
    const workerCount = parseRequiredNumber(form.worker_count, "worker count");
    const margin = parseRequiredNumber(form.default_margin_pct, "margin");
    const sheetWaste = parseRequiredNumber(form.default_waste_sheet_pct, "sheet waste");
    const lumberWaste = parseRequiredNumber(form.default_waste_lumber_pct, "lumber waste");
    if ([shopCost, workerCount, margin, sheetWaste, lumberWaste].some((item) => typeof item === "string")) {
      setError("Check the shop settings numbers");
      return;
    }
    const message = await saveSettings(settings.id, {
      shop_hourly_cost: shopCost as number,
      worker_count: workerCount as number,
      default_margin_pct: margin as number,
      default_waste_sheet_pct: sheetWaste as number,
      default_waste_lumber_pct: lumberWaste as number,
    });
    if (message) setError(message);
    else await onSaved();
  }

  async function submitVariable() {
    if (!variableForm) return;
    const value = parseRequiredNumber(variableForm.value, "value");
    const code = variableForm.code.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]*$/.test(code)) return setFormError("Code must be uppercase letters, numbers, or underscores");
    if (!variableForm.name.trim()) return setFormError("Enter a name");
    if (typeof value === "string") return setFormError(value);
    const message = await saveVariable({
      id: variableForm.id,
      code,
      name: variableForm.name,
      value,
      unit: variableForm.unit || "in",
      description: variableForm.description,
    });
    if (message) return setFormError(message);
    setVariableForm(null);
    await loadVariables();
  }

  const shown = variables.filter((row) =>
    `${row.code} ${row.name} ${row.description}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Shop settings</h2>
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        {form ? (
          <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); void saveShop(); }}>
            <Field label="Shop hourly cost">
              <input className={inputClass} inputMode="decimal" value={form.shop_hourly_cost} onChange={(event) => setForm({ ...form, shop_hourly_cost: event.target.value })} />
            </Field>
            <Field label="Worker count">
              <input className={inputClass} inputMode="numeric" value={form.worker_count} onChange={(event) => setForm({ ...form, worker_count: event.target.value })} />
            </Field>
            <p className="rounded-md bg-cream px-3 py-2 text-sm text-gray-800">
              Per person-hour: {formatCurrencyPrecise(personRate)}
            </p>
            <Field label="Default margin %">
              <input className={inputClass} inputMode="decimal" value={form.default_margin_pct} onChange={(event) => setForm({ ...form, default_margin_pct: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sheet waste %">
                <input className={inputClass} inputMode="decimal" value={form.default_waste_sheet_pct} onChange={(event) => setForm({ ...form, default_waste_sheet_pct: event.target.value })} />
              </Field>
              <Field label="Lumber waste %">
                <input className={inputClass} inputMode="decimal" value={form.default_waste_lumber_pct} onChange={(event) => setForm({ ...form, default_waste_lumber_pct: event.target.value })} />
              </Field>
            </div>
            <div className="flex justify-end"><Button type="submit" variant="primary">Save settings</Button></div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-gray-500">Settings are not loaded.</p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Shop standards</h2>
          <button type="button" className="rounded-md bg-burgundy px-3 py-2 text-sm font-medium text-white" onClick={() => { setFormError(null); setVariableForm({ code: "", name: "", value: "", unit: "in", description: "" }); }}>
            Add variable
          </button>
        </div>
        <input className={`${inputClass} mt-3`} placeholder="Search variables" value={search} onChange={(event) => setSearch(event.target.value)} />
        <table className="mt-3 w-full text-left text-sm">
          <tbody>
            {shown.map((row) => (
              <tr key={row.id} className="border-t border-gray-100">
                <td className="py-2 pr-2 font-medium">{row.code}</td>
                <td className="py-2 pr-2">{row.name}</td>
                <td className="py-2 pr-2">{row.value} {row.unit}</td>
                <td className="py-2 text-right">
                  <button type="button" className="mr-3 text-burgundy" onClick={() => { setFormError(null); setVariableForm({ id: row.id, code: row.code, name: row.name, value: String(row.value), unit: row.unit, description: row.description }); }}>Edit</button>
                  <button type="button" className="text-red-600" onClick={() => void variableUsage(row.code).then((used) => used.length ? setBlocked(`${row.code} is used by ${used.join(", ")}.`) : setPendingDelete(row))}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {variableForm ? (
        <Modal title={variableForm.id ? "Edit variable" : "Add variable"} onClose={() => setVariableForm(null)}>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void submitVariable(); }}>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Field label="Code"><input className={inputClass} value={variableForm.code} onChange={(event) => setVariableForm({ ...variableForm, code: event.target.value.toUpperCase() })} /></Field>
            <Field label="Name"><input className={inputClass} value={variableForm.name} onChange={(event) => setVariableForm({ ...variableForm, name: event.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Value"><input className={inputClass} inputMode="decimal" value={variableForm.value} onChange={(event) => setVariableForm({ ...variableForm, value: event.target.value })} /></Field>
              <Field label="Unit"><input className={inputClass} value={variableForm.unit} onChange={(event) => setVariableForm({ ...variableForm, unit: event.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea className={inputClass} rows={2} value={variableForm.description} onChange={(event) => setVariableForm({ ...variableForm, description: event.target.value })} /></Field>
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setVariableForm(null)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </Modal>
      ) : null}
      {pendingDelete ? <ConfirmModal title="Delete variable" body={`Remove ${pendingDelete.code}?`} confirmLabel="Delete" onCancel={() => setPendingDelete(null)} onConfirm={() => { void deleteVariable(pendingDelete.id).then((message) => { setPendingDelete(null); if (message) setError(message); else void loadVariables(); }); }} /> : null}
      {blocked ? <Modal title="This variable is in use" onClose={() => setBlocked(null)}><p className="text-sm text-gray-600">{blocked}</p><div className="mt-4 flex justify-end"><Button onClick={() => setBlocked(null)}>Close</Button></div></Modal> : null}
    </div>
  );
}
