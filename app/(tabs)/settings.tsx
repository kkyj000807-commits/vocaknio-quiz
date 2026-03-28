import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useThemeContext, type ThemeMode } from "@/lib/theme-provider";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";
import {
  loadStats,
  loadBookmarks,
  loadWrongWords,
  saveStats,
  saveBookmarks,
  saveWrongWords,
} from "@/lib/store";

type ThemeOption = { mode: ThemeMode; label: string; icon: "sun.max.fill" | "moon.fill" | "circle.lefthalf.filled" };

const THEME_OPTIONS: ThemeOption[] = [
  { mode: "light", label: "라이트", icon: "sun.max.fill" },
  { mode: "dark", label: "다크", icon: "moon.fill" },
  { mode: "system", label: "시스템", icon: "circle.lefthalf.filled" },
];

export default function SettingsScreen() {
  const colors = useColors();
  const { user, isAuthenticated, loading: authLoading, logout, refresh: refreshAuth } = useAuth();
  const { themeMode, setThemeMode } = useThemeContext();
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const pullMutation = trpc.sync.pull.useQuery(undefined, { enabled: false });
  const pushMutation = trpc.sync.push.useMutation();

  // 서버 → 로컬 (다운로드)
  const handlePull = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await pullMutation.refetch();
      const data = result.data;
      if (!data) throw new Error("데이터 없음");

      // 로컬 데이터와 병합 (서버 우선)
      const localStats = await loadStats();
      const mergedStats = {
        ...localStats,
        totalAnswered: Math.max(localStats.totalAnswered, data.totalAnswered),
        totalCorrect: Math.max(localStats.totalCorrect, data.totalCorrect),
        streak: Math.max(localStats.streak, data.streakDays),
        lastStudyDate: data.lastStudiedAt || localStats.lastStudyDate,
      };
      await saveStats(mergedStats);

      const localBookmarks = await loadBookmarks();
      const mergedBookmarks = Array.from(new Set([...localBookmarks, ...data.bookmarkNums]));
      await saveBookmarks(mergedBookmarks);

      const localWrong = await loadWrongWords();
      const mergedWrong = Array.from(new Set([...localWrong, ...data.wrongNums]));
      await saveWrongWords(mergedWrong);

      setSyncMsg("✓ 클라우드에서 데이터를 가져왔습니다.");
    } catch (e) {
      setSyncMsg("동기화 실패. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, pullMutation]);

  // 로컬 → 서버 (업로드)
  const handlePush = useCallback(async () => {
    if (!isAuthenticated) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const [stats, bookmarks, wrongWords] = await Promise.all([
        loadStats(),
        loadBookmarks(),
        loadWrongWords(),
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
    } catch (e) {
      setSyncMsg("저장 실패. 다시 시도해주세요.");
    } finally {
      setSyncing(false);
    }
  }, [isAuthenticated, pushMutation]);

  const handleLogin = useCallback(async () => {
    await startOAuthLogin();
  }, []);

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

  const s = styles(colors);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* 헤더 */}
        <View style={s.header}>
          <Text style={s.title}>설정</Text>
        </View>

        {/* 테마 섹션 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>화면 테마</Text>
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

        {/* 계정 섹션 */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>계정</Text>
          {authLoading ? (
            <View style={s.card}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : isAuthenticated && user ? (
            <View style={s.card}>
              <View style={s.accountRow}>
                <IconSymbol name="person.crop.circle" size={40} color={colors.primary} />
                <View style={s.accountInfo}>
                  <Text style={s.accountName}>{user.name ?? "사용자"}</Text>
                  <Text style={s.accountEmail}>{user.email ?? user.openId}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.75}>
                <Text style={s.logoutBtnText}>로그아웃</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.loginDesc}>
                로그인하면 오답·북마크·통계 데이터를{"\n"}여러 기기에서 동기화할 수 있습니다.
              </Text>
              <TouchableOpacity style={s.loginBtn} onPress={handleLogin} activeOpacity={0.8}>
                <IconSymbol name="person.fill" size={18} color={colors.background} />
                <Text style={s.loginBtnText}>로그인</Text>
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
              <Text style={s.infoValue}>7,587개</Text>
            </View>
            <View style={[s.infoRow, { borderTopWidth: 0.5, borderTopColor: colors.border }]}>
              <Text style={s.infoLabel}>버전</Text>
              <Text style={s.infoValue}>1.0.0</Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
      fontSize: 12,
      fontWeight: "700",
      color: c.muted,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginBottom: 10,
    },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 0.5,
      borderColor: c.border,
      padding: 16,
      gap: 12,
    },
    // Theme
    themeRow: { flexDirection: "row", gap: 10 },
    themeBtn: {
      flex: 1,
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    themeBtnActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    themeBtnLabel: { fontSize: 12, fontWeight: "600", color: c.muted },
    themeBtnLabelActive: { color: c.background },
    // Account
    accountRow: { flexDirection: "row", alignItems: "center", gap: 14 },
    accountInfo: { flex: 1 },
    accountName: { fontSize: 16, fontWeight: "700", color: c.foreground },
    accountEmail: { fontSize: 13, color: c.muted, marginTop: 2 },
    logoutBtn: {
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.error,
      alignItems: "center",
    },
    logoutBtnText: { fontSize: 14, fontWeight: "600", color: c.error },
    loginDesc: { fontSize: 14, color: c.muted, lineHeight: 20, textAlign: "center" },
    loginBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.primary,
      paddingVertical: 13,
      borderRadius: 12,
    },
    loginBtnText: { fontSize: 15, fontWeight: "700", color: c.background },
    // Sync
    syncDesc: { fontSize: 13, color: c.muted, lineHeight: 18 },
    syncMsgBox: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: c.card,
    },
    syncMsgText: { fontSize: 13, fontWeight: "600" },
    syncBtnRow: { flexDirection: "row", gap: 10 },
    syncBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "transparent",
    },
    syncBtnText: { fontSize: 14, fontWeight: "700" },
    // Info
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    infoLabel: { fontSize: 14, color: c.muted },
    infoValue: { fontSize: 14, fontWeight: "600", color: c.foreground },
  });
