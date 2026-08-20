import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

export const colors = {
  bg: '#ffffff',
  text: '#111111',
  subtle: '#666666',
  border: '#e5e5e5',
  primary: '#111111',
  primaryText: '#ffffff',
  accent: '#0a7d3e',
  warning: '#b54708',
  danger: '#b42318',
  surface: '#f7f7f7',
};

type ButtonProps = PressableProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  fullWidth?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  loading,
  fullWidth = true,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const palette = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surface, fg: colors.text, border: colors.border };
      case 'danger':
        return { bg: colors.danger, fg: '#fff', border: colors.danger };
      case 'ghost':
        return { bg: 'transparent', fg: colors.text, border: 'transparent' };
      default:
        return { bg: colors.primary, fg: colors.primaryText, border: colors.primary };
    }
  })();
  return (
    <Pressable
      disabled={isDisabled}
      style={[
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: isDisabled ? 0.6 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style as ViewStyle,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.btnText, { color: palette.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap style={[styles.card, style]} onPress={onPress}>
      {children}
    </Wrap>
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Pill({ label, tone = 'default' }: { label: string; tone?: 'default' | 'good' | 'warn' }) {
  const bg = tone === 'good' ? '#e7f6ec' : tone === 'warn' ? '#fdf1e3' : colors.surface;
  const fg = tone === 'good' ? colors.accent : tone === 'warn' ? colors.warning : colors.text;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 16, fontWeight: '600' },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  h1: { fontSize: 26, fontWeight: '700', color: colors.text },
  h2: { fontSize: 18, fontWeight: '600', color: colors.text },
  muted: { color: colors.subtle, fontSize: 14 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '600' },
});
