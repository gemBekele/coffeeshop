/**
 * Monorepo/pnpm workaround.
 *
 * Expo's own react-native.config.js can fail to load when the package is
 * resolved through pnpm's store, so expo-modules-autolinking falls back to the
 * Gradle namespace (`expo.core`) and generates an invalid import for
 * `ExpoModulesPackage` (the class actually lives in `expo.modules`). Overriding
 * it here (app config wins over the library config) fixes the generated
 * `PackageList.java`.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
