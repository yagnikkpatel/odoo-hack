import { File } from "expo-file-system";
import { Platform } from "react-native";
import type { Position } from "./types";

export async function selfieForm(selfieUri: string, position?: Position) {
  const body = new FormData();
  const file = Platform.OS === "web" ? await (await fetch(selfieUri)).blob() : new File(selfieUri);
  body.append("selfie", file, "selfie.jpg");
  if (position) {
    body.append("latitude", String(position.latitude));
    body.append("longitude", String(position.longitude));
    if (position.accuracyM !== null) body.append("accuracy", String(position.accuracyM));
  }
  return body;
}
