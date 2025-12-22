import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface TableProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function Table({ children, style }: TableProps) {
  return <View style={[styles.table, style]}>{children}</View>;
}

interface TableHeaderProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function TableHeader({ children, style }: TableHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

interface TableBodyProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function TableBody({ children, style }: TableBodyProps) {
  return <View style={[styles.body, style]}>{children}</View>;
}

interface TableRowProps {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

export function TableRow({ children, style, onPress }: TableRowProps) {
  return (
    <View style={[styles.row, style]} onTouchEnd={onPress}>
      {children}
    </View>
  );
}

interface TableHeadProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function TableHead({ children, style }: TableHeadProps) {
  return <View style={[styles.head, style]}>{children}</View>;
}

interface TableCellProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function TableCell({ children, style }: TableCellProps) {
  return <View style={[styles.cell, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  table: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  body: {
    backgroundColor: '#ffffff',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  head: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cell: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
});