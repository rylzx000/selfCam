describe('e2e fixtures storage key', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  test('matches production storage key', () => {
    const storage = require('../packageD/utils/storage')
    const fixtures = require('../e2e/support/fixtures')

    expect(fixtures.STORAGE_KEY).toBe(storage.STORAGE_KEY)
  })
})
