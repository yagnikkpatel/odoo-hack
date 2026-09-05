import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Button, Notice, TextField, s } from "@/components/workforce";
import { useSession } from "@/features/auth/session";
import { font, palette as p } from "@/constants/theme";
export default function Login() {
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    if (pending) return;
    if (!email.trim() || !password) { setError("Enter your email and password."); return; }
    setPending(true); setError(null);
    try { await signIn(email, password); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in."); }
    finally { setPending(false); }
  }
  return <SafeAreaView style={s.safe}><KeyboardAwareScrollView style={styles.fill} contentContainerStyle={[s.page, styles.content]} bottomOffset={24} keyboardShouldPersistTaps="handled">
    <Text style={styles.brand}>PEOPLEPAY360</Text><Text style={s.title}>Your workday,{"\n"}in one place.</Text><Text style={s.body}>Sign in with your employee account.</Text>
    <View style={styles.form}>
      <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" textContentType="username" editable={!pending} />
      <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" editable={!pending} onSubmitEditing={() => void submit()} />
      {error && <Notice>{error}</Notice>}
      <Button label={pending ? "Signing in…" : "Sign in"} disabled={pending} onPress={() => void submit()} />
    </View><Text style={styles.footer}>Need an account or password help? Contact your HR team.</Text>
  </KeyboardAwareScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ fill: { flex: 1 }, content: { flexGrow: 1, justifyContent: "center", maxWidth: 480, paddingVertical: 32, gap: 16 }, brand: { ...font.bold, letterSpacing: 2, color: p.accent, marginBottom: 20 }, form: { gap: 18, marginTop: 18 }, footer: { ...font.regular, marginTop: 20, fontSize: 12, lineHeight: 18, color: p.muted } });
