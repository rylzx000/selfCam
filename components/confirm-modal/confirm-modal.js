Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    content: {
      type: String,
      value: ''
    },
    image: {
      type: String,
      value: ''
    },
    confirmText: {
      type: String,
      value: '确定'
    },
    cancelText: {
      type: String,
      value: '取消'
    }
  },

  methods: {
    onConfirm() {
      this.triggerEvent('confirm')
    },

    onCancel() {
      this.triggerEvent('cancel')
    },

    stopPropagation() {
      // 阻止事件冒泡
    }
  }
})
