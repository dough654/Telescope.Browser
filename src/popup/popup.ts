import PopupApp from './components/PopupApp.svelte'

const app = new PopupApp({
  target: document.getElementById('app')!
})

export default app