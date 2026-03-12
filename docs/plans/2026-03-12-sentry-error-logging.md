# Sentry Production Error Logging

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Sentry crash/error reporting for Android production builds with zero performance overhead.

**Architecture:** Initialize `@sentry/react-native` at app startup with all performance monitoring disabled. Wrap the root component with `Sentry.wrap()` and an `ErrorBoundary` for automatic JS error and native crash capture. No breadcrumbs, no replays, no tracing.

**Tech Stack:** `@sentry/react-native`, Expo plugin `@sentry/react-native/expo`

---

### Task 1: Install @sentry/react-native

**Files:**
- Modify: `package.json`
- Modify: `app.json`

**Step 1: Install the package**

Run: `npx expo install @sentry/react-native`

**Step 2: Add Sentry Expo plugin to app.json**

In `app.json`, add `@sentry/react-native/expo` to the `plugins` array:

```json
"plugins": [
  "expo-web-browser",
  "expo-sqlite",
  [
    "@sentry/react-native/expo",
    {
      "organization": "YOUR_SENTRY_ORG",
      "project": "YOUR_SENTRY_PROJECT"
    }
  ]
]
```

> Note: org/project are needed for source map uploads during EAS builds. Use placeholder values for now.

---

### Task 2: Initialize Sentry in App.tsx

**Files:**
- Modify: `App.tsx`

**Step 1: Add Sentry import and init call at top of App.tsx**

Add after existing imports:

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: '__YOUR_SENTRY_DSN__',

  // Disable ALL performance monitoring
  tracesSampleRate: 0,
  enableAutoPerformanceTracing: false,
  enableAppStartTracking: false,
  enableNativeFramesTracking: false,
  enableStallTracking: false,

  // Disable replays
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Disable breadcrumbs (reduce noise)
  enableAutoSessionTracking: true, // keep session tracking for crash-free rate
  attachScreenshot: false,
  attachViewHierarchy: false,

  // Enable native crash handling
  enableNative: true,
  enableNativeCrashHandling: true,
  enableNdk: true,

  environment: __DEV__ ? 'development' : 'production',
});
```

**Step 2: Wrap the default export with Sentry.wrap()**

Change the export at the bottom of App.tsx:

```typescript
// Before:
export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

// After:
function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
```

**Step 3: Add ErrorBoundary around AppContent's children**

Wrap the content inside `AppContent` with `Sentry.ErrorBoundary`. Use `SafeAreaView` from `react-native-safe-area-context` for the fallback:

```tsx
import { SafeAreaView as SACView } from 'react-native-safe-area-context';

function ErrorFallback() {
  return (
    <SACView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Something went wrong. Please restart the app.</Text>
    </SACView>
  );
}

// Inside AppContent's return, wrap NavigationContainer:
return (
  <SafeAreaView style={styles.container}>
    <StatusBar style="light" />
    <Sentry.ErrorBoundary fallback={ErrorFallback}>
      <NavigationContainer theme={...}>
        {/* existing auth bar + navigator */}
      </NavigationContainer>
    </Sentry.ErrorBoundary>
  </SafeAreaView>
);
```

---

### Task 3: Verify setup

**Step 1: Run the app in dev to check for init errors**

Run: `npx expo start`

Confirm no red screen or console errors from Sentry init.

**Step 2: Test error capture (optional, remove after)**

Temporarily add to any screen:

```typescript
<Pressable onPress={() => { throw new Error('Sentry test error'); }}>
  <Text>Test Crash</Text>
</Pressable>
```

Verify it appears in your Sentry dashboard (once you replace the placeholder DSN).

**Step 3: Remove test code**

---

## Placeholder values to replace

| Placeholder | Where | What to put |
|---|---|---|
| `__YOUR_SENTRY_DSN__` | `App.tsx` | Your Sentry project DSN (Settings > Projects > Client Keys) |
| `YOUR_SENTRY_ORG` | `app.json` | Your Sentry org slug |
| `YOUR_SENTRY_PROJECT` | `app.json` | Your Sentry project slug |
