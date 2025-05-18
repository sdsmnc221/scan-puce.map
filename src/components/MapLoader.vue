<template>
  <div class="loader-container" :class="{ 'slide-out-bck-center': !loading }">
    <FlickeringGrid
      class="absolute w-full h-full flex justify-center items-center inset-0 z-0 [mask-image:radial-gradient(450px_circle_at_center,white,transparent)]"
      :square-size="4"
      :grid-gap="6"
      color="#1d3557"
      :max-opacity="0.5"
      :flicker-chance="0.1"
      :width="800"
      :height="800"
    ></FlickeringGrid>

    <div class="pet-scanner-container">
      <!-- Scanner animation -->
      <div class="scanner-line"></div>

      <!-- Pet silhouettes -->
      <div class="pet-silhouettes">
        <img
          alt="Scanning for pet microchips..."
          src="/scanner-silhouette.png"
        />
      </div>

      <div class="scanning-text leading-[1rem]">
        Chargement du Réseau Lecteurs de puce France...
      </div>
    </div>
  </div>
</template>

<script setup>
import FlickeringGrid from "./FlickeringGrid.vue";

const props = defineProps({
  loading: Boolean,
});
</script>

<style lang="scss">
.loader-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99;
  background-color: rgba(
    250,
    193,
    66,
    0.9
  ); // Using the brand yellow with opacity
}

.pet-scanner-container {
  position: relative;
  width: 300px;
  height: 300px;
  background: #fac142;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 3px solid #2a2a2a;
}

.pet-silhouettes {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.pets-svg {
  width: 100%;
  height: 100%;
  position: relative;
}

.pet-silhouette {
  fill: #2a2a2a;
  opacity: 0.8;
}

.scanner-line {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  box-shadow: 0 0 10px 2px rgba(255, 255, 255, 0.8);
  z-index: 10;
  animation: scan 2s ease-in-out infinite;
}

.scanning-text {
  position: absolute;
  bottom: 16px;
  font-family: "Poppins", sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: #2a2a2a;
  text-align: center;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes scan {
  0% {
    top: 0;
  }
  50% {
    top: calc(100% - 4px);
  }
  100% {
    top: 0;
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.slide-out-bck-center {
  -webkit-animation: slide-out-bck-center 1.2s
    cubic-bezier(0.55, 0.085, 0.68, 0.53) both;
  animation: slide-out-bck-center 1.2s cubic-bezier(0.55, 0.085, 0.68, 0.53)
    both;
  pointer-events: none;
}

@-webkit-keyframes slide-out-bck-center {
  0% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
  100% {
    -webkit-transform: translateZ(-1100px);
    transform: translateZ(-1100px);
    opacity: 0;
  }
}

@keyframes slide-out-bck-center {
  0% {
    -webkit-transform: translateZ(0);
    transform: translateZ(0);
    opacity: 1;
  }
  100% {
    -webkit-transform: translateZ(-1100px);
    transform: translateZ(-1100px);
    opacity: 0;
  }
}

/* Responsive adjustments */
@media screen and (max-width: 768px) {
  .pet-scanner-container {
    width: 250px;
    height: 250px;
  }

  .scanning-text {
    font-size: 14px;
  }
}
</style>
