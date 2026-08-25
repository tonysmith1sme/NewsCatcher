import { reactive } from 'vue';

export type SnackbarKind = 'info' | 'success' | 'error';

interface SnackbarState {
  visible: boolean;
  message: string;
  kind: SnackbarKind;
}

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger: boolean;
  resolve: ((value: boolean) => void) | null;
}

const snackbar = reactive<SnackbarState>({
  visible: false,
  message: '',
  kind: 'info',
});

const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: '确定',
  cancelLabel: '取消',
  danger: false,
  resolve: null,
});

let snackTimer: number | null = null;

export function showSnackbar(message: string, kind: SnackbarKind = 'info', duration = 4000) {
  snackbar.visible = true;
  snackbar.message = message;
  snackbar.kind = kind;
  if (snackTimer) window.clearTimeout(snackTimer);
  snackTimer = window.setTimeout(() => {
    snackbar.visible = false;
  }, duration);
}

export function hideSnackbar() {
  snackbar.visible = false;
  if (snackTimer) {
    window.clearTimeout(snackTimer);
    snackTimer = null;
  }
}

export function confirmDialog(options: {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}): Promise<boolean> {
  if (confirmState.resolve) {
    confirmState.resolve(false);
  }
  return new Promise((resolve) => {
    confirmState.open = true;
    confirmState.title = options.title || '请确认';
    confirmState.message = options.message;
    confirmState.confirmLabel = options.confirmLabel || '确定';
    confirmState.cancelLabel = options.cancelLabel || '取消';
    confirmState.danger = Boolean(options.danger);
    confirmState.resolve = resolve;
  });
}

export function settleConfirm(accepted: boolean) {
  confirmState.open = false;
  const resolve = confirmState.resolve;
  confirmState.resolve = null;
  resolve?.(accepted);
}

export function useFeedback() {
  return {
    snackbar,
    confirmState,
    showSnackbar,
    hideSnackbar,
    confirmDialog,
    settleConfirm,
  };
}
