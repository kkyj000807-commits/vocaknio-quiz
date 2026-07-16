/**
 * VOCA NEXUS 테마 팔레트.
 * 4개 테마 모드: dark_navy(기존 다크) / clean_sky / paper_blue(기본, 장시간 학습) / exam_paper(시험지)
 * - 색은 여기서만 정의하고 컴포넌트에 하드코딩하지 않는다.
 * - *Text 변형은 밝은 배경에서 작은 글자용 대비 보정값(WCAG AA)이다.
 */
const appThemes = {
  dark_navy: {
    primary:     '#60A5FA',
    primary2:    '#93C5FD',
    primarySoft: '#1E3A8A',
    background:  '#050B1F',
    surface:     '#0F1B3D',
    card:        '#13285A',
    foreground:  '#F8FAFC',
    muted:       '#CBD5E1',
    dim:         '#8FA3C4',
    border:      '#274472',
    success:     '#10B981',
    successText: '#34D399',
    warning:     '#FACC15',
    warningText: '#FACC15',
    error:       '#F43F5E',
    errorText:   '#FB7185',
    tint:        '#60A5FA',
  },
  clean_sky: {
    primary:     '#2563EB',
    primary2:    '#1D4ED8',
    primarySoft: '#DBEAFE',
    background:  '#F7FAFC',
    surface:     '#FFFFFF',
    card:        '#EEF6FF',
    foreground:  '#1E293B',
    muted:       '#64748B',
    dim:         '#94A3B8',
    border:      '#D8E3F0',
    success:     '#10B981',
    successText: '#047857',
    warning:     '#F59E0B',
    warningText: '#B45309',
    error:       '#F43F5E',
    errorText:   '#BE123C',
    tint:        '#2563EB',
  },
  paper_blue: {
    primary:     '#0EA5E9',
    primary2:    '#0369A1',
    primarySoft: '#DFF3FF',
    background:  '#FFFDF7',
    surface:     '#FFFFFF',
    card:        '#EAF6FF',
    foreground:  '#243447',
    muted:       '#6B7280',
    dim:         '#9AA5B1',
    border:      '#D6E6F2',
    success:     '#16A34A',
    successText: '#15803D',
    warning:     '#FACC15',
    warningText: '#B45309',
    error:       '#E11D48',
    errorText:   '#BE123C',
    tint:        '#0EA5E9',
  },
  exam_paper: {
    primary:     '#1D4ED8',
    primary2:    '#1E40AF',
    primarySoft: '#DBEAFE',
    background:  '#F8F5ED',
    surface:     '#FFFFFF',
    card:        '#EFF6FF',
    foreground:  '#111827',
    muted:       '#6B7280',
    dim:         '#9CA3AF',
    border:      '#E5E7EB',
    success:     '#059669',
    successText: '#047857',
    warning:     '#D97706',
    warningText: '#92400E',
    error:       '#DC2626',
    errorText:   '#B91C1C',
    tint:        '#F97316',
  },
};

// 이진(light/dark) 소비자 호환: light=paper_blue(기본), dark=dark_navy
const themeColors = {};
for (const token of Object.keys(appThemes.paper_blue)) {
  themeColors[token] = { light: appThemes.paper_blue[token], dark: appThemes.dark_navy[token] };
}

module.exports = { themeColors, appThemes };
