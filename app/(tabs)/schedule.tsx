import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  loadSchedules,
  addSchedule,
  updateSchedule,
  toggleSchedule,
  removeSchedule,
  clearDoneSchedules,
  type ScheduleItem,
} from "@/lib/store";
import { useColors } from "@/hooks/use-colors";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** YYYY-MM-DD → "6월 30일 (월)" 형태로 표기 */
function formatDateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEKDAYS[dt.getDay()]})`;
}

/** 오늘 기준 상대 표기 (지남/오늘/내일/D-n) */
function relativeLabel(date: string): { text: string; tone: "past" | "today" | "soon" | "future" } {
  const today = todayKey();
  if (date < today) return { text: "지남", tone: "past" };
  if (date === today) return { text: "오늘", tone: "today" };
  const a = new Date(today + "T00:00:00");
  const b = new Date(date + "T00:00:00");
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 1) return { text: "내일", tone: "soon" };
  return { text: `D-${diff}`, tone: "future" };
}

interface DraftState {
  id: string | null;
  title: string;
  date: string;
  time: string;
  memo: string;
}

const EMPTY_DRAFT: DraftState = {
  id: null,
  title: "",
  date: "",
  time: "",
  memo: "",
};

export default function ScheduleScreen() {
  const colors = useColors();
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  useFocusEffect(
    useCallback(() => {
      loadSchedules().then(setItems);
    }, [])
  );

  const haptic = () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const s = styles(colors);

  // 날짜별 그룹핑 (정렬은 store에서 이미 처리됨)
  const groups = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const arr = map.get(it.date) ?? [];
      arr.push(it);
      map.set(it.date, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  const pendingCount = items.filter((it) => !it.done).length;
  const doneCount = items.length - pendingCount;

  const openAdd = useCallback(() => {
    haptic();
    setDraft({ ...EMPTY_DRAFT, date: todayKey() });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((it: ScheduleItem) => {
    haptic();
    setDraft({
      id: it.id,
      title: it.title,
      date: it.date,
      time: it.time ?? "",
      memo: it.memo ?? "",
    });
    setModalOpen(true);
  }, []);

  const validate = (d: DraftState): string | null => {
    if (!d.title.trim()) return "일정 제목을 입력해 주세요.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return "날짜를 YYYY-MM-DD 형식으로 입력해 주세요.";
    const [, m, day] = d.date.split("-").map(Number);
    if (m < 1 || m > 12 || day < 1 || day > 31) return "올바른 날짜를 입력해 주세요.";
    if (d.time && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(d.time.trim()))
      return "시간을 HH:MM 형식으로 입력해 주세요.";
    return null;
  };

  const handleSave = useCallback(async () => {
    const err = validate(draft);
    if (err) {
      Alert.alert("입력 확인", err);
      return;
    }
    haptic();
    const payload = {
      title: draft.title,
      date: draft.date,
      time: draft.time,
      memo: draft.memo,
    };
    const updated = draft.id
      ? await updateSchedule(draft.id, payload)
      : await addSchedule(payload);
    setItems(updated);
    setModalOpen(false);
    setDraft(EMPTY_DRAFT);
  }, [draft]);

  const handleToggle = useCallback(async (id: string) => {
    haptic();
    setItems(await toggleSchedule(id));
  }, []);

  const handleDelete = useCallback((it: ScheduleItem) => {
    haptic();
    Alert.alert("일정 삭제", `"${it.title}" 일정을 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "삭제",
        style: "destructive",
        onPress: async () => setItems(await removeSchedule(it.id)),
      },
    ]);
  }, []);

  const handleClearDone = useCallback(() => {
    if (doneCount === 0) return;
    haptic();
    Alert.alert("완료 일정 정리", `완료한 일정 ${doneCount}개를 삭제할까요?`, [
      { text: "취소", style: "cancel" },
      {
        text: "정리",
        style: "destructive",
        onPress: async () => setItems(await clearDoneSchedules()),
      },
    ]);
  }, [doneCount]);

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>학습 일정</Text>
          <Text style={s.headerSub}>나의 편입 공부 계획을 관리하세요</Text>
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={[s.summaryNum, { color: colors.primary }]}>{pendingCount}</Text>
            <Text style={s.summaryLabel}>예정</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryNum, { color: colors.success }]}>{doneCount}</Text>
            <Text style={s.summaryLabel}>완료</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={[s.summaryNum, { color: colors.foreground }]}>{items.length}</Text>
            <Text style={s.summaryLabel}>전체</Text>
          </View>
        </View>

        {/* Empty state */}
        {items.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyEmoji}>🗓️</Text>
            <Text style={s.emptyTitle}>등록된 일정이 없어요</Text>
            <Text style={s.emptyText}>
              아래 + 버튼을 눌러 첫 학습 일정을 추가해 보세요!
            </Text>
          </View>
        )}

        {/* Grouped list */}
        {groups.map(([date, list]) => {
          const rel = relativeLabel(date);
          return (
            <View key={date} style={s.group}>
              <View style={s.groupHeader}>
                <Text style={s.groupDate}>{formatDateLabel(date)}</Text>
                <View
                  style={[
                    s.relBadge,
                    {
                      backgroundColor:
                        rel.tone === "today"
                          ? "rgba(0,229,160,0.15)"
                          : rel.tone === "past"
                          ? "rgba(255,92,122,0.12)"
                          : "rgba(74,158,255,0.12)",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.relText,
                      {
                        color:
                          rel.tone === "today"
                            ? colors.success
                            : rel.tone === "past"
                            ? colors.error
                            : colors.primary,
                      },
                    ]}
                  >
                    {rel.text}
                  </Text>
                </View>
              </View>

              {list.map((it) => (
                <View key={it.id} style={s.item}>
                  {/* 완료 체크 */}
                  <Pressable
                    onPress={() => handleToggle(it.id)}
                    style={[
                      s.checkbox,
                      it.done && { backgroundColor: colors.success, borderColor: colors.success },
                    ]}
                    hitSlop={8}
                  >
                    {it.done && (
                      <IconSymbol name="checkmark" size={16} color={colors.background} />
                    )}
                  </Pressable>

                  {/* 본문 */}
                  <Pressable style={s.itemBody} onPress={() => openEdit(it)}>
                    <Text
                      style={[s.itemTitle, it.done && s.itemTitleDone]}
                      numberOfLines={2}
                    >
                      {it.title}
                    </Text>
                    <View style={s.itemMetaRow}>
                      {!!it.time && (
                        <Text style={[s.itemTime, { color: colors.primary2 as string }]}>
                          🕐 {it.time}
                        </Text>
                      )}
                      {!!it.memo && (
                        <Text style={s.itemMemo} numberOfLines={1}>
                          {it.memo}
                        </Text>
                      )}
                    </View>
                  </Pressable>

                  {/* 삭제 */}
                  <Pressable onPress={() => handleDelete(it)} hitSlop={8} style={s.delBtn}>
                    <IconSymbol name="trash.fill" size={18} color={colors.dim} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}

        {/* 완료 일정 정리 */}
        {doneCount > 0 && (
          <Pressable style={s.clearBtn} onPress={handleClearDone}>
            <Text style={s.clearBtnText}>완료 일정 정리 ({doneCount})</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={[s.fab, { backgroundColor: colors.primary }]} onPress={openAdd}>
        <IconSymbol name="plus" size={28} color={colors.background} />
      </Pressable>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalOpen(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{draft.id ? "일정 수정" : "새 일정"}</Text>

            <Text style={s.fieldLabel}>제목 *</Text>
            <TextInput
              style={s.input}
              value={draft.title}
              onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))}
              placeholder="예: 동의어 100단어 복습"
              placeholderTextColor={colors.dim}
            />

            <View style={s.fieldRow}>
              <View style={{ flex: 1.4 }}>
                <Text style={s.fieldLabel}>날짜 * (YYYY-MM-DD)</Text>
                <TextInput
                  style={s.input}
                  value={draft.date}
                  onChangeText={(t) => setDraft((d) => ({ ...d, date: t }))}
                  placeholder="2026-06-30"
                  placeholderTextColor={colors.dim}
                  keyboardType="numbers-and-punctuation"
                  autoCapitalize="none"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>시간 (HH:MM)</Text>
                <TextInput
                  style={s.input}
                  value={draft.time}
                  onChangeText={(t) => setDraft((d) => ({ ...d, time: t }))}
                  placeholder="09:00"
                  placeholderTextColor={colors.dim}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <Text style={s.fieldLabel}>메모</Text>
            <TextInput
              style={[s.input, s.inputMulti]}
              value={draft.memo}
              onChangeText={(t) => setDraft((d) => ({ ...d, memo: t }))}
              placeholder="세부 내용 (선택)"
              placeholderTextColor={colors.dim}
              multiline
            />

            {/* 빠른 날짜 */}
            <View style={s.quickRow}>
              {[
                { label: "오늘", days: 0 },
                { label: "내일", days: 1 },
                { label: "3일 후", days: 3 },
                { label: "1주 후", days: 7 },
              ].map((q) => (
                <Pressable
                  key={q.label}
                  style={s.quickChip}
                  onPress={() => {
                    const dt = new Date();
                    dt.setDate(dt.getDate() + q.days);
                    setDraft((d) => ({ ...d, date: dt.toISOString().slice(0, 10) }));
                  }}
                >
                  <Text style={s.quickChipText}>{q.label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={s.modalActions}>
              <Pressable
                style={[s.modalBtn, s.cancelBtn]}
                onPress={() => setModalOpen(false)}
              >
                <Text style={s.cancelBtnText}>취소</Text>
              </Pressable>
              <Pressable
                style={[s.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Text style={[s.saveBtnText, { color: colors.background }]}>
                  {draft.id ? "수정" : "추가"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      paddingTop: 28,
      paddingBottom: 16,
      paddingHorizontal: 16,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    headerSub: {
      fontSize: 13,
      color: colors.dim,
      marginTop: 4,
    },
    summaryRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    summaryCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    summaryNum: {
      fontSize: 24,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    summaryLabel: {
      fontSize: 11,
      color: colors.dim,
      marginTop: 4,
    },
    emptyBox: {
      marginHorizontal: 16,
      marginTop: 30,
      alignItems: "center",
      paddingVertical: 40,
    },
    emptyEmoji: {
      fontSize: 48,
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
      marginBottom: 6,
    },
    emptyText: {
      fontSize: 13,
      color: colors.dim,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 30,
    },
    group: {
      marginBottom: 8,
    },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 8,
    },
    groupDate: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.foreground,
    },
    relBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    relText: {
      fontSize: 11,
      fontWeight: "700",
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      padding: 12,
      gap: 12,
    },
    checkbox: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.dim,
      alignItems: "center",
      justifyContent: "center",
    },
    itemBody: {
      flex: 1,
    },
    itemTitle: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
    },
    itemTitleDone: {
      textDecorationLine: "line-through",
      color: colors.dim,
    },
    itemMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    itemTime: {
      fontSize: 12,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    itemMemo: {
      flex: 1,
      fontSize: 12,
      color: colors.muted,
    },
    delBtn: {
      padding: 4,
    },
    clearBtn: {
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    clearBtnText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.muted,
    },
    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    // Modal
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.foreground,
      marginBottom: 16,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.muted,
      marginBottom: 6,
      marginTop: 10,
    },
    fieldRow: {
      flexDirection: "row",
      gap: 12,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 12 : 8,
      fontSize: 15,
      color: colors.foreground,
    },
    inputMulti: {
      minHeight: 60,
      textAlignVertical: "top",
    },
    quickRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 14,
    },
    quickChip: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
    },
    quickChipText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary2 as string,
    },
    modalActions: {
      flexDirection: "row",
      gap: 12,
      marginTop: 22,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    cancelBtn: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.muted,
    },
    saveBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });
