const baseConfig = require('./electron-builder.config.json');

module.exports = {
  ...baseConfig,
  files: [
    ...(baseConfig.files || []).filter((entry) => entry !== 'node_modules/node-pty/**/*'),
    '!node_modules/node-pty{,/**/*}',
  ],
  asarUnpack: (baseConfig.asarUnpack || []).filter((entry) => entry !== '**/node_modules/node-pty/**'),
  extraMetadata: {
    ...(baseConfig.extraMetadata || {}),
    thinkingSpace: {
      terminalEnabled: false,
    },
  },
};
