import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColors } from "@/hooks/use-colors";

// 접속 암호 해시 (djb2-xor). 평문이 번들에 그대로 노출되지 않도록 해시로만 비교.
const ACCESS_HASH = 2085706667;
const STORE_KEY = "vn_access_ok_v1";

function hash(s: string): number {
  let x = 5381;
  for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
  return x;
}

/**
 * 정적 사이트용 간단 접속 제한 게이트.
 * 허가된 사람에게만 공유한 공통 암호를 입력해야 앱에 들어갈 수 있다.
 * (정적 사이트 특성상 완벽한 보안은 아니며, 캐주얼한 무단 접속을 막는 용도)
 */
export function AccessGate({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const [granted, setGranted] = useState(false);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((v) => {
        if (v === String(ACCESS_HASH)) setGranted(true);
      })
      .finally(() => setChecking(false));
  }, []);

  const submit = useCallback(async () => {
    if (hash(code.trim()) === ACCESS_HASH) {
      setGranted(true);
      setError(false);
      try {
        await AsyncStorage.setItem(STORE_KEY, String(ACCESS_HASH));
      } catch {}
    } else {
      setError(true);
    }
  }, [code]);

  if (checking) return null;
  if (granted) return <>{children}</>;

  const s = styles(colors);
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.card}>
        <Text style={s.logo}>VOCA NEXUS</Text>
        <Text style={s.title}>접속 암호</Text>
        <Text style={s.sub}>허가된 사용자만 입장할 수 있어요</Text>
        <TextInput
          style={[s.input, error && s.inputError]}
          value={code}
          onChangeText={(t) => {
            setCode(t);
            setError(false);
          }}
          placeholder="암호 입력"
          placeholderTextColor={colors.dim as string}
          secureTextEntry
          keyboardType="number-pad"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {error ? <Text style={s.errText}>암호가 올바르지 않습니다</Text> : null}
        <Pressable
          style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
          onPress={submit}
        >
          <Text style={s.btnText}>입장</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background as string,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      backgroundColor: colors.surface as string,
      borderWidth: 1,
      borderColor: colors.border as string,
      borderRadius: 20,
      padding: 28,
      alignItems: "center",
    },
    logo: {
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 3,
      color: colors.primary as string,
      marginBottom: 18,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.foreground as string,
      marginBottom: 6,
    },
    sub: {
      fontSize: 13,
      color: colors.muted as string,
      marginBottom: 22,
      textAlign: "center",
    },
    input: {
      width: "100%",
      backgroundColor: colors.card as string,
      borderWidth: 2,
      borderColor: colors.border as string,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
      color: colors.foreground as string,
      textAlign: "center",
      letterSpacing: 4,
    },
    inputError: {
      borderColor: colors.error as string,
    },
    errText: {
      color: colors.error as string,
      fontSize: 12,
      marginTop: 8,
    },
    btn: {
      width: "100%",
      backgroundColor: colors.primary as string,
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 18,
    },
    btnText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#fff",
      letterSpacing: 1,
    },
  });
