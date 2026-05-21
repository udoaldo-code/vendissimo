import { CookieJar } from '@/lib/smshj/cookies'

function resWithCookies(...cookies: string[]): Response {
  const h = new Headers()
  for (const c of cookies) h.append('set-cookie', c)
  return new Response('', { headers: h })
}

describe('CookieJar', () => {
  it('stores cookies from a response and serializes them into a Cookie header', () => {
    const jar = new CookieJar()
    jar.applyFromResponse(resWithCookies('JSESSIONID=abc123; Path=/; HttpOnly', 'foo=bar; Path=/'))
    expect(jar.header()).toBe('JSESSIONID=abc123; foo=bar')
  })

  it('overwrites a cookie when the same name is set again', () => {
    const jar = new CookieJar()
    jar.applyFromResponse(resWithCookies('JSESSIONID=old'))
    jar.applyFromResponse(resWithCookies('JSESSIONID=new'))
    expect(jar.header()).toBe('JSESSIONID=new')
  })

  it('returns an empty string when no cookies are stored', () => {
    expect(new CookieJar().header()).toBe('')
  })
})
