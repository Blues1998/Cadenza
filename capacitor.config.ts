import type { CapacitorConfig } from '@capacitor/cli';

// The Android app ships the built site inside the APK, so it runs offline and
// the instrument samples load from disk instead of the network.
//
// appId is permanent once the app is on the Play Store: it is the listing's
// identity and cannot be changed later.
const config: CapacitorConfig = {
  appId: 'io.github.blues1998.sharpsandflats',
  appName: 'Sharps&Flats',
  webDir: 'dist',
  android: {
    // Audio samples and the soundfont are already compressed; packing them
    // again only slows the build.
    buildOptions: { releaseType: 'AAB' }
  }
};

export default config;
