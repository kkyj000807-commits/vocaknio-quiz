import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { VOCAB } from "@/lib/vocab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useThemeContext, type ThemeMode } from "@/lib/theme-provider";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { trpc } from "@/lib/trpc";
import { RELEASE_LABEL } from "@/lib/release-info";
import { LEARNING_COVERAGE } from "@/lib/vocab-learning";
import {
  loadStats,
  loadBookmarks,
  loadWrongWords,
  saveStats,
  saveBookmarks,
  saveWrongWords,
  loadQuizSettings,
  saveQuizSettings,
  type ChoiceLang,
} from "@/lib/store";

type ThemeOption = { mode: ThemeMode; label: string; icon: "sun.max.fill" | "moon.fill" };
type LangOption = { lang: ChoiceLang; label: string; desc: string };
type AuthTab = "login" | "register";

const THEME_OPTIONS: ThemeOption[] = [
  { mode: "light", label: "라이트", icon: "sun.max.fill" },
  { mode: "dark", label: "다크", icon: "moon.fill" },
];

const LANG_OPTIONS: LangOption[] = [
  { lang: "korean", label: "🇰🇷 한글뜻", desc: "한국어 뜻 4지선다" },
  { lang: "english", label: "🔤 영어 동의어", desc: "영어 동의어 4지선다" },
];

