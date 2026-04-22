Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    currentImage: {
      type: String,
      value: ''
    }
  },

  methods: {
    onClose() {
      this.triggerEvent('close')
    },

    onDelete() {
      this.triggerEvent('delete')
    },

    onRetake() {
      this.triggerEvent('retake')
    },

    stopPropagation() {}
  }
})
