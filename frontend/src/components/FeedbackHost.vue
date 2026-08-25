<template>
  <Teleport to="body">
    <div v-if="snackbar.visible" class="m3-snackbar" :class="snackbar.kind" role="status">
      <span class="material-symbols-outlined snack-icon">{{ snackIcon }}</span>
      <span class="snack-text">{{ snackbar.message }}</span>
      <md-icon-button class="snack-close" @click="hideSnackbar">
        <span class="material-symbols-outlined">close</span>
      </md-icon-button>
    </div>

    <md-dialog
      :open="confirmState.open"
      @closed="onConfirmClosed"
      @cancel="onConfirmCancel"
      class="m3-confirm-dialog"
    >
      <div slot="headline">{{ confirmState.title }}</div>
      <div slot="content" class="confirm-body">{{ confirmState.message }}</div>
      <div slot="actions">
        <md-text-button @click="settleConfirm(false)">{{ confirmState.cancelLabel }}</md-text-button>
        <md-filled-button
          class="confirm-ok"
          :class="{ danger: confirmState.danger }"
          @click="settleConfirm(true)"
        >
          {{ confirmState.confirmLabel }}
        </md-filled-button>
      </div>
    </md-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useFeedback } from '../composables/useFeedback';

const { snackbar, confirmState, hideSnackbar, settleConfirm } = useFeedback();

const snackIcon = computed(() => {
  if (snackbar.kind === 'success') return 'check_circle';
  if (snackbar.kind === 'error') return 'error';
  return 'info';
});

const onConfirmClosed = () => {
  if (confirmState.open) settleConfirm(false);
};

const onConfirmCancel = (event: Event) => {
  event.preventDefault();
  settleConfirm(false);
};
</script>

<style scoped>
.m3-snackbar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 280px;
  max-width: min(640px, calc(100vw - 32px));
  min-height: 48px;
  padding: 12px 8px 12px 16px;
  border-radius: 4px;
  background: var(--md-sys-color-inverse-surface);
  color: var(--md-sys-color-inverse-on-surface);
  box-shadow: 0 3px 5px -1px rgba(0, 0, 0, 0.2), 0 6px 10px 0 rgba(0, 0, 0, 0.14);
  font-size: 14px;
  line-height: 1.4;
  animation: snack-in 180ms ease-out;
}

.m3-snackbar.success .snack-icon {
  color: #81c995;
}

.m3-snackbar.error .snack-icon {
  color: #f2b8b5;
}

.snack-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.snack-text {
  flex: 1;
}

.snack-close {
  --md-icon-button-icon-color: var(--md-sys-color-inverse-on-surface);
  --md-icon-button-state-layer-color: #fff;
}

.confirm-body {
  font-size: 14px;
  line-height: 1.5;
  color: var(--md-sys-color-on-surface-variant);
  max-width: 360px;
}

.confirm-ok.danger {
  --md-filled-button-container-color: #b3261e;
  --md-filled-button-label-text-color: #fff;
}

@keyframes snack-in {
  from {
    opacity: 0;
    transform: translate(-50%, 12px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}
</style>
