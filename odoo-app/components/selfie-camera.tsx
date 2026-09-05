import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { useIsFocused } from "expo-router/react-navigation";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Image, Linking, StyleSheet, Text, View } from "react-native";
import { Button } from "./workforce";

export type SelfieCameraHandle = { capture: () => Promise<string> };
export const SelfieCamera = forwardRef<SelfieCameraHandle, { stillUri: string | null; onReadyChange: (ready: boolean) => void }>(function SelfieCamera({ stillUri, onReadyChange }, ref) {
  const [permission, ask] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<CameraView>(null);
  const busy = useRef(false);
  const focused = useIsFocused();
  useEffect(() => { onReadyChange(false); }, [focused, stillUri, onReadyChange]);
  useImperativeHandle(ref, () => ({ capture: async () => {
    if (!camera.current || busy.current) throw new Error("Camera is not ready yet.");
    busy.current = true;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85 });
      if (!photo?.uri) throw new Error("No photo was captured. Please retry.");
      const scaled = await manipulateAsync(photo.uri, [{ resize: { width: 720 } }], { compress: 0.8, format: SaveFormat.JPEG });
      return scaled.uri;
    } finally { busy.current = false; }
  } }), []);
  if (stillUri) return <Image source={{ uri: stillUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Your captured selfie" />;
  if (!permission?.granted) return <View style={styles.message}>
    <Text style={styles.text}>Allow the front camera to capture your attendance selfie.</Text>
    <Button label={permission?.canAskAgain === false ? "Open settings" : "Allow camera"} onPress={() => { void (permission?.canAskAgain === false ? Linking.openSettings() : ask()); }} />
  </View>;
  if (error) return <View style={styles.message}><Text style={styles.text}>{error}</Text><Button label="Retry camera" onPress={() => setError(null)} /></View>;
  return <View style={styles.fill}>
    {focused && <CameraView ref={camera} facing="front" mirror style={StyleSheet.absoluteFill} onCameraReady={() => onReadyChange(true)} onMountError={({ message }) => { onReadyChange(false); setError(message); }} />}
    <View pointerEvents="none" style={styles.frame} />
  </View>;
});
const styles = StyleSheet.create({ fill: { flex: 1 }, message: { flex: 1, justifyContent: "center", padding: 20, gap: 18 }, text: { color: "white", textAlign: "center" }, frame: { position: "absolute", top: "12%", bottom: "12%", left: "18%", right: "18%", borderColor: "rgba(255,255,255,.7)", borderWidth: 1 } });
