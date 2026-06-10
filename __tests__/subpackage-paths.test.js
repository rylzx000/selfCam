const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const PACKAGE_ROOT = path.join(ROOT, 'packageD')
const PACKAGE_PAGES = [
  'pages/index/index',
  'pages/camera/camera',
  'pages/preview/preview',
  'pages/document/document',
  'pages/complete/complete'
]

function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return []
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return walkFiles(fullPath)
    }
    return [fullPath]
  })
}

describe('packageD subpackage layout', () => {
  test('app.json declares packageD as a subpackage behind a host page', () => {
    const appConfig = JSON.parse(readText('app.json'))

    expect(appConfig.pages).toEqual(['pages/host/index'])
    expect(appConfig.subpackages).toContainEqual({
      root: 'packageD',
      pages: PACKAGE_PAGES
    })
  })

  test('subpackage files use packageD-scoped routes, assets, and globals', () => {
    expect(fs.existsSync(PACKAGE_ROOT)).toBe(true)

    const packageText = walkFiles(PACKAGE_ROOT)
      .filter((file) => /\.(js|json|wxml|wxss)$/.test(file))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n')

    expect(packageText).toContain('/packageD/pages/camera/camera')
    expect(packageText).toContain('/packageD/assets/logo.png')
    expect(packageText).not.toMatch(/\/packaged\//)
    expect(packageText).not.toMatch(/['"`]\/pages\//)
    expect(packageText).not.toMatch(/['"`]\/assets\//)
    expect(packageText).not.toContain('globalData.ticket')
  })
})
