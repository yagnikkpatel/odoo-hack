import { CheckInSheet } from "@/components/check-in-sheet";
import { CaptureFeedback, type CaptureResult } from "@/components/capture-feedback";
import { captureFailureLabel, FACE_RETAKE_CODES } from "@/features/attendance/capture-feedback";
import {
  SelfieCamera,
  type SelfieCameraHandle,
} from "@/components/selfie-camera";
import {
  CaptureBox,
  CheckRow,
  SheetFooter,
  SheetHeader,
  sheet,
  type CheckState,
} from "@/components/verification-sheet";
import { Notice } from "@/components/workforce";
import { palette as p } from "@/constants/theme";
import { capturePosition } from "@/features/attendance/location";
import { ClockError, useAttendance } from "@/features/attendance/store";
import {
  distanceLabel,
  hoursLabel,
  timeLabel,
  TIMEZONE_LABEL,
  type Attendance,
  type Position,
  type Verification,
} from "@/features/attendance/types";
import { useVerificationStatus } from "@/features/attendance/use-verification";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

type PositionState =
  | { status: "locating" }
  | { status: "ready"; value: Position }
  | { status: "failed"; message: string };

// Server reason codes and what the visitor should do about them.
const RETAKE = FACE_RETAKE_CODES;
const RELOCATE = new Set(["OUTSIDE_GEOFENCE", "LOCATION_IMPRECISE", "LOCATION_REQUIRED"]);
const SET_UP = new Set(["FACE_NOT_ENROLLED", "PROFILE_MISSING"]);

const feedback = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") void Haptics.notificationAsync(type).catch(() => {});
};

function proofCopy(proof: Verification | null | undefined) {
  if (!proof) return ["Recorded without verification", "Recorded without verification"];
  const face = `Matched your enrolled face${proof.face.source === "hr_photo" ? " (HR photo)" : ""}`;
  const place =
    proof.location.status === "inside"
      ? `${distanceLabel(proof.location.distanceM ?? 0)} from ${proof.location.workLocation ?? "the office"}`
      : "Recorded; HR has not set an office geofence";
  return [face, place];
}

