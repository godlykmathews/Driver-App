import { StyleSheet, TextInput, TextInputProps, TextStyle, ViewStyle } from 'react-native';

interface InputProps extends Omit<TextInputProps, 'style'> {
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({ style, inputStyle, ...props }: InputProps) {
  return (
    <TextInput
      style={[styles.input, inputStyle]}
      placeholderTextColor="#9ca3af"
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#111827',
  },
});