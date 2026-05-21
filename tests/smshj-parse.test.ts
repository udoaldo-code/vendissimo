import { parseMachineIds, parseMachineDetail } from '@/lib/smshj/parse'

describe('parseMachineIds', () => {
  it('extracts distinct ids in first-seen order', () => {
    const html = `<a href="machine.html?id=12">x</a><a href="machine.html?id=7">y</a><a href="machine.html?id=12">dup</a>`
    expect(parseMachineIds(html)).toEqual(['12', '7'])
  })

  it('returns an empty array when no ids are present', () => {
    expect(parseMachineIds('<html>nothing</html>')).toEqual([])
  })
})

describe('parseMachineDetail', () => {
  const SCRAPED = '2026-05-21T00:00:00.000Z'

  it('extracts temperature, name, code, and online status', () => {
    const html = `
      <div>主柜温度: 8.5 ℃</div>
      <input id="new-name" value="Airport A1">
      <script>var x = { sbId: 'abc1234567', y:1 }</script>
      <span>正常售卖</span>`
    expect(parseMachineDetail(html, '42', SCRAPED)).toEqual({
      id: '42', code: 'abc1234567', name: 'Airport A1',
      temperature_c: 8.5, online: true, scraped_at: SCRAPED, breached: false,
    })
  })

  it('handles a negative temperature and the fullwidth colon', () => {
    expect(parseMachineDetail('主柜温度：-3℃', '1', SCRAPED).temperature_c).toBe(-3)
  })

  it('marks online false on a stop-selling page', () => {
    expect(parseMachineDetail('停止售卖', '1', SCRAPED).online).toBe(false)
  })

  it('leaves temperature and online null when absent', () => {
    const m = parseMachineDetail('<html>empty</html>', '1', SCRAPED)
    expect(m.temperature_c).toBeNull()
    expect(m.online).toBeNull()
  })
})
