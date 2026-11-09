import type { DeliveryOption, DeliverySpeed, DeliveryZone } from '../api/types';
import { formatMoney } from './money';

/** The delivery times a seller can promise (wireflow: 4 hours to 5 days; Express may be under 2 hours). */
export const TIME_PRESETS: Array<{ id: string; label: string; min: number; max: number }> = [
  { id: 'u2', label: 'Under 2 hrs', min: 1, max: 2 },
  { id: 'sameday', label: 'Same day (4–6 hrs)', min: 4, max: 6 },
  { id: 'nextday', label: 'Next day', min: 24, max: 24 },
  { id: '2-3d', label: '2–3 days', min: 48, max: 72 },
  { id: '3-5d', label: '3–5 days', min: 72, max: 120 },
];

export function windowLabel(min: number, max: number): string {
  const preset = TIME_PRESETS.find((p) => p.min === min && p.max === max);
  if (preset) return preset.label;
  if (max < 24) return `${min}–${max} hrs`;
  const days = (h: number) => Math.round(h / 24);
  return days(min) === days(max) ? `${days(max)} day${days(max) === 1 ? '' : 's'}` : `${days(min)}–${days(max)} days`;
}

export const speedLabel = (s: DeliverySpeed) => (s === 'EXPRESS' ? 'Express' : 'Standard');

export function zoneLabel(zone: DeliveryZone, storeState: string | null): string {
  const state = storeState ?? 'your state';
  return zone === 'WITHIN_STATE' ? `Within ${state}` : `Outside ${state}`;
}

export function feeLabel(feeMinor: string, currency = 'NGN'): string {
  return Number(feeMinor) === 0 ? 'Free' : formatMoney(feeMinor, currency);
}

export function optionLabel(o: Pick<DeliveryOption, 'zone' | 'speed' | 'minHours' | 'maxHours'>, storeState: string | null): string {
  return `${speedLabel(o.speed)} · ${zoneLabel(o.zone, storeState)} · ${windowLabel(o.minHours, o.maxHours)}`;
}

/** Is the buyer's state the same as the seller's store state? */
export function isWithinState(buyerState: string, storeState: string | null): boolean {
  return !!storeState && buyerState.trim().toLowerCase() === storeState.trim().toLowerCase();
}

/** For an order that no longer has the seller's live setup in hand. */
export function snapshotLabel(o: { zone: DeliveryZone; speed: DeliverySpeed; minHours: number; maxHours: number }): string {
  return `${speedLabel(o.speed)} · ${o.zone === 'WITHIN_STATE' ? "Seller's state" : 'Other state'} · ${windowLabel(o.minHours, o.maxHours)}`;
}
