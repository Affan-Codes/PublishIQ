import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { Button } from './Button';
import { tokens } from '../../design/tokens';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={isLoading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss confirmation modal"
        />

        <View style={styles.dialogBox}>
          {variant === 'danger' && (
            <View style={styles.iconContainer}>
              <AlertTriangle size={24} color={tokens.colors.destructiveLight} />
            </View>
          )}

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actionsRow}>
            <Button
              variant="secondary"
              size="sm"
              disabled={isLoading}
              onPress={onCancel}
              style={{ flex: 1 }}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="sm"
              isLoading={isLoading}
              loadingText="Processing..."
              onPress={onConfirm}
              style={{ flex: 1 }}
            >
              {confirmLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.borderStrong,
    borderRadius: tokens.radius.xl,
    padding: tokens.spacing.xl,
    alignItems: 'center',
    ...tokens.shadows.card,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.destructiveBgSubtle,
    borderWidth: 1,
    borderColor: tokens.colors.destructiveBorderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: tokens.spacing.base,
  },
  title: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 18,
    fontWeight: '700',
    color: tokens.colors.text,
    textAlign: 'center',
    marginBottom: tokens.spacing.sm,
  },
  message: {
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    color: tokens.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: tokens.spacing.xl,
  },
  actionsRow: {
    flexDirection: 'row',
    width: '100%',
    gap: tokens.spacing.md,
  },
});
