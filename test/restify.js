var assert = require('assert'),
    restify = require('restify'),
    keys = require('keygrip')(['a', 'b']),
    http = require('http'),
    Cookies = require('../'),
    request = require('supertest')

describe('Restify', function () {
  var header
  var server

  before(function setup(done) {
    server = restify.createServer()

    server.get('/set', function (req, res) {
      setCookies(req, res)
      res.json({ status : 'ok'})
    })

    server.get('/get', function (req, res) {
      assertCookies(req, res)
      res.send(200)
    })

    server.listen(done)
  })

  it('should set cookies', function (done) {
    request(server)
    .get('/set')
    .expect(200, function (err, res) {
      if (err) return done(err)

      header = res.headers['set-cookie']
      assertSetCookieHeader(header)
      done()
    })
  })

  it('should get cookies', function (done) {
    request(server)
    .get('/get')
    .set('Cookie', header.join(';'))
    .expect(200, done)
  })
})

function setCookies(req, res) {
  var cookies = new Cookies(req, res, keys)
  cookies
    .set('unsigned', 'foo', { signed:false, httpOnly: false })
    .set('signed', 'bar', { signed: true })
    .set('tampered', 'baz', { signed: false })
    .set('tampered.sig', 'bogus', { signed: false })
    .set('overwrite', 'old-value', { signed: true })
    .set('overwrite', 'new-value', { overwrite: true, signed: true })
}

function assertCookies(req, res) {
  var cookies = new Cookies(req, res, keys)
  var unsigned = cookies.get('unsigned'),
    signed = cookies.get('signed', { signed: true }),
    tampered = cookies.get('tampered', { signed: true }),
    overwrite = cookies.get('overwrite', { signed: true })

  assert.equal(unsigned, 'foo')
  assert.equal(cookies.get('unsigned.sig', { signed:false }), undefined)
  assert.equal(signed, 'bar')
  assert.equal(cookies.get('signed.sig', { signed: false }), keys.sign('signed=bar'))
  assert.notEqual(tampered, 'baz')
  assert.equal(tampered, undefined)
  assert.equal(overwrite, 'new-value')
  assert.equal(cookies.get('overwrite.sig', { signed:false }), keys.sign('overwrite=new-value'))
  assert.equal(res.getHeader('Set-Cookie'), 'tampered.sig=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly')
}

function assertSetCookieHeader(header) {
  assert.equal(header.length, 7)
  assert.equal(header[0], 'unsigned=foo; path=/')
  assert.equal(header[1], 'signed=bar; path=/; httponly')
  assert.ok(/^signed\.sig=.{27}; path=\/; httponly$/.test(header[2]))
  assert.equal(header[3], 'tampered=baz; path=/; httponly')
  assert.equal(header[4], 'tampered.sig=bogus; path=/; httponly')
  assert.equal(header[5], 'overwrite=new-value; path=/; httponly')
  assert.ok(/^overwrite\.sig=.{27}; path=\/; httponly$/.test(header[6]))
}
