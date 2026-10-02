/**
 * UAT §9 — the categorical palette for platform charts: the dataviz reference instance, validated
 * (scripts/validate_palette.js) in both modes — adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3. Fixed
 * order, never cycled: a series keeps its slot (colour follows the entity, not its rank); past eight,
 * fold into "Other". Light mode has three slots under 3:1 on the surface, so every chart that uses them
 * ships a legend and a table view.
 */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'] as const;
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'] as const;
export const seriesColors = (dark: boolean) => (dark ? SERIES_DARK : SERIES_LIGHT);
/** Ordinal steps of the blue ramp for funnel stages (≥ 2:1 against either surface). */
export const FUNNEL_LIGHT = ['#86b6ef', '#4f8fe0', '#2a78d6'] as const;
export const FUNNEL_DARK = ['#184f95', '#2a6cc0', '#3987e5'] as const;
export const OTHER_COLOR = { light: '#8a8a86', dark: '#6f6f6b' } as const;
