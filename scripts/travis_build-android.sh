#!/bin/bash

# variables
cfg="$1"
product="$2"
apk="app-release.apk"


# select config
./scripts/select_config.rb "$cfg"

# build
cd android
./gradlew assembleRelease

# move
mv android/app/build/outputs/apk/release/$apk $TRAVIS_BUILD_DIR/$product