export function isTerminalEnabledBlock(): boolean {
  const rawValue = process.env.THINKING_SPACE_ENABLE_TERMINAL?.trim().toLowerCase();
  if (!rawValue) return true;
  return rawValue !== '0' && rawValue !== 'false' && rawValue !== 'off';
}
