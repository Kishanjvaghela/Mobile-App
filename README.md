
## Table of Contents

* [Requirements to Run Mobile-App](#requirements-to-run-mobile-app)
  * [Common](#common)
  * [For Android - <small>macOS and Windows</small>](#for-android)
  * [For iOS - <small>macOS only</small>](#for-ios)
* [Steps to Run](#steps-to-run)
  * [Windows](#windows)
  * [macOS](#macos)
* [Additional Requirements to Run E2E Tests](#additional-requirements-to-run-e2e-tests)
  * [E2E on Android - <small>macOS and Windows</small>](#e2e-on-android)
  * [E2E on iOS - <small>macOS only</small>](#e2e-on-ios)
* [Staging and Continuous Integration](#staging-and-continuous-integration)
* [Notes from Developers](#notes-from-developers)

---
### Default information in README.md
* [Available Scripts](#available-scripts)
  * [npm run ios](#npm-run-ios)
  * [npm run android](#npm-run-android)
* [Other](#other)
  * [Writing and Running Tests](#writing-and-running-tests)
  * [Adding Flow](#adding-flow)

## Requirements to Run Mobile-App
### Common 
 * `node 8.14.1` (with `npm 6.4.1`)  
  <small>NodeJS version 8.15.x is also likely to work</small>
  * ninja (for Android)  
  <small>macOS - `brew install ninja`, Windows - instructions [here](https://github.com/rwols/CMakeBuilder/wiki/Ninja-for-Windows-Installation-Instructions)</small>
#### For Android
<small>(macOS and Windows)</small>  
    * `Java 1.8` (jdk 8)  
    * `Android Studio` *(optional)*
#### For iOS
<small>(macOS only)</small>  
    * `macOS 10.13 High Sierra` or higher <small>(not tested on El Capitan and before)</small>  
    * `Homebrew` - http://brew.sh  
    * `CocoaPods` (`brew install pods`)  
    * `Xcode 9.4.1`

## Steps to Run
### Windows
  (1) `git clone git://github.com/LockTrip/Mobile-app.git`  
  (2) `cd <project-folder>` for example `cd C:\projects\Mobile-App`  
  (3) `npm install`  
  (4) `react-native run-android` 
### macOS
(1) `git clone git://github.com/LockTrip/Mobile-app.git`  
(2) `cd <project-folder>` for example `cd $HOME$/projects/Mobile-App`  
(3) `npm install`  
(4) `react-native run-ios` or `react-native run-android`

## Additional Requirements to Run E2E Tests
E2E tests (aka integration tests) are using `detox` (with Grey Box vs the common Black Box approach) with `mocha`.
### E2E on Android
 * ???
### E2E on iOS (macOS only)
  * `brew tap wix/brew`
  * `brew install applesimutils`
 
### Staging and Continuous Integration
First application of CI is using Travis CI http://travis-ci.org.
Later on to be applied in this branch.

### Notes from developers

<small>
  <span style="font-weight:normal; font-size:0.75em">
    Jinkai note on Building with Xcode 10:  
    Building issue for iOS 12, Xcode 10.1  
    https://zivost.com/blog/xcode-10-causes-haywire-for-react-native-developers/
  </span>
</small>
---
---
---
# Default Information
---

## Available Scripts

### `npm start`

Runs your app in development mode.

Open it in the [Expo app](https://expo.io) on your phone to view it. It will reload if you save edits to your files, and you will see build errors and logs in the terminal.

Sometimes you may need to reset or clear the React Native packager's cache. To do so, you can pass the `--reset-cache` flag to the start script:

```
npm start -- --reset-cache
# or
yarn start -- --reset-cache
```

#### `npm test`

Runs the [jest](https://github.com/facebook/jest) test runner on your tests.

#### `npm run ios`

Like `npm start`, but also attempts to open your app in the iOS Simulator if you're on a Mac and have it installed.

#### `npm run android`

Like `npm start`, but also attempts to open your app on a connected Android device or emulator. Requires an installation of Android build tools (see [React Native docs](https://facebook.github.io/react-native/docs/getting-started.html) for detailed setup). We also recommend installing Genymotion as your Android emulator. Once you've finished setting up the native build environment, there are two options for making the right copy of `adb` available to Create React Native App:

##### Using Android Studio's `adb`

1. Make sure that you can run adb from your terminal.
2. Open Genymotion and navigate to `Settings -> ADB`. Select “Use custom Android SDK tools” and update with your [Android SDK directory](https://stackoverflow.com/questions/25176594/android-sdk-location).

##### Using Genymotion's `adb`

1. Find Genymotion’s copy of adb. On macOS for example, this is normally `/Applications/Genymotion.app/Contents/MacOS/tools/`.
2. Add the Genymotion tools directory to your path (instructions for [Mac](http://osxdaily.com/2014/08/14/add-new-path-to-path-command-line/), [Linux](http://www.computerhope.com/issues/ch001647.htm), and [Windows](https://www.howtogeek.com/118594/how-to-edit-your-system-path-for-easy-command-line-access/)).
3. Make sure that you can run adb from your terminal.

## Other

### Writing and Running Tests

This project is set up to use [jest](https://facebook.github.io/jest/) for tests. You can configure whatever testing strategy you like, but jest works out of the box. Create test files in directories called `__tests__` or with the `.test` extension to have the files loaded by jest. See the [the template project](https://github.com/react-community/create-react-native-app/blob/master/react-native-scripts/template/App.test.js) for an example test. The [jest documentation](https://facebook.github.io/jest/docs/en/getting-started.html) is also a wonderful resource, as is the [React Native testing tutorial](https://facebook.github.io/jest/docs/en/tutorial-react-native.html).

### Adding Flow

Flow is a static type checker that helps you write code with fewer bugs. Check out this [introduction to using static types in JavaScript](https://medium.com/@preethikasireddy/why-use-static-types-in-javascript-part-1-8382da1e0adb) if you are new to this concept.

React Native works with [Flow](http://flowtype.org/) out of the box, as long as your Flow version matches the one used in the version of React Native.

To add a local dependency to the correct Flow version to a Create React Native App project, follow these steps:

1. Find the Flow `[version]` at the bottom of the included [.flowconfig](.flowconfig)
2. Run `npm install --save-dev flow-bin@x.y.z` (or `yarn add --dev flow-bin@x.y.z`), where `x.y.z` is the .flowconfig version number.
3. Add `"flow": "flow"` to the `scripts` section of your `package.json`.
4. Add `// @flow` to any files you want to type check (for example, to `App.js`).

Now you can run `npm run flow` (or `yarn flow`) to check the files for type errors.
You can optionally use a [plugin for your IDE or editor](https://flow.org/en/docs/editors/) for a better integrated experience.

To learn more about Flow, check out [its documentation](https://flow.org/).
