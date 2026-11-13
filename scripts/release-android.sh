#!/bin/sh
# Builds the signed release bundle (.aab) for Google Play, plus a signed APK of
# the same build to install on a phone and check first.
#
# Needs android/keystore.properties pointing at the upload key. Before each
# upload, raise versionCode in android/app/build.gradle (and the version in
# package.json if it is a new release).
set -e
cd "$(dirname "$0")/.."

if [ ! -f android/keystore.properties ]; then
  echo "android/keystore.properties is missing: release builds need the upload key." >&2
  exit 1
fi

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21}"

npm run build:android
(cd android && ./gradlew --quiet bundleRelease assembleRelease)

mkdir -p release
VERSION=$(node -p "require('./package.json').version")
cp android/app/build/outputs/bundle/release/app-release.aab "release/sharps-and-flats-$VERSION.aab"
cp android/app/build/outputs/apk/release/app-release.apk "release/sharps-and-flats-$VERSION.apk"
echo
echo "Upload to Play:   release/sharps-and-flats-$VERSION.aab"
echo "Test on a phone:  adb install -r release/sharps-and-flats-$VERSION.apk"