export default function CheckIn() {
  const { today, checkedIn, dayComplete, checkIn, checkOut } = useAttendance();
  const setup = useVerificationStatus();
  // Fixed at open so the sheet does not flip while a request is in flight.
  const [action] = useState<"Check-in" | "Check-out">(
    checkedIn ? "Check-out" : "Check-in",
  );
  const [position, setPosition] = useState<PositionState>({ status: "locating" });
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const camera = useRef<SelfieCameraHandle>(null);
  const [result, setResult] = useState<Attendance | null>(null);
  const [pending, setPending] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<{ message: string; code: string | null } | null>(null);
  const dismiss = () =>
    router.canGoBack() ? router.back() : router.replace("/");
  // Already both in and out today: nothing to record, show the day instead.
  const finished = dayComplete && !result;
  const done = result !== null || finished;
  const shown = result ?? today;
  const proof = shown?.checkOutVerification ?? shown?.checkInVerification;
  const office = setup.status === "ready" ? setup.data.office : null;
  const enrolled = setup.status === "ready" && setup.data.face.enrolled;

  // One fix per attempt; a stale answer from an earlier attempt is dropped.
  const attempt = useRef(0);
  const requestPosition = useCallback(() => {
    const ticket = ++attempt.current;
    capturePosition().then(
      (value) => {
        if (ticket === attempt.current) setPosition({ status: "ready", value });
      },
      (cause: unknown) => {
        if (ticket === attempt.current)
          setPosition({
            status: "failed",
            message: cause instanceof Error ? cause.message : "Couldn’t get your location.",
          });
      },
    );
  }, []);
  const locate = () => {
    setPosition({ status: "locating" });
    requestPosition();
  };
  useEffect(() => {
    if (!finished) requestPosition();
  }, [requestPosition, finished]);

  const retake = () => {
    setCaptureResult(null);
    setError(null);
    setSelfieUri(null);
    setCameraReady(false);
  };
  const takeSelfie = async () => {
    setCaptureResult(null);
    setError(null);
    try {
      setSelfieUri((await camera.current?.capture()) ?? null);
      setCameraReady(false);
    } catch (cause) {
      setCaptureResult({ status: "error", label: "Couldn’t capture photo" });
      setError({
        message: cause instanceof Error ? cause.message : "The selfie could not be taken.",
        code: null,
      });
    }
  };

  const submit = async () => {
    if (pending || done || !selfieUri || position.status !== "ready") return;
    setPending(true);
    setCaptureResult(null);
    setError(null);
    const attempt = { selfieUri, position: position.value };
    try {
      const record =
        action === "Check-in" ? await checkIn(attempt) : await checkOut(attempt);
      setResult(record);
      const acceptedProof = action === "Check-in" ? record.checkInVerification : record.checkOutVerification;
      if (acceptedProof?.face.status === "matched") {
        setCaptureResult({ status: "success", label: "Face verified" });
      }
      feedback(Haptics.NotificationFeedbackType.Success);
    } catch (cause) {
      const code = cause instanceof ClockError ? cause.code : null;
      setError({
        message: cause instanceof Error ? cause.message : "Attendance could not be saved.",
        code,
      });
      // Keep the failed still visible beneath the red flash until manual retake.
      setCaptureResult({ status: "error", label: captureFailureLabel(code) });
      feedback(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPending(false);
    }
  };

  const [faceProof, placeProof] = proofCopy(proof);
  const faceRow: { state: CheckState; detail: string } = done
    ? { state: proof ? "done" : "pending", detail: faceProof }
    : error?.code && RETAKE.has(error.code)
      ? { state: "failed", detail: error.message }
    : !enrolled
      ? { state: "pending", detail: "Set up from your profile first" }
      : selfieUri
        ? { state: "pending", detail: pending ? "Verifying your selfie…" : "Selfie captured · confirm to verify" }
        : { state: "active", detail: cameraReady ? "Take a selfie inside the frame" : "Starting the camera…" };
  const placeRow: { state: CheckState; detail: string } = done
    ? { state: proof ? "done" : "pending", detail: placeProof }
    : position.status === "locating"
      ? { state: "active", detail: "Finding your location…" }
      : position.status === "failed"
        ? { state: "failed", detail: position.message }
        : {
            state: "done",
            detail: office?.configured
              ? `Located ±${position.value.accuracyM ?? "?"} m · checked against ${office.name}, within ${office.radiusM} m`
              : `Located ±${position.value.accuracyM ?? "?"} m · HR has not set an office geofence`,
          };

  // What the notice offers for a refused attempt: set up a face, or re-locate.
  const remedy =
    error?.code && SET_UP.has(error.code)
      ? "setup"
      : error?.code && RELOCATE.has(error.code)
        ? "relocate"
        : null;

  const footer = done
    ? { label: "Back to dashboard", icon: "arrow-right" as const, onPress: () => router.dismissTo("/") }
    : pending
      ? { label: "Verifying…", icon: "loader" as const, disabled: true, onPress: () => {} }
      : setup.status === "loading"
        ? { label: "Checking set-up…", icon: "loader" as const, disabled: true, onPress: () => {} }
        : setup.status === "error"
          ? { label: "Try again", icon: "refresh-cw" as const, onPress: () => void setup.reload() }
          : !enrolled
            ? { label: "Set up face check-in", icon: "user-check" as const, onPress: () => router.push("/enroll-face") }
            : !selfieUri
              ? { label: "Take selfie", icon: "camera" as const, disabled: !cameraReady, onPress: () => void takeSelfie() }
              : error?.code && RETAKE.has(error.code)
                ? { label: "Retake selfie", icon: "camera" as const, onPress: retake }
                : { label: `Confirm ${action.toLowerCase()}`, icon: "check" as const, disabled: position.status !== "ready", onPress: () => void submit() };

  return (
    <CheckInSheet onDismiss={dismiss}>
      <SheetHeader
        title={
          finished
            ? "You’re done for today"
            : result
              ? "You’re all set"
              : action === "Check-in"
                ? "Let’s check you in"
                : "Let’s wrap up"
        }
        onClose={dismiss}
      />
      <ScrollView
        style={sheet.scroll}
        contentContainerStyle={sheet.content}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
      >
        <Text style={sheet.intro}>
          {finished
            ? "Both times are recorded. Corrections go through HR."
            : result
              ? "Your attendance has been recorded on the server."
              : setup.status === "error"
                ? setup.error
                : setup.status === "ready" && !enrolled
                  ? "Face check-in isn’t set up yet. One selfie from your profile is all it takes, then you can check in from here."
                  : `Take a selfie and we’ll confirm it’s you${office?.configured ? ` and that you’re at ${office.name}` : ""} before recording your ${action.toLowerCase()}.`}
        </Text>

        <CaptureBox
          done={done}
          label={done ? "Attendance recorded" : selfieUri ? "Your selfie" : "Camera preview"}
          title={
            done
              ? shown?.checkOut
                ? `${timeLabel(shown.checkIn)} – ${timeLabel(shown.checkOut)}`
                : `Checked in at ${timeLabel(shown?.checkIn ?? null)}`
              : !enrolled
                ? "Face check-in not set up"
                : selfieUri
                  ? error?.code && RETAKE.has(error.code) ? "Please retake your selfie" : "Ready to verify"
                  : "Your face goes in the frame"
          }
          caption={
            done
              ? shown?.checkOut
                ? `${hoursLabel(shown.workedHours)} · ${TIMEZONE_LABEL}`
                : TIMEZONE_LABEL
              : !enrolled
                ? "Set it up from your profile, it takes one selfie"
                : selfieUri
                  ? "Retake if it’s blurry or dark"
                  : "Face the camera in good light"
          }
        >
          {done && !selfieUri ? (
            <View style={styles.mark}>
              <Feather name="check" size={48} color={p.accent} />
            </View>
          ) : enrolled || done ? (
            <SelfieCamera ref={camera} stillUri={selfieUri} onReadyChange={setCameraReady} />
          ) : (
            <View style={styles.mark}>
              <Feather name="user" size={48} color={p.white} />
            </View>
          )}
          <CaptureFeedback result={captureResult} />
        </CaptureBox>

        {error ? (
          <View style={sheet.notice}>
            <Notice
              actionLabel={
                remedy === "setup" ? "Set up" : remedy === "relocate" ? "Retry" : undefined
              }
              onAction={
                remedy === "setup"
                  ? () => router.push("/enroll-face")
                  : remedy === "relocate"
                    ? locate
                    : undefined
              }
            >
              {error.message}
            </Notice>
          </View>
        ) : null}

        <View style={sheet.checks}>
          <Text style={sheet.sectionLabel}>
            {done ? "What was verified" : `Before you ${action.toLowerCase()}`}
          </Text>
          <CheckRow
            icon="camera"
            label="Face verification"
            state={faceRow.state}
            detail={faceRow.detail}
            actionLabel={!done && selfieUri && !pending ? "Retake" : undefined}
            onAction={retake}
          />
          <CheckRow
            icon="map-pin"
            label="Office proximity"
            state={placeRow.state}
            detail={placeRow.detail}
            actionLabel={!done && position.status === "failed" ? "Retry" : undefined}
            onAction={locate}
            divider
          />
        </View>
      </ScrollView>

      <SheetFooter
        {...footer}
        note={
          done
            ? "You’ll find this entry in your dashboard and attendance history."
            : "Your selfie and location are checked on the PeoplePay360 server and kept with this record for HR."
        }
      />
    </CheckInSheet>
  );
}

const styles = StyleSheet.create({
  mark: { flex: 1, alignItems: "center", justifyContent: "center" },
});
