import * as path from 'path';

type TerminalSupportMetadataBlock = {
  thinkingSpace?: {
    terminalEnabled?: boolean;
  };
};

function readPackageTerminalEnabledBlock(): boolean | null {
  try {
    const packageJsonPath = path.resolve(__dirname, '../../package.json');
    const packageJson = require(packageJsonPath) as TerminalSupportMetadataBlock;
    if (typeof packageJson?.thinkingSpace?.terminalEnabled === 'boolean') {
      return packageJson.thinkingSpace.terminalEnabled;
    }
  } catch {
    // Fall through to default behavior.
  }
  return null;
}

export function isTerminalEnabledBlock(): boolean {
  const rawValue = process.env.THINKING_SPACE_ENABLE_TERMINAL?.trim().toLowerCase();
  if (rawValue) {
    return rawValue !== '0' && rawValue !== 'false' && rawValue !== 'off';
  }

  const packageValue = readPackageTerminalEnabledBlock();
  if (packageValue !== null) return packageValue;

  return true;
}
