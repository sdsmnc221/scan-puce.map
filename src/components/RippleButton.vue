<template>
  <button
    ref="rippleButtonRef"
    :class="
      cn(
        'relative flex cursor-pointer items-center justify-center overflow-hidden',
        'rounded-2xl border border-slate-400 bg-gray-200 px-4 py-2 text-center text-primary',
        $props.class
      )
    "
    :style="{ '--duration': $props.duration + 'ms' }"
    @click="handleClick"
  >
    <div class="relative z-10 text-slate-600">
      <slot />
    </div>

    <span class="pointer-events-none absolute inset-0">
      <span
        v-for="ripple in buttonRipples"
        :key="ripple.key"
        class="ripple-animation absolute rounded-full bg-background opacity-30"
        :style="{
          width: ripple.size + 'px',
          height: ripple.size + 'px',
          top: ripple.y + 'px',
          left: ripple.x + 'px',
          backgroundColor: $props.rippleColor,
          transform: 'scale(0)',
          animationDuration: $props.duration + 'ms',
        }"
      />
    </span>
  </button>
</template>

<script lang="ts" setup>
import type { HTMLAttributes } from "vue";
import { cn } from "../lib/utils";
import { ref, watchEffect } from "vue";

interface RippleButtonProps {
  class?: HTMLAttributes["class"];
  rippleColor?: string;
  duration?: number;
}

const props = withDefaults(defineProps<RippleButtonProps>(), {
  rippleColor: "#ADD8E6",
  duration: 600,
});

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const rippleButtonRef = ref<HTMLButtonElement | null>(null);
const buttonRipples = ref<
  Array<{ x: number; y: number; size: number; key: number }>
>([]);

function handleClick(event: MouseEvent) {
  createRipple(event);
  emit("click", event);
}

function createRipple(event: MouseEvent) {
  const button = rippleButtonRef.value;
  if (!button) return;

  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const newRipple = { x, y, size, key: Date.now() };
  buttonRipples.value.push(newRipple);
}

watchEffect(() => {
  if (buttonRipples.value.length > 0) {
    const lastRipple = buttonRipples.value[buttonRipples.value.length - 1];
    setTimeout(() => {
      buttonRipples.value = buttonRipples.value.filter(
        (ripple) => ripple.key !== lastRipple.key
      );
    }, props.duration);
  }
});
</script>

<style scoped>
.ripple-button {
  position: relative;
  overflow: hidden;
  transform: translate3d(0, 0, 0);
  background-color: #fac142; /* Amber yellow */
  color: #1a1a1a;
  border: none;
  border-radius: 4px;
  padding: 8px 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.ripple-button:hover {
  background-color: #f59e0b; /* Darker amber on hover */
}

.ripple {
  position: absolute;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.4);
  transform: scale(0);
  animation: ripple 0.6s linear;
  pointer-events: none;
}

@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}
</style>
