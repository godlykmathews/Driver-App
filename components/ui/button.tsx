import { ReactNode } from 'react';
import { StyleSheet, Text, TextStyle, TouchableOpacity, ViewStyle } from 'react-native';

interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const getSizeStyle = () => {
    switch (size) {
      case 'sm': return styles.sm;
      case 'lg': return styles.lg;
      default: return styles.defaultSize;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'sm': return styles.smText;
      case 'lg': return styles.lgText;
      default: return styles.defaultTextSize;
    }
  };

  const buttonStyle = [
    styles.button,
    styles[variant],
    getSizeStyle(),
    disabled && styles.disabled,
    style,
  ];

  const textStyleCombined = [
    styles.text,
    styles[`${variant}Text`],
    getTextSizeStyle(),
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Text style={textStyleCombined}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  // Variants
  default: {
    backgroundColor: '#0a7ea4',
    borderWidth: 1,
    borderColor: '#0a7ea4',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  // Sizes
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  defaultSize: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 40,
  },
  lg: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 48,
  },

  // Text styles
  text: {
    fontWeight: '500',
  },
  defaultText: {
    color: '#ffffff',
  },
  outlineText: {
    color: '#374151',
  },
  ghostText: {
    color: '#6b7280',
  },
  smText: {
    fontSize: 14,
  },
  defaultTextSize: {
    fontSize: 16,
  },
  lgText: {
    fontSize: 18,
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: '#9ca3af',
  },
});