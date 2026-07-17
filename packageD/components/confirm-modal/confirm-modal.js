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
    title: {
      type: String,
      value: ''
    },
    image: {
      type: String,
      value: ''
    },
    confirmText: {
      type: String,
      value: '\u786e\u5b9a'
    },
    cancelText: {
      type: String,
      value: '\u53d6\u6d88'
    },
    showCancel: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onConfirm() {
      this.triggerEvent('confirm')
    },

    onCancel() {
      this.triggerEvent('cancel')
    },

    onMaskTap() {
      this.triggerEvent('masktap')
    },

    stopPropagation() {
      // 阻止事件冒泡
    }
  }
})
