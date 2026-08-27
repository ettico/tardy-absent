// Rounds a max value up to a "clean" tick ceiling (1/2/5/10 * 10^n), so axis
// labels read as round numbers instead of arbitrary decimals.
export function niceMax(value: number): number {
  if (value <= 0) return 4;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const fraction = value / base;
  let niceFraction: number;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * base;
}
