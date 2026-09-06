import { useRef, useState } from "react";
import { ScrollView, Text } from "react-native";
import { router } from "expo-router";
import { CheckInSheet } from "@/components/check-in-sheet";
import { CaptureFeedback, type CaptureResult } from "@/components/capture-feedback";
import { captureFailureLabel } from "@/features/attendance/capture-feedback";
import { ApiError } from "@/features/api";
import { SelfieCamera, type SelfieCameraHandle } from "@/components/selfie-camera";
import { CaptureBox, SheetFooter, SheetHeader, sheet } from "@/components/verification-sheet";
import { Notice } from "@/components/workforce";
import { useSession } from "@/features/auth/session";
import { selfieForm } from "@/features/attendance/api";
import { useVerificationStatus } from "@/features/attendance/use-verification";
export default function EnrollFace() {
  const { request } = useSession();
  const setup = useVerificationStatus();
  const camera = useRef<SelfieCameraHandle>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const retake = () => { setUri(null); setReady(false); setError(null); setCaptureResult(null); };
  const dismiss = () => router.canGoBack() ? router.back() : router.replace("/profile");
  async function captureOrSave() {
    if (pending) return;
    setPending(true); setError(null); setCaptureResult(null);
    try {
      if (!uri) { const captured = await camera.current?.capture(); if (captured) setUri(captured); }
      else { await request("/attendance/me/face", { method: "POST", body: await selfieForm(uri) }); setDone(true); setCaptureResult({ status: "success", label: "Face accepted" }); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Face could not be saved.");
      setCaptureResult({ status: "error", label: uri ? captureFailureLabel(cause instanceof ApiError ? cause.code : null) : "Couldn’t capture photo" });
    }
    finally { setPending(false); }
  }
  return <CheckInSheet onDismiss={dismiss}>
    <SheetHeader title={done ? "Face set up" : "Set up face check-in"} onClose={dismiss} />
    <ScrollView style={sheet.scroll} contentContainerStyle={sheet.content}>
      <Text style={sheet.intro}>Take a clear selfie in good light. Your photo will be uploaded to your employer’s server to create your attendance face template.</Text>
      {setup.status === "error" ? <Notice actionLabel="Retry" onAction={() => void setup.reload()}>{setup.error}</Notice> : <CaptureBox title={done ? "You’re ready" : uri ? "Check your photo" : "Face the camera"} label="Face template" caption={done ? "Your template was saved on the server." : "Keep your full face visible."} done={done}>
        <SelfieCamera ref={camera} stillUri={uri} onReadyChange={setReady} />
        <CaptureFeedback result={captureResult} />
      </CaptureBox>}
      {error && <Notice actionLabel="Retake" onAction={retake}>{error}</Notice>}
      {uri && !done && !pending && !error && <Notice actionLabel="Retake" onAction={retake}>Blurry photo? Take another one.</Notice>}
    </ScrollView>
    <SheetFooter label={done ? "Done" : pending ? "Please wait…" : uri ? "Save my face" : "Take selfie"} icon={done ? "check" : "camera"} disabled={!done && (pending || setup.status !== "ready" || (!uri && !ready))} onPress={done ? dismiss : () => void captureOrSave()} note="Face verification is not liveness detection. Your HR team manages access to this data." />
  </CheckInSheet>;
}
