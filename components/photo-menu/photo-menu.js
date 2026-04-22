Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    onDelete() {
      this.triggerEvent('delete')
      this.onClose()
    },

    onRetake() {
      this.triggerEvent('retake')
      this.onClose()
    },

    onClose() {
      this.triggerEvent('close')
    },

    stopPropagation() {
      // 阻止事件冒泡
    }
  }
})
