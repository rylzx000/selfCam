/**
 * 微信开发者工具自动化测试配置。
 * Windows 下可通过环境变量覆盖 CLI 路径：
 *   $env:WECHAT_DEVTOOLS_CLI='D:\environment\wechat-devtools\cli.bat'
 */

const path = require('path')

const projectPath = process.env.MINIPROGRAM_PROJECT_PATH || path.resolve(__dirname, '..')

module.exports = {
  cliPath: process.env.WECHAT_DEVTOOLS_CLI
    || process.env.WECHAT_CLI_PATH
    || 'D:\\environment\\wechat-devtools\\cli.bat',

  projectPath,

  port: Number(process.env.MINIPROGRAM_AUTOMATOR_PORT || 9420),

  timeout: Number(process.env.E2E_TIMEOUT_MS || 90000),

  screenshotPath: path.join(projectPath, 'e2e', 'screenshots'),

  reportPath: path.join(projectPath, 'e2e', 'reports')
}
