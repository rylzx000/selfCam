const fs = require('fs')
const path = require('path')

const logFile = path.join(__dirname, '..', 'runtime-logs', 'device-capture-log.jsonl')

if (!fs.existsSync(logFile)) {
  console.log('未找到日志文件:', logFile)
  process.exit(0)
}

const lines = fs.readFileSync(logFile, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const logs = lines.map((line) => {
  try {
    return JSON.parse(line)
  } catch (error) {
    return null
  }
}).filter(Boolean)

if (logs.length === 0) {
  console.log('日志文件为空')
  process.exit(0)
}

const latestSessionId = logs[logs.length - 1].sessionId
const latestSessionLogs = logs.filter((item) => item.sessionId === latestSessionId)

console.log(`最新 session: ${latestSessionId}`)
console.log(`日志条数: ${latestSessionLogs.length}`)
console.log('')

latestSessionLogs.forEach((item) => {
  const payload = item.payload ? JSON.stringify(item.payload) : '{}'
  console.log(`${item.at} [${item.level}] ${item.scope}/${item.event} ${payload}`)
})
