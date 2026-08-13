// Config plugin: mark the Android app resizable so it behaves on large screens
// (foldables / tablets / multi-window). Clears the Play Console "resizability
// and orientation restrictions" advisory without unlocking phone orientation —
// Android 16 ignores the orientation lock on large screens anyway, and a
// resizable activity lets the system size the app cleanly there.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withResizeable(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) {
      app.$['android:resizeableActivity'] = 'true';
    }
    return cfg;
  });
};
