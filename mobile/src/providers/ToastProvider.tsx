import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
  AccessibilityInfo,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react-native';
import { tokens } from '../design/tokens';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

export interface ToastContextValue {
  show: (options: { type: ToastType; message: string; duration?: number }) => string;
  success: (message: string) => string;
  error: (message: string) => string;
  warning: (message: string) => string;
  info: (message: string) => string;
  loading: (message: string) => string;
  dismiss: (id: string) => void;
  promise: <T>(
    promise: Promise<T>,
    msgs: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((err: any) => string);
    }
  ) => Promise<T>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    ({ type, message, duration }: { type: ToastType; message: string; duration?: number }) => {
      idCounter.current += 1;
      const id = `toast-${idCounter.current}-${Date.now()}`;
      const autoDismissDuration =
        duration !== undefined ? duration : type === 'error' ? 6000 : 4000;

      // iOS Accessibility announcement
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(message);
      }

      setToasts((prev) => {
        // Limit max 3 stacked toasts
        const next = [...prev, { id, type, message, duration: autoDismissDuration }];
        if (next.length > 3) {
          return next.slice(next.length - 3);
        }
        return next;
      });

      if (type !== 'loading' && autoDismissDuration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, autoDismissDuration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback((message: string) => show({ type: 'success', message }), [show]);
  const error = useCallback((message: string) => show({ type: 'error', message }), [show]);
  const warning = useCallback((message: string) => show({ type: 'warning', message }), [show]);
  const info = useCallback((message: string) => show({ type: 'info', message }), [show]);
  const loading = useCallback((message: string) => show({ type: 'loading', message }), [show]);

  const promiseFn = useCallback(
    async <T,>(
      p: Promise<T>,
      msgs: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: any) => string);
      }
    ): Promise<T> => {
      const id = loading(msgs.loading);
      try {
        const result = await p;
        dismiss(id);
        const successMsg = typeof msgs.success === 'function' ? msgs.success(result) : msgs.success;
        success(successMsg);
        return result;
      } catch (err: any) {
        dismiss(id);
        const errorMsg = typeof msgs.error === 'function' ? msgs.error(err) : msgs.error;
        error(errorMsg);
        throw err;
      }
    },
    [loading, dismiss, success, error]
  );

  return (
    <ToastContext.Provider
      value={{
        show,
        success,
        error,
        warning,
        info,
        loading,
        dismiss,
        promise: promiseFn,
      }}
    >
      {children}

      {/* Floating toast layer */}
      <View
        pointerEvents="box-none"
        style={[styles.toastContainer, { top: Math.max(insets.top, 12) + 8 }]}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10,
      onPanResponderMove: (_, gesture) => {
        panX.setValue(gesture.dx);
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > 80) {
          Animated.timing(panX, {
            toValue: gesture.dx > 0 ? 400 : -400,
            duration: 150,
            useNativeDriver: true,
          }).start(() => onDismiss());
        } else {
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const config = getToastConfig(toast.type);
  const Icon = config.icon;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.toastCard,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          transform: [{ translateX: panX }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.iconContainer}>
        {toast.type === 'loading' ? (
          <ActivityIndicator size="small" color={config.iconColor} />
        ) : (
          <Icon size={18} color={config.iconColor} />
        )}
      </View>

      <Text style={[styles.toastMessage, { color: config.textColor }]}>
        {toast.message}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={onDismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.closeBtn}
      >
        <X size={14} color={tokens.colors.textSubtle} />
      </Pressable>
    </Animated.View>
  );
};

function getToastConfig(type: ToastType) {
  switch (type) {
    case 'success':
      return {
        bg: '#0f1712',
        border: 'rgba(52, 211, 153, 0.35)',
        iconColor: tokens.colors.successLight,
        textColor: tokens.colors.text,
        icon: CheckCircle,
      };
    case 'error':
      return {
        bg: '#1c0f13',
        border: 'rgba(244, 63, 94, 0.4)',
        iconColor: tokens.colors.destructiveLight,
        textColor: tokens.colors.text,
        icon: AlertCircle,
      };
    case 'warning':
      return {
        bg: '#1c150c',
        border: 'rgba(251, 191, 36, 0.4)',
        iconColor: tokens.colors.warningLight,
        textColor: tokens.colors.text,
        icon: AlertTriangle,
      };
    case 'loading':
      return {
        bg: '#12121c',
        border: 'rgba(168, 85, 247, 0.35)',
        iconColor: tokens.colors.primaryLight,
        textColor: tokens.colors.text,
        icon: Info,
      };
    case 'info':
    default:
      return {
        bg: '#0e121a',
        border: 'rgba(96, 165, 250, 0.35)',
        iconColor: tokens.colors.infoLight,
        textColor: tokens.colors.text,
        icon: Info,
      };
  }
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: tokens.radius.button,
    borderWidth: 1,
    gap: 12,
    ...tokens.shadows.card,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastMessage: {
    flex: 1,
    fontFamily: tokens.typography.fontFamily,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
});