async function callAuthApi(
  endpoint: string,
  body: object
): Promise<{ token?: string; user?: Auth.User; error?: string }> {
  const base = getApiBaseUrl();
  const url = `${base}${endpoint}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error || "오류가 발생했습니다." };
  return data;
}

export default function SettingsScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading, logout, refresh: refreshAuth } = useAuth();
  const { themeMode, setThemeMode } = useThemeContext();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [choiceLang, setChoiceLang] = useState<ChoiceLang>("korean");

  useEffect(() => {
    loadQuizSettings().then((s) => setChoiceLang(s.choiceLang));
  }, []);

  const handleChoiceLangChange = useCallback(async (lang: ChoiceLang) => {
    setChoiceLang(lang);
    await saveQuizSettings({ choiceLang: lang });
  }, []);

  // 로그인 폼 상태
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [authLoading2, setAuthLoading2] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const pullMutation = trpc.sync.pull.useQuery(undefined, { enabled: false });
  // useEffect는 위에서 이미 선언됨
  const pushMutation = trpc.sync.push.useMutation();

  // ── 로그인 ──────────────────────────────────────────────────────
  const handleEmailLogin = useCallback(async () => {
    if (!email.trim() || !password) {
      setAuthError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setAuthLoading2(true);
    setAuthError(null);
    try {
      const result = await callAuthApi("/api/auth/login", { email: email.trim(), password });
      if (result.error) {
        setAuthError(result.error);
        return;
      }
      if (result.token) {
        await Auth.setSessionToken(result.token);
        if (result.user) await Auth.setUserInfo(result.user);
        await refreshAuth();
        setEmail("");
        setPassword("");
      }
    } catch {
      setAuthError("로그인 중 오류가 발생했습니다.");
    } finally {
      setAuthLoading2(false);
    }
  }, [email, password, refreshAuth]);

  // ── 회원가입 ─────────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    if (!email.trim() || !password || !name.trim()) {
      setAuthError("이름, 이메일, 비밀번호를 모두 입력해 주세요.");
      return;
    }
    if (password.length < 6) {
      setAuthError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    setAuthLoading2(true);
    setAuthError(null);
    try {
      const result = await callAuthApi("/api/auth/register", {
        email: email.trim(),
        password,
        name: name.trim(),
      });
      if (result.error) {
        setAuthError(result.error);
        return;
      }
      if (result.token) {
        await Auth.setSessionToken(result.token);
        if (result.user) await Auth.setUserInfo(result.user);
        await refreshAuth();
        setEmail("");
        setPassword("");
        setName("");
      }
    } catch {
      setAuthError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setAuthLoading2(false);
    }
  }, [email, password, name, refreshAuth]);

  // ── 로그아웃 ─────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert("로그아웃", "로그아웃하시겠습니까?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await logout();
          setSyncMsg(null);
        },
      },
    ]);
  }, [logout]);

  // ── 클라우드 불러오기 ─────────────────────────────────────────────
  const handlePull = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await pullMutation.refetch();
      const data = result.data;
      if (!data) throw new Error("데이터 없음");
      const localStats = await loadStats();
      await saveStats({
        ...localStats,
        totalAnswered: Math.max(localStats.totalAnswered, data.totalAnswered),
        totalCorrect: Math.max(localStats.totalCorrect, data.totalCorrect),
        streak: Math.max(localStats.streak, data.streakDays),
        lastStudyDate: data.lastStudiedAt || localStats.lastStudyDate,
      });
      const localBookmarks = await loadBookmarks();
      await saveBookmarks(Array.from(new Set([...localBookmarks, ...data.bookmarkNums])));
      const localWrong = await loadWrongWords();
      await saveWrongWords(Array.from(new Set([...localWrong, ...data.wrongNums])));
      setSyncMsg("✓ 클라우드에서 데이터를 가져왔습니다.");
    } catch {
      setSyncMsg("동기화 실패. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, pullMutation]);

  // ── 클라우드 저장하기 ─────────────────────────────────────────────
  const handlePush = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const [stats, bookmarks, wrongWords] = await Promise.all([
        loadStats(), loadBookmarks(), loadWrongWords(),
      ]);
      await pushMutation.mutateAsync({
        wrongNums: wrongWords,
        bookmarkNums: bookmarks,
        totalAnswered: stats.totalAnswered,
        totalCorrect: stats.totalCorrect,
        streakDays: stats.streak,
        lastStudiedAt: stats.lastStudyDate,
      });
      setSyncMsg("✓ 데이터를 클라우드에 저장했습니다.");
    } catch {
      setSyncMsg("저장 실패. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, pushMutation]);

  const s = styles(colors);

  return (
    <ScreenContainer containerClassName="bg-background">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* 헤더 */}
          <View style={s.header}>
            <Text style={s.title}>설정</Text>
          </View>

          {/* 문제 풀이 선지 언어 섹션 */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>문제 풀이 선지 언어</Text>
            <View style={s.card}>
              <Text style={s.settingDesc}>
                ‘한국어 뜻 고르기’ 모드에서 선지를 한글뜻 또는 영어 동의어로
                표시합니다.
              </Text>
              <View style={s.langRow}>
                {LANG_OPTIONS.map((opt) => {
                  const active = choiceLang === opt.lang;
                  return (
                    <TouchableOpacity
                      key={opt.lang}
                      style={[s.langBtn, active && s.langBtnActive]}
                      onPress={() => handleChoiceLangChange(opt.lang)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.langBtnLabel, active && s.langBtnLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[s.langBtnDesc, active && s.langBtnDescActive]}>
                        {opt.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 테마 섹션 */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>화면 테마</Text>
            <View style={s.card}>
              <View style={s.themeRow}>
                {THEME_OPTIONS.map((opt) => {
                  const active = themeMode === opt.mode;
                  return (
                    <TouchableOpacity
                      key={opt.mode}
                      style={[s.themeBtn, active && s.themeBtnActive]}
                      onPress={() => setThemeMode(opt.mode)}
                      activeOpacity={0.75}
                    >
                      <IconSymbol
                        name={opt.icon}
                        size={20}
                        color={active ? colors.background : colors.muted}
                      />
                      <Text style={[s.themeBtnLabel, active && s.themeBtnLabelActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* 계정 섹션 */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>계정</Text>
            {authLoading ? (
              <View style={s.card}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : isAuthenticated && user ? (
              /* 로그인 상태 */
              <View style={s.card}>
                <View style={s.accountRow}>
                  <IconSymbol name="person.crop.circle" size={40} color={colors.primary} />
                  <View style={s.accountInfo}>
                    <Text style={s.accountName}>{user.name ?? "사용자"}</Text>
                    <Text style={s.accountEmail}>{user.email ?? ""}</Text>
                    <Text style={s.accountMethod}>
                      {user.loginMethod === "google" ? "구글 계정" : "이메일 계정"}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
                  <Text style={s.logoutBtnText}>로그아웃</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* 비로그인 상태 — 이메일 로그인/회원가입 폼 */
              <View style={s.card}>
                <Text style={s.loginDesc}>
                  로그인하면 오답·북마크·통계 데이터를{"\n"}여러 기기에서 동기화할 수 있습니다.
                </Text>

                {/* 탭 */}
                <View style={s.tabRow}>
                  <TouchableOpacity
                    style={[s.tab, authTab === "login" && s.tabActive]}
                    onPress={() => { setAuthTab("login"); setAuthError(null); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.tabLabel, authTab === "login" && s.tabLabelActive]}>로그인</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.tab, authTab === "register" && s.tabActive]}
                    onPress={() => { setAuthTab("register"); setAuthError(null); }}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.tabLabel, authTab === "register" && s.tabLabelActive]}>회원가입</Text>
                  </TouchableOpacity>
                </View>

                {/* 오류 메시지 */}
                {authError && (
                  <View style={s.errorBox}>
                    <Text style={s.errorText}>{authError}</Text>
                  </View>
                )}

                {/* 회원가입 시 이름 필드 */}
                {authTab === "register" && (
                  <TextInput
                    style={s.input}
                    placeholder="이름"
                    placeholderTextColor={colors.muted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                )}

                <TextInput
                  style={s.input}
                  placeholder="이메일"
                  placeholderTextColor={colors.muted}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                <TextInput
                  style={s.input}
                  placeholder="비밀번호 (6자 이상)"
                  placeholderTextColor={colors.muted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={authTab === "login" ? handleEmailLogin : handleRegister}
                />

                <TouchableOpacity
                  style={[s.loginBtn, authLoading2 && { opacity: 0.6 }]}
                  onPress={authTab === "login" ? handleEmailLogin : handleRegister}
                  disabled={authLoading2}
                  activeOpacity={0.8}
                >
                  {authLoading2 ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <>
                      <IconSymbol name="person.fill" size={18} color={colors.background} />
                      <Text style={s.loginBtnText}>
                        {authTab === "login" ? "로그인" : "회원가입"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 클라우드 동기화 섹션 */}
          {isAuthenticated && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>클라우드 동기화</Text>
              <View style={s.card}>
                <Text style={s.syncDesc}>
                  오답 노트, 북마크, 학습 통계를 서버에 저장하거나 불러옵니다.
                </Text>
                {syncMsg && (
                  <View style={s.syncMsgBox}>
                    <Text style={[s.syncMsgText, { color: syncMsg.startsWith("✓") ? colors.success : colors.error }]}>
                      {syncMsg}
                    </Text>
                  </View>
                )}
                <View style={s.syncBtnRow}>
                  <TouchableOpacity
                    style={[s.syncBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handlePull}
                    disabled={syncing}
                    activeOpacity={0.75}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <IconSymbol name="icloud.and.arrow.down" size={20} color={colors.primary} />
                    )}
                    <Text style={[s.syncBtnText, { color: colors.primary }]}>불러오기</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.syncBtn, { backgroundColor: colors.primary }]}
                    onPress={handlePush}
                    disabled={syncing}
                    activeOpacity={0.75}
                  >
                    {syncing ? (
                      <ActivityIndicator size="small" color={colors.background} />
                    ) : (
                      <IconSymbol name="icloud.and.arrow.up" size={20} color={colors.background} />
                    )}
                    <Text style={[s.syncBtnText, { color: colors.background }]}>저장하기</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* 학습 데이터 관리 */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>학습 데이터 관리</Text>
            <View style={s.card}>
              <Text style={[s.syncDesc, { marginBottom: 12 }]}>
                플래시카드에서 ⭐ 마스터한 단어 목록을 초기화합니다.{"\n"}모르는 단어 위주로 다시 학습하려면 리셋하세요.
              </Text>
              <TouchableOpacity
                style={[s.syncBtn, { backgroundColor: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.35)", flex: 1, width: "100%" }]}
                onPress={async () => {
                  Alert.alert(
                    "마스터 목록 초기화",
                    "플래시카드에서 마스터 처리한 단어 목록을 모두 초기화합니다. 계속하시겠습니까?",
                    [
                      { text: "취소", style: "cancel" },
                      {
                        text: "초기화",
                        style: "destructive",
                        onPress: async () => {
                          const { clearMastered } = await import("@/lib/store");
                          await clearMastered();
                          Alert.alert("완료", "마스터 목록이 초기화되었습니다.");
                        },
                      },
                    ]
                  );
                }}
                activeOpacity={0.75}
              >
                <Text style={[s.syncBtnText, { color: "#F59E0B" }]}>⭐ 마스터 목록 초기화</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 앱 정보 */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>앱 정보</Text>
            <View style={s.card}>
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>앱 이름</Text>
                <Text style={s.infoValue}>편입VOCA</Text>
              </View>
              <View style={[s.infoRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                <Text style={s.infoLabel}>단어 수</Text>
                <Text style={s.infoValue}>{VOCAB.length.toLocaleString()}개</Text>
              </View>
              <View style={[s.infoRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                <Text style={s.infoLabel}>배포 정보</Text>
                <Text style={[s.infoValue, s.releaseValue]}>{RELEASE_LABEL}</Text>
              </View>
              <View style={[s.infoRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
                <Text style={s.infoLabel}>깊이 학습 해설</Text>
                <Text style={[s.infoValue, s.releaseValue]}>
                  {LEARNING_COVERAGE.senses.toLocaleString()}개 뜻 · {LEARNING_COVERAGE.rows.toLocaleString()}개 목록 항목에 연결
                </Text>
              </View>
              <Text style={s.learningNote}>해설 검수 기준: {LEARNING_COVERAGE.checkedAtKst}</Text>
              <Text style={s.learningNote}>
                확인된 일부 뜻부터 제공합니다. 학습 해설·예문은 AI 편집 검수 자료이며, 사전의 공식 번역이나 인증이 아닙니다.
              </Text>
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel="Open English WordNet 출처 열기"
                style={s.learningSourceLink}
                onPress={() => Linking.openURL("https://en-word.net/").catch(() => Alert.alert("안내", "출처 페이지를 열지 못했습니다."))}
              >
                <Text style={s.learningSourceText}>영영 정의 · Open English WordNet 2025 ↗</Text>
                <Text style={s.learningNote}>Princeton WordNet 기반 · CC BY 4.0 · 양쪽 제작자 표시</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel="Wiktionary 출처 열기"
                style={s.learningSourceLink}
                onPress={() => Linking.openURL("https://en.wiktionary.org/wiki/Wiktionary:Main_Page").catch(() => Alert.alert("안내", "출처 페이지를 열지 못했습니다."))}
              >
                <Text style={s.learningSourceText}>뜻 교차 대조 · Wiktionary ↗</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="link"
                accessibilityLabel="학습 해설 데이터 CC BY-SA 4.0 이용 조건 열기"
                style={s.learningSourceLink}
                onPress={() => Linking.openURL("https://creativecommons.org/licenses/by-sa/4.0/").catch(() => Alert.alert("안내", "이용 조건 페이지를 열지 못했습니다."))}
              >
                <Text style={s.learningSourceText}>학습 해설 데이터 · CC BY-SA 4.0 ↗</Text>
                <Text style={s.learningNote}>학습 해설 데이터에만 적용하며, 앱 코드 전체의 라이선스를 뜻하지 않습니다.</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    scroll: { padding: 20, paddingBottom: 40 },
    header: { marginBottom: 24 },
    title: { fontSize: 28, fontWeight: "700", color: c.foreground },
    section: { marginBottom: 28 },
    sectionTitle: {
      fontSize: 12, fontWeight: "700", color: c.muted,
      letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
    },
    card: {
      backgroundColor: c.surface, borderRadius: 16,
      borderWidth: 0.5, borderColor: c.border, padding: 16, gap: 12,
    },
    // Theme
    themeRow: { flexDirection: "row", gap: 10 },
    themeBtn: {
      flex: 1, flexDirection: "column", alignItems: "center", gap: 6,
      paddingVertical: 14, borderRadius: 14, borderWidth: 1.5,
      borderColor: c.border, backgroundColor: c.surface,
    },
    themeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    themeBtnLabel: { fontSize: 12, fontWeight: "600", color: c.muted },
    themeBtnLabelActive: { color: c.background },
    // Account
    accountRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    accountInfo: { flex: 1 },
    accountName: { fontSize: 16, fontWeight: "700", color: c.foreground },
    accountEmail: { fontSize: 13, color: c.muted, marginTop: 2 },
    accountMethod: { fontSize: 11, color: c.primary, marginTop: 2, fontWeight: "600" },
    logoutBtn: {
      minHeight: 44, paddingVertical: 10, borderRadius: 10,
      borderWidth: 1, borderColor: c.error, alignItems: "center", justifyContent: "center",
    },
    logoutBtnText: { fontSize: 14, fontWeight: "600", color: c.error },
    loginDesc: { fontSize: 14, color: c.muted, lineHeight: 20, textAlign: "center" },
    // Auth tabs
    tabRow: { flexDirection: "row", borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: c.border },
    tab: { flex: 1, minHeight: 44, paddingVertical: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.surface },
    tabActive: { backgroundColor: c.primary },
    tabLabel: { fontSize: 14, fontWeight: "600", color: c.muted },
    tabLabelActive: { color: c.background },
    // Input
    input: {
      backgroundColor: c.background, borderRadius: 10, borderWidth: 1,
      borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: c.foreground,
    },
    errorBox: {
      backgroundColor: c.error + "22", borderRadius: 8,
      paddingVertical: 8, paddingHorizontal: 12,
    },
    errorText: { fontSize: 13, color: c.error, fontWeight: "600" },
    loginBtn: {
      minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 8, backgroundColor: c.primary, paddingVertical: 13, borderRadius: 12,
    },
    loginBtnText: { fontSize: 15, fontWeight: "700", color: c.background },
    // Sync
    syncDesc: { fontSize: 13, color: c.muted, lineHeight: 18 },
    syncMsgBox: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: c.background },
    syncMsgText: { fontSize: 13, fontWeight: "600" },
    syncBtnRow: { flexDirection: "row", gap: 10 },
    syncBtn: {
      flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: "transparent",
    },
    syncBtnText: { fontSize: 14, fontWeight: "700" },
    // Info
    infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
    infoLabel: { fontSize: 14, color: c.muted },
    infoValue: { fontSize: 14, fontWeight: "600", color: c.foreground },
    releaseValue: { flex: 1, marginLeft: 16, fontSize: 12, lineHeight: 18, textAlign: "right" },
    learningNote: { fontSize: 11, lineHeight: 18, color: c.muted },
    learningSourceLink: { minHeight: 44, justifyContent: "center", paddingVertical: 7, gap: 4 },
    learningSourceText: { fontSize: 12, lineHeight: 18, color: c.primary, fontWeight: "600", textDecorationLine: "underline" },
    // Quiz Lang
    settingDesc: { fontSize: 13, color: c.muted, lineHeight: 18, marginBottom: 4 },
    langRow: { flexDirection: "row", gap: 10 },
    langBtn: {
      flex: 1, flexDirection: "column", alignItems: "center", gap: 4,
      paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
      borderColor: c.border, backgroundColor: c.surface,
    },
    langBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
    langBtnLabel: { fontSize: 13, fontWeight: "700", color: c.muted },
    langBtnLabelActive: { color: c.background },
    langBtnDesc: { fontSize: 10, color: c.dim, textAlign: "center" },
    langBtnDescActive: { color: c.background + "cc" },
  });
