const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(name => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
const { captureFailureLabel, FACE_RETAKE_CODES } = load('features/attendance/capture-feedback.ts');
for (const code of ['FACE_MISMATCH', 'FACE_NOT_DETECTED', 'NO_FACE', 'MULTIPLE_FACES', 'FACE_IMAGE_INVALID']) {
  assert.ok(FACE_RETAKE_CODES.has(code));
}
assert.equal(captureFailureLabel('FACE_MISMATCH'), 'Face didn’t match');
assert.equal(captureFailureLabel('MULTIPLE_FACES'), 'Only one face, please');
assert.equal(captureFailureLabel('FACE_NOT_DETECTED'), 'Try a clearer selfie');
assert.equal(captureFailureLabel('OUTSIDE_GEOFENCE'), 'Outside the office area');
assert.equal(captureFailureLabel('LOCATION_IMPRECISE'), 'Couldn’t confirm location');
for (const code of [null, 'FACE_SERVICE_BUSY', 'PROFILE_MISSING']) {
  assert.equal(captureFailureLabel(code), 'Couldn’t complete verification');
}

// Render the actual component with lightweight host/hook doubles. No camera,
// employee account or backend requests are needed to check feedback lifecycle.
for (const reduced of [false, true]) {
  const effects = [], announced = [], sequences = [];
  let stopped = false;
  const element = (type, props) => ({ type, props });
  const { CaptureFeedback } = load('components/capture-feedback.tsx', {
    react: { useState: initial => [typeof initial === 'function' ? initial() : reduced, () => {}], useEffect: effect => effects.push(effect) },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@expo/vector-icons': { Feather: 'Icon' },
    '@/constants/theme': { font: { semibold: {} } },
    'react-native': {
      View: 'View', Text: 'Text', StyleSheet: { create: value => value, absoluteFillObject: {} },
      AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: () => ({ remove() {} }), announceForAccessibility: label => announced.push(label) },
      Animated: {
        View: 'AnimatedView', Value: class { setValue() {} },
        timing: (_value, config) => config, delay: delay => ({ delay }),
        sequence: steps => { sequences.push(steps); return { start() {}, stop() { stopped = true; } }; },
      },
    },
  });
  const output = CaptureFeedback({ result: { status: 'success', label: 'Face verified' } });
  const cleanups = effects.splice(0).map(effect => effect());
  assert.equal(output.props.pointerEvents, 'none');
  assert.match(output.props.style[1].backgroundColor, /13, 118, 73/);
  assert.equal(output.props.children[0].props.children.props.name, 'check');
  assert.deepEqual(announced, ['Face verified']);
  assert.deepEqual(sequences[0].map(step => step.duration ?? step.delay), reduced ? [0, 1200, 0] : [180, 1200, 500]);
  assert.equal(sequences[0][0].useNativeDriver, true);
  cleanups.forEach(cleanup => cleanup?.());
  assert.equal(stopped, true, 'animation must stop on retake/unmount');
  const failed = CaptureFeedback({ result: { status: 'error', label: 'Try a clearer selfie' } });
  assert.match(failed.props.style[1].backgroundColor, /175, 35, 46/);
  assert.equal(failed.props.children[0].props.children.props.name, 'x');
  assert.equal(CaptureFeedback({ result: null }), null, 'no success flash while merely capturing');
}
console.log('PASS: feedback colors/icons, fade lifecycle, reduced motion, non-blocking overlay and accurate failure labels.');
