import { createCSV, parseCSV } from './providerUtils'

describe('CSV round-trip', () => {
  it('returns original data after createCSV → parseCSV', () => {
    const headers = ['id', 'name', 'active']
    const data = [
      { id: 1, name: 'Alice', active: true },
      { id: 2, name: 'Bob, Jr.', active: false },
      { id: 3, name: 'Carol\nNewline', active: true },
    ]

    const csv = createCSV(headers, data)
    const parsed = parseCSV(csv)

    // parseCSV will convert 'id' to number and leave booleans/strings intact
    expect(parsed).toEqual([
      { id: 1, name: 'Alice', active: 'true' },
      { id: 2, name: 'Bob, Jr.', active: 'false' },
      { id: 3, name: 'Carol\nNewline', active: 'true' },
    ])
  })
})
