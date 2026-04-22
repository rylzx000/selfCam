/**
 * 直接测试 automator.launch
 */

const automator = require('miniprogram-automator')

const config = {
  cliPath: 'D:\\environment\\wechat-devtools\\cli.bat',
  projectPath: 'D:\\project\\selfCam'
}

console.log('测试 automator.launch...\n')
console.log('cliPath:', config.cliPath)
console.log('projectPath:', config.projectPath)

// 检查路径是否存在
const fs = require('fs')
console.log('\n路径检查:')
console.log('  CLI 存在:', fs.existsSync(config.cliPath))
console.log('  项目存在:', fs.existsSync(config.projectPath))

console.log('\n尝试启动...\n')

automator.launch(config)
  .then(mp => {
    console.log('✅ 启动成功!')
    return mp.close()
  })
  .catch(err => {
    console.log('❌ 启动失败:')
    console.log('   错误:', err.message)
    console.log('\n完整错误:')
    console.log(err)
  })
