<script setup>
</script>

<template>
  <router-view :key="$route.fullPath" />
</template>

<style>
html,
body,
#app {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>