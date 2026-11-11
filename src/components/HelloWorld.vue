<template>
  <div class="hello">
    <img alt="Vue logo" src="../assets/logo.png">
    <h1>{{ msg }}</h1>
    <h3>name: {{ name }}</h3>
      <h3>hel-micro</h3>
    <p>
      A module federation SDK which is unrelated to tool chain for module consumer.
      checkout the <a href="https://tnfe.github.io/hel/" target="_blank" rel="noopener">hel-micro documentation</a>.
    </p>
    <button class="remote-btn" @click="count++">远程组件内部计数 {{ count }}</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'HelloWorld',
  props: {
    /**
     * @description 标题文案
     */
    msg: String,
    /**
     * @description 名字，展示在标题下方
     */
    name: String
  },
  setup() {
    // 验证远程组件复用的是宿主注入的 vue 运行时：
    // 若是两份 vue，这里的 ref 变更不会触发宿主渲染。
    const count = ref(0)
    return { count }
  }
})
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
.remote-btn {
  margin-top: 20px;
  padding: 8px 16px;
  border: 1px solid #42b983;
  border-radius: 6px;
  background: #fff;
  color: #42b983;
  font-size: 16px;
  cursor: pointer;
}
</style>
